import { db } from '@repo/database';
import { isSftpConfigured, uploadToSFTP, getSFTPPublicURL } from '@/lib/sftp';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Check if address is missing or a placeholder
 */
export function isAddressMissing(address?: string | null): boolean {
  if (!address || address.trim() === '') return true;

  const placeholderPatterns = [
    /\[address to be confirmed in workday prior to start date\]/i,
    /\[not available\]/i,
    /\[to be confirmed\]/i,
    /\[pending\]/i,
    /\[tbd\]/i,
    /to be determined/i,
    /n\/a/i,
  ];

  const trimmedAddress = address.trim();
  return placeholderPatterns.some((pattern) => pattern.test(trimmedAddress));
}

export interface AtlassianOrderData {
  tenantId: string;
  firstName?: string | null;
  lastName?: string | null;
  printName?: string | null;
  fullName?: string | null;
  personalEmail?: string | null;
  workEmail?: string | null;
  phoneNumber?: string | null;
  address1?: string | null;
  address2?: string | null;
  address3?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  countryCategory?: string | null;
  startDate?: string | null;
  manager?: string | null;
  department?: string | null;
  location?: string | null;
  isAddressMissing?: boolean;
  // Optional email metadata
  emailMessageId?: string | null;
  emailSubject?: string | null;
  emailFrom?: string | null;
  emailDate?: Date | null;
  emailBodyHtml?: string | null;
  rawEmail?: any;
  parsedData?: any;
}

/**
 * Check if an order with the same full name already exists
 */
export async function checkForDuplicate(
  tenantId: string,
  fullName: string | null | undefined
): Promise<string | null> {
  if (!fullName) return null;

  const existingOrder = await db.atlassianOrder.findFirst({
    where: {
      tenantId,
      fullName,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      orderNumber: true,
      fullName: true,
      createdAt: true,
    },
  });

  if (existingOrder) {
    console.log(
      `⚠️  Potential duplicate detected: "${fullName}" matches order ${existingOrder.orderNumber} (${existingOrder.id})`
    );
    return existingOrder.id;
  }

  return null;
}

/**
 * Generate unique order number in format CS501, CS502, etc.
 */
export async function generateUniqueOrderNumber(tenantId: string): Promise<string> {
  // Find the highest order number for this tenant
  const lastOrder = await db.atlassianOrder.findFirst({
    where: {
      tenantId,
      orderNumber: {
        not: null,
        startsWith: 'CS',
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      orderNumber: true,
    },
  });

  if (!lastOrder || !lastOrder.orderNumber) {
    return 'CS501';
  }

  // Extract number from CS501 format
  const match = lastOrder.orderNumber.match(/CS(\d+)/);
  if (match) {
    const nextNumber = parseInt(match[1], 10) + 1;
    return `CS${nextNumber}`;
  }

  return 'CS501';
}

/**
 * Create a new Atlassian order with duplicate checking
 */
export async function createAtlassianOrder(data: AtlassianOrderData) {
  // Check for duplicates
  const duplicateOfOrderId = await checkForDuplicate(data.tenantId, data.fullName);

  // Determine status
  let status = 'completed';
  if (duplicateOfOrderId) {
    status = 'potential_duplicate';
  } else if (data.isAddressMissing) {
    status = 'missing_address';
  }

  // Generate unique order number
  const orderNumber = await generateUniqueOrderNumber(data.tenantId);

  // Create order
  const order = await db.atlassianOrder.create({
    data: {
      tenantId: data.tenantId,
      orderNumber,
      status,
      duplicateOfOrderId,

      // Email metadata (optional)
      emailMessageId: data.emailMessageId || null,
      emailSubject: data.emailSubject || null,
      emailFrom: data.emailFrom || null,
      emailDate: data.emailDate || null,
      emailBodyHtml: data.emailBodyHtml || null,

      // Employee data
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      printName: data.printName || null,
      fullName: data.fullName || null,
      personalEmail: data.personalEmail || null,
      workEmail: data.workEmail || null,
      phoneNumber: data.phoneNumber || null,
      address1: data.address1 || null,
      address2: data.address2 || null,
      address3: data.address3 || null,
      city: data.city || null,
      state: data.state || null,
      zipCode: data.zipCode || null,
      country: data.country || null,
      countryCategory: data.countryCategory || null,
      startDate: data.startDate || null,
      manager: data.manager || null,
      department: data.department || null,
      location: data.location || null,

      // Metadata
      rawEmail: data.rawEmail as any,
      parsedData: data.parsedData as any,
      processedAt: new Date(),
    },
  });

  console.log(`✓ Created order for ${data.fullName} (${order.id})`);

  return order;
}

/**
 * Generate PDF for an order and optionally upload to SFTP
 */
export async function generatePDFForOrder(orderId: string) {
  const order = await db.atlassianOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (!order.printName || !order.orderNumber) {
    console.warn(`No printName or orderNumber for order ${orderId}, skipping PDF generation`);
    return;
  }

  // Import the PDF generator from shared package
  const { generateAtlassianWelcomePDF } = await import('@repo/shared');

  // Generate PDF
  const pdfPath = await generateAtlassianWelcomePDF(
    order.printName,
    order.orderNumber,
    order.countryCategory || 'Unknown'
  );

  console.log(`✓ Generated PDF for ${order.printName} (${order.orderNumber}): ${pdfPath}`);

  // Upload to SFTP if configured (only for USA and International US, and NOT duplicates)
  let sftpUrl: string | null = null;
  const isDuplicate = order.status === 'potential_duplicate';
  const shouldUploadToSFTP =
    !isDuplicate &&
    (order.countryCategory === 'United States of America' ||
      order.countryCategory === 'International US');

  if (isSftpConfigured() && shouldUploadToSFTP) {
    try {
      // Convert API path to local file path
      const filename = pdfPath.split('/').pop();
      if (filename) {
        const decodedFilename = decodeURIComponent(filename);
        const publicDir = join(process.cwd(), 'public');
        const localFilePath = join(publicDir, 'atlassian-pdfs', decodedFilename);

        if (existsSync(localFilePath)) {
          console.log(
            `Uploading ${decodedFilename} to SFTP (atlassian folder) - ${order.countryCategory}...`
          );
          await uploadToSFTP(localFilePath, decodedFilename, 'atlassian');
          sftpUrl = getSFTPPublicURL(decodedFilename, 'atlassian');
          console.log(`✓ PDF uploaded to SFTP: ${sftpUrl}`);
        } else {
          console.warn(`Local PDF file not found: ${localFilePath}`);
        }
      }
    } catch (sftpError) {
      console.error(`Failed to upload PDF to SFTP for order ${order.id}:`, sftpError);
      // Don't fail if SFTP upload fails
    }
  } else if (isDuplicate) {
    console.log(
      `Skipping SFTP upload for order ${order.orderNumber} (potential duplicate)`
    );
  } else if (!shouldUploadToSFTP) {
    console.log(
      `Skipping SFTP upload for ${order.countryCategory} (only USA/International go to SFTP)`
    );
  }

  // Update order with PDF path and SFTP URL
  await db.atlassianOrder.update({
    where: { id: orderId },
    data: {
      pdfPath,
      ...(sftpUrl && { sftpUrl }),
    },
  });

  return { pdfPath, sftpUrl };
}
