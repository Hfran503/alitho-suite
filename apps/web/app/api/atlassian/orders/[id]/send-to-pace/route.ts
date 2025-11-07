import { NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/database';
import { createPaceJob, updatePaceJobPart, createPaceJobComponent } from '@/lib/pace';

/**
 * POST /api/atlassian/orders/[id]/send-to-pace
 * Send an Atlassian order to PACE as a new job
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

    // Check if order has required fields
    if (!order.orderNumber) {
      return NextResponse.json(
        {
          success: false,
          error: 'Order number is required',
        },
        { status: 400 }
      );
    }

    if (!order.printName && !order.firstName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Print name or first name is required',
        },
        { status: 400 }
      );
    }

    // Prepare job data for PACE
    const printName = order.printName || order.firstName || 'Unknown';
    // Use generic short description (≤50 chars) for description field
    const description = `Calitho Suite Order`;
    // Place detailed info in description2 field
    const description2 = `Order # ${order.orderNumber} - ${printName}`;

    const jobData = {
      customer: 'ATL030', // Customer ID
      jobType: 5015, // Job type
      description,
      description2,
      amountToInvoice: 25, // Fixed amount $25
    };

    console.log('Creating PACE job with data:', jobData);

    // Step 1: Create job in PACE (PACE auto-generates job number and creates JobPart 01)
    const jobResponse = await createPaceJob(jobData);
    console.log('✓ PACE job created successfully:', jobResponse);

    // Extract the generated job number from PACE response
    const paceJobNumber = jobResponse.job || jobResponse.id;
    if (!paceJobNumber) {
      throw new Error('PACE did not return a job number');
    }

    console.log(`PACE generated job number: ${paceJobNumber}`);

    const jobPartNumber = '01'; // PACE auto-creates part 01 when creating a job

    // Step 2: Update the auto-created JobPart 01 with description and quotedPrice
    const jobPartUpdateData = {
      job: paceJobNumber,
      jobPart: jobPartNumber,
      description,
      quotedPrice: 25, // $25
    };

    console.log('Updating PACE JobPart with data:', jobPartUpdateData);
    const jobPartResponse = await updatePaceJobPart(jobPartUpdateData);
    console.log('✓ PACE JobPart updated successfully:', jobPartResponse);

    // Step 3: Create JobComponent (referencing the auto-created part 01)
    const jobComponentData = {
      job: paceJobNumber,
      jobPart: jobPartNumber,
      description,
      qtyOrdered: 1, // Default quantity
    };

    console.log('Creating PACE JobComponent with data:', jobComponentData);
    const jobComponentResponse = await createPaceJobComponent(jobComponentData);
    console.log('✓ PACE JobComponent created successfully:', jobComponentResponse);

    const paceResponse = {
      job: jobResponse,
      jobPart: jobPartResponse,
      jobComponent: jobComponentResponse,
    };

    // Update order status and store PACE job number
    await db.atlassianOrder.update({
      where: { id },
      data: {
        status: 'sent_to_pace',
        paceJobNumber: paceJobNumber,
        paceResponse,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Order sent to PACE successfully',
      data: {
        orderId: id,
        orderNumber: order.orderNumber,
        paceJobNumber: paceJobNumber,
        paceResponse,
      },
    });
  } catch (error) {
    const resolvedParams = await params;
    console.error(`Error sending Atlassian order ${resolvedParams.id} to PACE:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
