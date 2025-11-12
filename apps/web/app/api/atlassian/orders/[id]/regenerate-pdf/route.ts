import { NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/database';
import { uploadToSFTP, isSftpConfigured, getSFTPPublicURL } from '@/lib/sftp';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * POST /api/atlassian/orders/[id]/regenerate-pdf
 * Regenerate the PDF for an existing Atlassian order with current data
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the order
    const order = await db.atlassianOrder.findUnique({
      where: { id },
    });

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: 'Order not found',
        },
        { status: 404 }
      );
    }

    // Import the PDF generator from shared package
    const { generateAtlassianWelcomePDF } = await import('@repo/shared');

    // Generate new PDF with current data
    const printName = order.printName || order.firstName || 'Employee';
    const orderNumber = order.orderNumber || 'Unknown';
    const countryCategory = order.countryCategory || 'International US';

    console.log(`🔄 Regenerating PDF for order ${orderNumber} (${id})...`);
    console.log(`   Print Name: ${printName}`);
    console.log(`   Country: ${countryCategory}`);

    const pdfPath = await generateAtlassianWelcomePDF(
      printName,
      orderNumber,
      countryCategory
    );

    // Upload to SFTP if configured (only for USA and International US)
    let sftpUrl: string | null = null;
    const shouldUploadToSFTP =
      countryCategory === 'United States of America' ||
      countryCategory === 'International US';

    if (isSftpConfigured() && shouldUploadToSFTP) {
      try {
        // Convert API path to local file path
        // PDF path is in format: /api/atlassian-pdfs/filename.pdf
        const filename = pdfPath.split('/').pop();
        if (filename) {
          const decodedFilename = decodeURIComponent(filename);
          const publicDir = join(process.cwd(), 'public');
          const localFilePath = join(publicDir, 'atlassian-pdfs', decodedFilename);

          if (existsSync(localFilePath)) {
            console.log(`Uploading ${decodedFilename} to SFTP (atlassian folder) - ${countryCategory}...`);
            await uploadToSFTP(localFilePath, decodedFilename, 'atlassian');
            sftpUrl = getSFTPPublicURL(decodedFilename, 'atlassian');
            console.log(`✓ PDF uploaded to SFTP: ${sftpUrl}`);
          } else {
            console.warn(`Local PDF file not found: ${localFilePath}`);
          }
        }
      } catch (sftpError) {
        console.error(`Failed to upload PDF to SFTP for order ${id}:`, sftpError);
        // Don't fail the entire regeneration if SFTP upload fails
      }
    } else if (!shouldUploadToSFTP) {
      console.log(`Skipping SFTP upload for ${countryCategory} (only USA/International go to SFTP)`);
    }

    // Update the order with the new PDF path and SFTP URL
    const updatedOrder = await db.atlassianOrder.update({
      where: { id },
      data: {
        pdfPath,
        sftpUrl,
      },
    });

    console.log(`✓ PDF regenerated successfully for order ${orderNumber}`);

    return NextResponse.json({
      success: true,
      data: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        pdfPath: updatedOrder.pdfPath,
        sftpUrl: updatedOrder.sftpUrl,
        printName: updatedOrder.printName,
      },
      message: 'PDF regenerated successfully',
    });
  } catch (error) {
    const resolvedParams = await params;
    console.error(`Error regenerating PDF for order ${resolvedParams.id}:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to regenerate PDF',
      },
      { status: 500 }
    );
  }
}
