import { Worker, Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { db } from '@repo/database';
import { generateAtlassianWelcomePDF } from '@repo/shared';
import { withImapClient, type EmailMessage } from '../lib/imap-client';
import { parseAtlassianEmail } from '../lib/atlassian-email-parser';
import { generateUniqueOrderNumber } from '../lib/atlassian-order-number';
import { uploadToSFTP, isSFTPConfigured, getSFTPPublicURL } from '../src/lib/sftp';
import { join } from 'path';
import { existsSync } from 'fs';

export interface AtlassianOrderJobData {
  tenantId: string;
  folderPath?: string; // Default: 'AtlassianOrders'
  deleteAfterProcessing?: boolean; // Default: true
  reprocessOrderId?: string; // For reprocessing a specific order
}

export interface AtlassianOrderJobResult {
  success: boolean;
  processed: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * Process a single email and save to database
 */
async function processEmail(
  email: EmailMessage,
  tenantId: string
): Promise<{ success: boolean; error?: string; orderId?: string }> {
  try {
    // Check if already processed
    const existing = await db.atlassianOrder.findUnique({
      where: { emailMessageId: email.messageId },
    });

    if (existing) {
      console.log(`Email ${email.messageId} already processed. Skipping.`);
      return { success: false, error: 'Already processed' };
    }

    // Parse HTML email
    const htmlBody = email.htmlBody || email.textBody || '';
    if (!htmlBody) {
      return { success: false, error: 'No email body found' };
    }

    const parsed = parseAtlassianEmail(htmlBody, email.subject);

    // Check for potential duplicates based on full name
    let duplicateOfOrderId: string | null = null;
    let status = parsed.employeeData.isAddressMissing ? 'missing_address' : 'completed';

    if (parsed.employeeData.fullName) {
      const existingOrder = await db.atlassianOrder.findFirst({
        where: {
          tenantId,
          fullName: parsed.employeeData.fullName,
        },
        orderBy: {
          createdAt: 'desc', // Get the most recent matching order
        },
        select: {
          id: true,
          orderNumber: true,
          fullName: true,
          createdAt: true,
        },
      });

      if (existingOrder) {
        console.log(`⚠️  Potential duplicate detected: "${parsed.employeeData.fullName}" matches order ${existingOrder.orderNumber} (${existingOrder.id})`);
        duplicateOfOrderId = existingOrder.id;
        status = 'potential_duplicate';
      }
    }

    // Generate unique order number
    const orderNumber = await generateUniqueOrderNumber(tenantId);

    // Save to database
    const order = await db.atlassianOrder.create({
      data: {
        tenantId,
        orderNumber,
        emailMessageId: email.messageId,
        emailSubject: email.subject,
        emailFrom: email.from?.address || null,
        emailDate: email.date || null,
        emailBodyHtml: htmlBody,
        status,
        duplicateOfOrderId,

        // Employee data
        firstName: parsed.employeeData.firstName || null,
        lastName: parsed.employeeData.lastName || null,
        printName: parsed.employeeData.printName || null,
        fullName: parsed.employeeData.fullName || null,
        personalEmail: parsed.employeeData.personalEmail || null,
        workEmail: parsed.employeeData.workEmail || null,
        phoneNumber: parsed.employeeData.phoneNumber || null,
        address1: parsed.employeeData.address1 || null,
        address2: parsed.employeeData.address2 || null,
        address3: parsed.employeeData.address3 || null,
        city: parsed.employeeData.city || null,
        state: parsed.employeeData.state || null,
        zipCode: parsed.employeeData.zipCode || null,
        country: parsed.employeeData.country || null,
        countryCategory: parsed.employeeData.countryCategory || null,
        startDate: parsed.employeeData.startDate || null,
        manager: parsed.employeeData.manager || null,
        department: parsed.employeeData.department || null,
        location: parsed.employeeData.location || null,

        // Metadata
        rawEmail: email.rawEmail as any,
        parsedData: parsed.rawFields as any,
        processedAt: new Date(),
      },
    });

    console.log(`✓ Processed order for ${parsed.employeeData.fullName} (${order.id})`);

    // Generate PDF if printName is available
    if (parsed.employeeData.printName && orderNumber) {
      try {
        const pdfPath = await generateAtlassianWelcomePDF(
          parsed.employeeData.printName,
          orderNumber,
          parsed.employeeData.countryCategory || 'Unknown'
        );

        console.log(`✓ Generated PDF for ${parsed.employeeData.printName} (${orderNumber}): ${pdfPath}`);

        // Upload to SFTP if configured (only for USA and International US, and NOT duplicates/missing)
        let sftpUrl: string | null = null;
        const isExcludedStatus =
          status === 'potential_duplicate' ||
          status === 'missing_address';
        const shouldUploadToSFTP =
          !isExcludedStatus &&
          (parsed.employeeData.countryCategory === 'United States of America' ||
           parsed.employeeData.countryCategory === 'International US');

        if (isSFTPConfigured() && shouldUploadToSFTP) {
          try {
            // Convert API path to local file path
            // PDF path is in format: /api/atlassian-pdfs/filename.pdf
            const filename = pdfPath.split('/').pop();
            if (filename) {
              const decodedFilename = decodeURIComponent(filename);
              const publicDir = join(process.cwd(), '../../apps/web/public');
              const localFilePath = join(publicDir, 'atlassian-pdfs', decodedFilename);

              if (existsSync(localFilePath)) {
                console.log(`Uploading ${decodedFilename} to SFTP (atlassian folder) - ${parsed.employeeData.countryCategory}...`);
                await uploadToSFTP(localFilePath, decodedFilename, 'atlassian');
                sftpUrl = getSFTPPublicURL(decodedFilename, 'atlassian');
                console.log(`✓ PDF uploaded to SFTP: ${sftpUrl}`);
              } else {
                console.warn(`Local PDF file not found: ${localFilePath}`);
              }
            }
          } catch (sftpError) {
            console.error(`Failed to upload PDF to SFTP for order ${order.id}:`, sftpError);
            // Don't fail the entire processing if SFTP upload fails
          }
        } else if (isExcludedStatus) {
          console.log(`Skipping SFTP upload for order ${orderNumber} (status: ${status})`);
        } else if (!shouldUploadToSFTP) {
          console.log(`Skipping SFTP upload for ${parsed.employeeData.countryCategory} (only USA/International go to SFTP)`);
        }

        // Update order with PDF path and SFTP URL
        await db.atlassianOrder.update({
          where: { id: order.id },
          data: {
            pdfPath,
            ...(sftpUrl && { sftpUrl }),
          },
        });
      } catch (pdfError) {
        console.error(`Failed to generate PDF for order ${order.id}:`, pdfError);
        // Don't fail the entire processing if PDF generation fails
        // The order is still saved successfully
      }
    } else {
      console.warn(`No printName or orderNumber available for order ${order.id}, skipping PDF generation`);
    }

    return { success: true, orderId: order.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error processing email ${email.messageId}:`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Main worker logic
 */
async function processAtlassianOrders(job: Job<AtlassianOrderJobData>): Promise<AtlassianOrderJobResult> {
  const { tenantId, folderPath = 'AtlassianOrders', deleteAfterProcessing = true } = job.data;

  console.log(`Starting Atlassian orders processing for tenant ${tenantId}`);
  console.log(`Folder: ${folderPath}, Delete after processing: ${deleteAfterProcessing}`);

  const result: AtlassianOrderJobResult = {
    success: true,
    processed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    await withImapClient(tenantId, async (client) => {
      // Fetch unread emails from the folder
      console.log(`Fetching unread emails from ${folderPath}...`);
      const emails = await client.fetchUnreadEmails(folderPath);
      console.log(`Found ${emails.length} unread email(s)`);

      if (emails.length === 0) {
        console.log('No new emails to process');
        return;
      }

      // Process each email
      for (const email of emails) {
        console.log(`Processing email: ${email.subject} (${email.messageId})`);

        const processResult = await processEmail(email, tenantId);

        if (processResult.success) {
          result.processed++;

          // Mark as seen or delete
          if (deleteAfterProcessing) {
            await client.deleteEmail(folderPath, email.uid, false);
            console.log(`  → Deleted email ${email.uid}`);
          } else {
            await client.markAsSeen(folderPath, email.uid);
            console.log(`  → Marked email ${email.uid} as seen`);
          }
        } else if (processResult.error === 'Already processed') {
          result.skipped++;
          // Still mark as seen if already processed
          await client.markAsSeen(folderPath, email.uid);
        } else {
          result.failed++;
          result.errors.push(`${email.subject}: ${processResult.error}`);
          result.success = false;
        }
      }

      console.log(
        `✓ Processing complete: ${result.processed} processed, ${result.failed} failed, ${result.skipped} skipped`
      );
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in Atlassian orders worker:', error);
    result.success = false;
    result.errors.push(errorMessage);
  }

  return result;
}

/**
 * Create and export the worker
 */
export function atlassianOrdersWorker(connection: Redis): Worker<AtlassianOrderJobData, AtlassianOrderJobResult> {
  const worker = new Worker<AtlassianOrderJobData, AtlassianOrderJobResult>(
    'atlassian-orders',
    processAtlassianOrders,
    {
      connection,
      concurrency: 1, // Process one tenant at a time to avoid IMAP conflicts
      limiter: {
        max: 5, // Max 5 jobs per minute
        duration: 60000,
      },
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[Atlassian Orders] Job ${job.id} completed:`, result);
  });

  worker.on('failed', (job, error) => {
    console.error(`[Atlassian Orders] Job ${job?.id} failed:`, error);
  });

  worker.on('error', (error) => {
    console.error('[Atlassian Orders] Worker error:', error);
  });

  return worker;
}
