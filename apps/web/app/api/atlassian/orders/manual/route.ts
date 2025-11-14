import { NextRequest, NextResponse } from 'next/server';
import { createAtlassianOrder, generatePDFForOrder, isAddressMissing } from '@/lib/atlassian-orders';
import { db } from '@repo/database';

/**
 * POST /api/atlassian/orders/manual
 * Manually create a new Atlassian order with duplicate checking
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Extract fields
    const {
      tenantId,
      firstName,
      lastName,
      printName,
      fullName,
      personalEmail,
      workEmail,
      phoneNumber,
      address1,
      address2,
      address3,
      city,
      state,
      zipCode,
      country,
      countryCategory,
      startDate,
      manager,
      department,
      location,
    } = body;

    // Get tenant ID (use provided or get first tenant)
    let targetTenantId = tenantId;

    if (!targetTenantId) {
      const tenant = await db.tenant.findFirst();
      if (!tenant) {
        return NextResponse.json(
          { error: 'No tenant found' },
          { status: 404 }
        );
      }
      targetTenantId = tenant.id;
    }

    // Validate required fields
    if (!fullName && !(firstName && lastName)) {
      return NextResponse.json(
        { error: 'Either fullName or both firstName and lastName are required' },
        { status: 400 }
      );
    }

    // Determine if address is missing
    const addressMissing = isAddressMissing(address1);

    // Create the order
    const order = await createAtlassianOrder({
      tenantId: targetTenantId,
      firstName,
      lastName,
      printName,
      fullName: fullName || `${firstName} ${lastName}`.trim(),
      personalEmail,
      workEmail,
      phoneNumber,
      address1,
      address2,
      address3,
      city,
      state,
      zipCode,
      country,
      countryCategory,
      startDate,
      manager,
      department,
      location,
      isAddressMissing: addressMissing,
    });

    // Generate PDF if we have printName
    if (order.printName) {
      try {
        await generatePDFForOrder(order.id);
      } catch (pdfError) {
        console.error(`Failed to generate PDF for order ${order.id}:`, pdfError);
        // Don't fail the entire request if PDF generation fails
      }
    }

    // Fetch the updated order with PDF paths
    const updatedOrder = await db.atlassianOrder.findUnique({
      where: { id: order.id },
      include: {
        duplicateOfOrder: {
          select: {
            id: true,
            orderNumber: true,
            fullName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
    });
  } catch (error) {
    console.error('Error creating manual order:', error);
    return NextResponse.json(
      {
        error: 'Failed to create order',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
