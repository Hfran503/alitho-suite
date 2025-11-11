import { NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/database';

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

    // Update the order with the new PDF path
    const updatedOrder = await db.atlassianOrder.update({
      where: { id },
      data: {
        pdfPath,
        // Clear SFTP URL since we have a new local PDF
        sftpUrl: null,
      },
    });

    console.log(`✓ PDF regenerated successfully for order ${orderNumber}`);

    return NextResponse.json({
      success: true,
      data: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        pdfPath: updatedOrder.pdfPath,
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
