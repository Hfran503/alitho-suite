import { NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/database';
import { PDFDocument } from 'pdf-lib';
import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';

/**
 * Try to find the PDF in multiple possible locations
 * This handles different deployment scenarios (local dev, Docker, standalone)
 */
async function findPdfPath(filename: string): Promise<string | null> {
  const possiblePaths = [
    // Standard Next.js path
    join(process.cwd(), 'public', 'atlassian-pdfs', filename),
    // Docker monorepo path
    join(process.cwd(), 'apps', 'web', 'public', 'atlassian-pdfs', filename),
    // Docker with /app prefix
    join('/app', 'apps', 'web', 'public', 'atlassian-pdfs', filename),
    // Standalone build path
    join('/app', 'public', 'atlassian-pdfs', filename),
  ];

  for (const path of possiblePaths) {
    try {
      await access(path, constants.R_OK);
      return path;
    } catch {
      // Try next path
    }
  }

  return null;
}

/**
 * Extract filename from pdfPath and read from filesystem
 * pdfPath format: /api/atlassian-pdfs/filename.pdf
 */
async function readPdfFromFilesystem(pdfPath: string): Promise<Buffer | null> {
  try {
    // Extract filename from path (e.g., /api/atlassian-pdfs/filename.pdf -> filename.pdf)
    const filename = pdfPath.split('/').pop();
    if (!filename) return null;

    const decodedFilename = decodeURIComponent(filename);

    // Find the file in possible locations
    const localPath = await findPdfPath(decodedFilename);
    if (!localPath) return null;

    // Read and return the file
    return await readFile(localPath);
  } catch {
    return null;
  }
}

/**
 * GET /api/atlassian/orders/export/pdf?paceJobNumber=XXX
 * Merge all PDFs for orders with the given PACE job number into a single PDF
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paceJobNumber = searchParams.get('paceJobNumber');

    if (!paceJobNumber) {
      return NextResponse.json(
        { success: false, error: 'paceJobNumber is required' },
        { status: 400 }
      );
    }

    // Fetch orders with the given PACE job number
    const orders = await db.atlassianOrder.findMany({
      where: {
        paceJobNumber,
        status: 'sent_to_pace',
      },
      select: {
        id: true,
        orderNumber: true,
        fullName: true,
        pdfPath: true,
        countryCategory: true,
      },
      orderBy: {
        orderNumber: 'asc',
      },
    });

    if (orders.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No orders found for this PACE job number' },
        { status: 404 }
      );
    }

    // Filter orders that have PDF paths
    const ordersWithPdf = orders.filter((o: (typeof orders)[number]) => !!o.pdfPath);

    if (ordersWithPdf.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No PDFs found for orders in this job' },
        { status: 404 }
      );
    }

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    // Read and merge each PDF from filesystem
    for (const order of ordersWithPdf) {
      try {
        // Read the PDF from filesystem
        const pdfBuffer = await readPdfFromFilesystem(order.pdfPath!);

        if (!pdfBuffer) {
          console.error(`Failed to read PDF for order ${order.orderNumber}: file not found`);
          continue;
        }

        // Load the PDF document
        const pdfDoc = await PDFDocument.load(pdfBuffer);

        // For Australia orders, only include page 1
        // For all other countries, include all pages
        const isAustralia = order.countryCategory === 'Australia';
        const pageIndices = isAustralia ? [0] : pdfDoc.getPageIndices();

        // Copy pages from this PDF to the merged document
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pageIndices);

        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
        });
      } catch (err) {
        console.error(`Error processing PDF for order ${order.orderNumber}:`, err);
        // Continue with other PDFs even if one fails
      }
    }

    // Check if we have any pages
    if (mergedPdf.getPageCount() === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to merge any PDFs' },
        { status: 500 }
      );
    }

    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save();

    // Return the merged PDF (convert Uint8Array to Buffer for NextResponse compatibility)
    return new NextResponse(Buffer.from(mergedPdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PACE_Job_${paceJobNumber}_Orders.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error merging PDFs:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
