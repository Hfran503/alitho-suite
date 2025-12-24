import { NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/database';
import { createPaceJob, createPaceJobPart, updatePaceJobPart, createPaceJobComponent } from '@/lib/pace';

/**
 * POST /api/atlassian/orders/send-selected-to-pace
 * Send selected Atlassian orders to PACE grouped by country category
 * Creates one job per country category with multiple parts (one per order)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderIds } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'orderIds array is required' },
        { status: 400 }
      );
    }

    // Fetch the selected orders
    const eligibleOrders = await db.atlassianOrder.findMany({
      where: {
        id: { in: orderIds },
        status: { notIn: ['sent_to_pace', 'potential_duplicate', 'archived'] },
        duplicateOfOrderId: null,
        orderNumber: { not: null },
      },
      orderBy: {
        countryCategory: 'asc',
      },
    });

    if (eligibleOrders.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No eligible orders found. Orders must not be duplicates, archived, or already sent to PACE.',
      }, { status: 400 });
    }

    // Group orders by country category
    const ordersByCountry = eligibleOrders.reduce((acc: Record<string, typeof eligibleOrders>, order: (typeof eligibleOrders)[number]) => {
      const country = order.countryCategory || 'Unknown';
      if (!acc[country]) {
        acc[country] = [];
      }
      acc[country].push(order);
      return acc;
    }, {});

    const results: Record<string, {
      jobNumber?: string;
      ordersCount: number;
      totalAmount?: number;
      parts?: Array<{
        orderId: string;
        orderNumber: string | null;
        partNumber: string;
        success: boolean;
        error?: string;
      }>;
      success?: boolean;
      error?: string;
    }> = {};
    let totalJobsCreated = 0;
    let totalOrdersProcessed = 0;

    // Process each country category
    for (const [countryCategory, orders] of Object.entries(ordersByCountry)) {
      try {
        const orderList = orders as typeof eligibleOrders;
        console.log(`Processing ${orderList.length} orders for ${countryCategory}`);

        // Build job description listing all orders
        const orderNumbers = orderList.map((o: (typeof orderList)[number]) => o.orderNumber).join(', ');
        // Use generic short description (≤50 chars) for description field
        const description = `Calitho Suite - ${countryCategory}`;
        // Place detailed info in description2 field
        const description2 = `Orders: ${orderNumbers}`;
        const totalAmount = orderList.length * 25;

        // Step 1: Create Job in PACE
        const jobData = {
          customer: 'ATL030',
          jobType: 5015,
          description,
          description2,
          amountToInvoice: totalAmount,
        };

        console.log(`Creating PACE job for ${countryCategory}:`, jobData);
        const jobResponse = await createPaceJob(jobData);
        console.log(`✓ PACE job created for ${countryCategory}:`, jobResponse);

        // Extract job number
        const paceJobNumber = jobResponse.job || jobResponse.id;
        if (!paceJobNumber) {
          throw new Error(`PACE did not return a job number for ${countryCategory}`);
        }

        console.log(`PACE generated job number for ${countryCategory}: ${paceJobNumber}`);

        // Step 2: Process each order as a separate JobPart
        const partResults: Array<{
          orderId: string;
          orderNumber: string | null;
          partNumber: string;
          success: boolean;
          error?: string;
        }> = [];

        for (let i = 0; i < orderList.length; i++) {
          const order = orderList[i];
          const partNumber = String(i + 1).padStart(2, '0'); // 01, 02, 03, etc.
          const printName = order.printName || order.firstName || 'Unknown';
          const partDescription = `Calitho Suite Order # ${order.orderNumber} - ${printName}`;

          try {
            let jobPartResponse;

            // PACE auto-creates part 01, so we update it. For parts 02+, we need to create them first
            if (partNumber === '01') {
              // Update the auto-created JobPart 01 with description and quotedPrice
              const jobPartUpdateData = {
                job: paceJobNumber,
                jobPart: partNumber,
                description: partDescription,
                quotedPrice: 25,
              };

              console.log(`Updating JobPart ${partNumber} for order ${order.orderNumber}`);
              jobPartResponse = await updatePaceJobPart(jobPartUpdateData);
            } else {
              // Create new JobPart for parts 02, 03, etc.
              const jobPartCreateData = {
                job: paceJobNumber,
                jobPart: partNumber,
                description: partDescription,
                qtyOrdered: 1,
              };

              console.log(`Creating JobPart ${partNumber} for order ${order.orderNumber}`);
              await createPaceJobPart(jobPartCreateData);

              // Now update it with quotedPrice
              const jobPartUpdateData = {
                job: paceJobNumber,
                jobPart: partNumber,
                quotedPrice: 25,
              };

              console.log(`Updating JobPart ${partNumber} quotedPrice`);
              jobPartResponse = await updatePaceJobPart(jobPartUpdateData);
            }

            // Create JobComponent
            const jobComponentData = {
              job: paceJobNumber,
              jobPart: partNumber,
              description: partDescription,
              qtyOrdered: 1,
            };

            console.log(`Creating JobComponent for part ${partNumber}`);
            const jobComponentResponse = await createPaceJobComponent(jobComponentData);

            // Update order in database
            await db.atlassianOrder.update({
              where: { id: order.id },
              data: {
                status: 'sent_to_pace',
                paceJobNumber: paceJobNumber,
                paceResponse: {
                  job: jobResponse,
                  jobPart: jobPartResponse,
                  jobComponent: jobComponentResponse,
                  partNumber,
                },
              },
            });

            partResults.push({
              orderId: order.id,
              orderNumber: order.orderNumber,
              partNumber,
              success: true,
            });

            totalOrdersProcessed++;
            console.log(`✓ Processed order ${order.orderNumber} as part ${partNumber}`);
          } catch (error) {
            console.error(`Error processing order ${order.orderNumber}:`, error);
            partResults.push({
              orderId: order.id,
              orderNumber: order.orderNumber,
              partNumber,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        results[countryCategory] = {
          jobNumber: paceJobNumber,
          ordersCount: orderList.length,
          totalAmount,
          parts: partResults,
        };

        totalJobsCreated++;
        console.log(`✓ Completed processing ${countryCategory}: Job ${paceJobNumber}`);
      } catch (error) {
        console.error(`Error processing country ${countryCategory}:`, error);
        const orderList = orders as typeof eligibleOrders;
        results[countryCategory] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          ordersCount: orderList.length,
        };
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${totalOrdersProcessed} orders into ${totalJobsCreated} job(s)`,
      data: {
        totalOrders: eligibleOrders.length,
        totalOrdersProcessed,
        jobsCreated: totalJobsCreated,
        ordersByCountry: Object.keys(ordersByCountry).reduce(
          (acc, key) => ({ ...acc, [key]: ordersByCountry[key].length }),
          {}
        ),
        results,
      },
    });
  } catch (error) {
    console.error('Error in send-selected-to-pace:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
