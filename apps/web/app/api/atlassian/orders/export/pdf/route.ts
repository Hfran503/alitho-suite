import { NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/database';
import { PDFDocument } from 'pdf-lib';

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
    const ordersWithPdf = orders.filter((o) => o.pdfPath);

    if (ordersWithPdf.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No PDFs found for orders in this job' },
        { status: 404 }
      );
    }

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    // Fetch and merge each PDF
    for (const order of ordersWithPdf) {
      try {
        // Fetch the PDF from the URL
        const pdfResponse = await fetch(order.pdfPath!);

        if (!pdfResponse.ok) {
          console.error(`Failed to fetch PDF for order ${order.orderNumber}: ${pdfResponse.status}`);
          continue;
        }

        const pdfBytes = await pdfResponse.arrayBuffer();

        // Load the PDF document
        const pdfDoc = await PDFDocument.load(pdfBytes);

        // Copy all pages from this PDF to the merged document
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());

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
