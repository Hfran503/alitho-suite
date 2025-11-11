import { NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/database';
import { createPaceJob, createPaceJobPart, updatePaceJobPart, createPaceJobComponent } from '@/lib/pace';

/**
 * POST /api/atlassian/orders/send-all-to-pace
 * Send all eligible Atlassian orders to PACE grouped by country category
 * Creates one job per country category with multiple parts (one per order)
 */
export async function POST(_request: NextRequest) {
  try {
    // Fetch all eligible orders (not already sent, not missing address)
    const eligibleOrders = await db.atlassianOrder.findMany({
      where: {
        OR: [
          { status: 'completed' },
          { status: 'pending' },
        ],
        NOT: {
          OR: [
            { status: 'sent_to_pace' },
            { status: 'missing_address' },
          ],
        },
        orderNumber: {
          not: null,
        },
      },
      orderBy: {
        countryCategory: 'asc',
      },
    });

    if (eligibleOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No eligible orders to send to PACE',
        data: {
          totalOrders: 0,
          jobsCreated: 0,
          ordersByCountry: {},
        },
      });
    }

    // Group orders by country category
    const ordersByCountry = eligibleOrders.reduce((acc: Record<string, typeof eligibleOrders>, order) => {
      const country = order.countryCategory || 'Unknown';
      if (!acc[country]) {
        acc[country] = [];
      }
      acc[country].push(order);
      return acc;
    }, {});

    const results: Record<string, any> = {};
    let totalJobsCreated = 0;
    let totalOrdersProcessed = 0;

    // Process each country category
    for (const [countryCategory, orders] of Object.entries(ordersByCountry)) {
      try {
        console.log(`Processing ${orders.length} orders for ${countryCategory}`);

        // Build job description listing all orders
        const orderNumbers = orders.map((o) => o.orderNumber).join(', ');
        // Use generic short description (≤50 chars) for description field
        const description = `Calitho Suite - ${countryCategory}`;
        // Place detailed info in description2 field
        const description2 = `Orders: ${orderNumbers}`;
        const totalAmount = orders.length * 25;

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
        const partResults = [];
        for (let i = 0; i < orders.length; i++) {
          const order = orders[i];
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
          ordersCount: orders.length,
          totalAmount,
          parts: partResults,
        };

        totalJobsCreated++;
        console.log(`✓ Completed processing ${countryCategory}: Job ${paceJobNumber}`);
      } catch (error) {
        console.error(`Error processing country ${countryCategory}:`, error);
        results[countryCategory] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          ordersCount: orders.length,
        };
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${totalOrdersProcessed} orders into ${totalJobsCreated} jobs`,
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
    console.error('Error in send-all-to-pace:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
