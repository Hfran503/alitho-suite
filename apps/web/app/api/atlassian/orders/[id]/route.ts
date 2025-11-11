import { NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/database';

/**
 * GET /api/atlassian/orders/[id]
 * Fetch a specific Atlassian order by ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const order = await db.atlassianOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        emailMessageId: true,
        emailSubject: true,
        emailFrom: true,
        emailDate: true,
        status: true,
        firstName: true,
        lastName: true,
        fullName: true,
        printName: true,
        pdfPath: true,
        personalEmail: true,
        workEmail: true,
        phoneNumber: true,
        address1: true,
        address2: true,
        address3: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        countryCategory: true,
        startDate: true,
        manager: true,
        department: true,
        location: true,
        errorMessage: true,
        retryCount: true,
        createdAt: true,
        updatedAt: true,
        processedAt: true,
      },
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

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    const resolvedParams = await params;
    console.error(`Error fetching Atlassian order ${resolvedParams.id}:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/atlassian/orders/[id]
 * Update an Atlassian order
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Only allow updating certain fields
    const allowedFields = [
      'status',
      'firstName',
      'lastName',
      'fullName',
      'printName',
      'personalEmail',
      'workEmail',
      'phoneNumber',
      'address1',
      'address2',
      'address3',
      'city',
      'state',
      'zipCode',
      'country',
      'countryCategory',
      'startDate',
      'manager',
      'department',
      'location',
    ];

    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid fields to update',
        },
        { status: 400 }
      );
    }

    const updated = await db.atlassianOrder.update({
      where: { id },
      data: updateData,
    });

    console.log(`✓ Updated Atlassian order ${id}`);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    const resolvedParams = await params;
    console.error(`Error updating Atlassian order ${resolvedParams.id}:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/atlassian/orders/[id]
 * Delete an Atlassian order
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.atlassianOrder.delete({
      where: { id },
    });

    console.log(`✓ Deleted Atlassian order ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error) {
    const resolvedParams = await params;
    console.error(`Error deleting Atlassian order ${resolvedParams.id}:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
