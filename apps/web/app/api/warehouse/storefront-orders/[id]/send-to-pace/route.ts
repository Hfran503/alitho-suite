import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import {
  createPaceJob,
  createPaceJobPart,
  updatePaceJobPart,
  createPaceJobComponent,
  createPaceJobProduct,
  createPaceJobShipment,
  createPaceCarton,
  createPaceCartonContent,
} from '@/lib/pace'
import { z } from 'zod'

const sendToPaceSchema = z.object({
  shipDate: z.string().optional(),
  shipVia: z.number().optional(),
  shipmentType: z.number().optional(),
  specialInformation: z.string().optional(),
  force: z.boolean().optional(), // For testing: bypass "already sent" check
})

/**
 * POST /api/warehouse/storefront-orders/[id]/send-to-pace
 * Send a storefront order to PACE as a new job
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Check role permissions
    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Parse request body for shipment settings
    let body: z.infer<typeof sendToPaceSchema> = {}
    try {
      const rawBody = await request.json()
      body = sendToPaceSchema.parse(rawBody)
    } catch {
      // Body is optional, continue without it
    }

    // Fetch the order with customer, items, and shipping address
    const order = await db.storefrontOrder.findFirst({
      where: { id, tenantId: membership.tenantId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            company: true,
            paceCustomerId: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            isBulkOrder: true,
            referenceNumber: true,
            item: {
              select: {
                id: true,
                itemCode: true,
                sku: true,
                name: true,
                sellPrice: true,
                canOrderInBulk: true,
                unitsPerBulk: true,
                bulkUnitName: true,
              },
            },
          },
        },
      },
    })

    // Also get shipTo fields (these are direct on order, not in include)
    const orderWithShipTo = order ? {
      ...order,
      shipToName: order.shipToName as string | null,
      shipToAddress1: order.shipToAddress1 as string | null,
      shipToAddress2: order.shipToAddress2 as string | null,
      shipToCity: order.shipToCity as string | null,
      shipToState: order.shipToState as string | null,
      shipToZip: order.shipToZip as string | null,
      shipToCountry: order.shipToCountry as string | null,
    } : null

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check if already sent to PACE (unless force flag is set for testing)
    if (order.paceJobNumber && !body.force) {
      return NextResponse.json(
        { error: `Order already sent to PACE (Job #${order.paceJobNumber})` },
        { status: 400 }
      )
    }

    // Validate customer has PACE ID
    if (!order.customer.paceCustomerId) {
      return NextResponse.json(
        { error: 'Customer does not have a PACE Customer ID configured' },
        { status: 400 }
      )
    }

    // Calculate total amount from item prices
    let totalAmount = 0
    for (const item of order.items) {
      const unitPrice = item.unitPrice
        ? Number(item.unitPrice)
        : item.item.sellPrice
          ? Number(item.item.sellPrice)
          : 0
      totalAmount += unitPrice * item.quantity
    }

    // Prepare job data for PACE
    const description = `Storefront Order` // Short description (<=50 chars)
    const description2 = `Order # ${order.orderNumber}`

    const jobData = {
      customer: order.customer.paceCustomerId,
      jobType: 5015,
      description,
      description2,
      amountToInvoice: totalAmount,
    }

    console.log('Creating PACE job with data:', jobData)

    // Step 1: Create job in PACE (PACE auto-generates job number and creates JobPart 01)
    const jobResponse = await createPaceJob(jobData)
    console.log('PACE job created:', jobResponse)

    // Extract the generated job number
    const paceJobNumber = jobResponse.job || jobResponse.id
    if (!paceJobNumber) {
      throw new Error('PACE did not return a job number')
    }

    console.log(`PACE generated job number: ${paceJobNumber}`)

    const paceResponses: Record<string, unknown> = {
      job: jobResponse,
      jobProduct: null,
      jobParts: [],
      jobComponents: [],
    }

    // Step 2: Create a single JobProduct for this job
    const jobProductData = {
      job: paceJobNumber,
      jobProduct: '01', // Initial part number, PACE will return the actual ID
      description: `Order # ${order.orderNumber}`,
      qtyOrdered: order.items.length,
    }

    console.log('Creating PACE JobProduct:', jobProductData)
    const jobProductResponse = await createPaceJobProduct(jobProductData)
    console.log('PACE JobProduct created:', jobProductResponse)
    paceResponses.jobProduct = jobProductResponse

    // Extract the JobProduct ID returned by PACE (e.g., 65941)
    const jobProductId = jobProductResponse.jobProduct || jobProductResponse.id
    if (!jobProductId) {
      console.warn('PACE did not return a jobProduct ID, parts will not be linked to product')
    } else {
      console.log(`PACE JobProduct ID: ${jobProductId}`)
    }

    // Step 3: Create JobParts for each order item
    // PACE auto-creates part 01 when creating a job, so we update it for the first item
    // and create new parts for subsequent items
    for (let i = 0; i < order.items.length; i++) {
      const orderItem = order.items[i]
      const partNumber = String(i + 1).padStart(2, '0') // 01, 02, 03, etc.

      const itemName = orderItem.item.name
      const sku = orderItem.item.sku || orderItem.item.itemCode || ''
      const unitPrice = orderItem.unitPrice
        ? Number(orderItem.unitPrice)
        : orderItem.item.sellPrice
          ? Number(orderItem.item.sellPrice)
          : 0
      const lineTotal = unitPrice * orderItem.quantity

      // For bulk orders, qtyOrdered should be the bulk quantity (e.g., 2 cartons), not total units (96)
      const isBulk = orderItem.isBulkOrder && orderItem.item.canOrderInBulk && orderItem.item.unitsPerBulk
      const qtyOrdered = isBulk
        ? Math.round(orderItem.quantity / orderItem.item.unitsPerBulk!)
        : orderItem.quantity

      // Part description: SKU - Item Name (Single/Bulk for bulk-enabled items)
      let partDescription = `${sku} - ${itemName}`
      if (orderItem.item.canOrderInBulk) {
        const bulkUnitName = orderItem.item.bulkUnitName || 'Bulk'
        partDescription += orderItem.isBulkOrder ? ` (${bulkUnitName})` : ' (Single)'
      }
      partDescription = partDescription.substring(0, 50)

      if (i === 0) {
        // Update auto-created part 01 and link to JobProduct
        const updatePartData = {
          job: paceJobNumber,
          jobPart: partNumber,
          description: partDescription,
          qtyOrdered,
          quotedPrice: lineTotal,
          ...(jobProductId ? { jobProduct: jobProductId } : {}),
        }

        console.log(`Updating PACE JobPart ${partNumber}:`, updatePartData)
        const partResponse = await updatePaceJobPart(updatePartData)
        console.log(`JobPart ${partNumber} updated:`, partResponse)
        ;(paceResponses.jobParts as unknown[]).push({
          partNumber,
          action: 'update',
          response: partResponse,
        })
      } else {
        // Create new parts for items 2+ and link to JobProduct
        const createPartData = {
          job: paceJobNumber,
          jobPart: partNumber,
          description: partDescription,
          qtyOrdered,
          ...(jobProductId ? { jobProduct: jobProductId } : {}),
        }

        console.log(`Creating PACE JobPart ${partNumber}:`, createPartData)
        const createPartResponse = await createPaceJobPart(createPartData)
        console.log(`JobPart ${partNumber} created:`, createPartResponse)

        // Update with quotedPrice
        const updatePartData = {
          job: paceJobNumber,
          jobPart: partNumber,
          quotedPrice: lineTotal,
        }
        const updatePartResponse = await updatePaceJobPart(updatePartData)
        console.log(`JobPart ${partNumber} updated with price:`, updatePartResponse)
        ;(paceResponses.jobParts as unknown[]).push({
          partNumber,
          action: 'create',
          createResponse: createPartResponse,
          updateResponse: updatePartResponse,
        })
      }

      // Step 4: Create JobComponent for each part
      const componentData = {
        job: paceJobNumber,
        jobPart: partNumber,
        description: partDescription,
        qtyOrdered,
      }

      console.log(`Creating PACE JobComponent for part ${partNumber}:`, componentData)
      const componentResponse = await createPaceJobComponent(componentData)
      console.log(`JobComponent created:`, componentResponse)
      ;(paceResponses.jobComponents as unknown[]).push({
        partNumber,
        response: componentResponse,
      })

      // Step 4.5: Save the JobPart number on the order item for future reference
      await db.storefrontOrderItem.update({
        where: { id: orderItem.id },
        data: { paceJobPart: partNumber },
      })
      console.log(`Saved paceJobPart ${partNumber} on order item ${orderItem.id}`)
    }

    // Step 5: Create JobShipment
    // Start with minimal required field - just the job reference
    const shipmentData: Record<string, unknown> = {
      job: paceJobNumber,
    }

    // Add shipmentType if provided
    if (body.shipmentType) {
      shipmentData.shipmentType = body.shipmentType
    }

    // Add shipVia if provided
    if (body.shipVia) {
      shipmentData.shipVia = body.shipVia
    }

    // Add ship date if provided (PACE expects dateTime format)
    if (body.shipDate) {
      shipmentData.dateTime = `${body.shipDate}T00:00:00`
    }

    // Add shipping address from order
    // Note: Some PACE fields may have different naming conventions
    if (orderWithShipTo) {
      if (orderWithShipTo.shipToName) {
        shipmentData.name = orderWithShipTo.shipToName
      }
      if (orderWithShipTo.shipToAddress1) {
        shipmentData.address1 = orderWithShipTo.shipToAddress1
      }
      if (orderWithShipTo.shipToAddress2) {
        shipmentData.address2 = orderWithShipTo.shipToAddress2
      }
      if (orderWithShipTo.shipToCity) {
        shipmentData.city = orderWithShipTo.shipToCity
      }
      if (orderWithShipTo.shipToState) {
        shipmentData.state = orderWithShipTo.shipToState
      }
      if (orderWithShipTo.shipToZip) {
        shipmentData.zip = orderWithShipTo.shipToZip
      }
      // Note: Commenting out country as it might cause issues
      // if (orderWithShipTo.shipToCountry) {
      //   shipmentData.country = orderWithShipTo.shipToCountry
      // }
    }

    // Add special information if provided (custom UDF field - lowercase)
    if (body.specialInformation) {
      shipmentData.u_specialinformation = body.specialInformation
    }

    console.log('Creating PACE JobShipment:', shipmentData)
    const shipmentResponse = await createPaceJobShipment(shipmentData as Parameters<typeof createPaceJobShipment>[0])
    console.log('PACE JobShipment created:', shipmentResponse)
    paceResponses.jobShipment = shipmentResponse

    // Extract shipment ID for creating Carton
    const shipmentId = shipmentResponse.id || shipmentResponse.shipment
    if (!shipmentId) {
      console.warn('PACE did not return a shipment ID, cannot create Carton')
    } else {
      console.log(`PACE JobShipment ID: ${shipmentId}`)

      // Step 6: Create a single Carton for all items
      const cartonData = {
        shipment: shipmentId,
        quantity: 1,
        addDefaultContent: false, // Don't auto-create Job-level content, we'll add Part-level content manually
      }

      console.log('Creating PACE Carton:', cartonData)
      const cartonResponse = await createPaceCarton(cartonData)
      console.log('PACE Carton created:', cartonResponse)
      paceResponses.carton = cartonResponse

      // Extract carton ID for creating CartonContent
      const cartonId = cartonResponse.id || cartonResponse.carton
      if (!cartonId) {
        console.warn('PACE did not return a carton ID, cannot create CartonContent')
      } else {
        console.log(`PACE Carton ID: ${cartonId}`)

        // Step 7: Create CartonContent for each JobPart
        paceResponses.cartonContents = []
        for (let i = 0; i < order.items.length; i++) {
          const orderItem = order.items[i]
          const partNumber = String(i + 1).padStart(2, '0')

          // Calculate quantity for this content entry
          const isBulk = orderItem.isBulkOrder && orderItem.item.canOrderInBulk && orderItem.item.unitsPerBulk
          const qtyOrdered = isBulk
            ? Math.round(orderItem.quantity / orderItem.item.unitsPerBulk!)
            : orderItem.quantity

          const contentData = {
            carton: cartonId,
            jobPartKey: `${paceJobNumber}:${partNumber}`, // Link to specific JobPart (use only this, not job+jobPart separately)
            quantity: qtyOrdered,
          }

          console.log(`Creating PACE CartonContent for part ${partNumber}:`, contentData)
          const contentResponse = await createPaceCartonContent(contentData)
          console.log(`CartonContent created:`, contentResponse)
          ;(paceResponses.cartonContents as unknown[]).push({
            partNumber,
            response: contentResponse,
          })
        }
      }
    }

    // Update order with PACE job number
    await db.storefrontOrder.update({
      where: { id },
      data: {
        paceJobNumber,
        paceResponse: paceResponses as object,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Order sent to PACE successfully',
      data: {
        orderId: id,
        orderNumber: order.orderNumber,
        paceJobNumber,
        totalAmount,
        itemCount: order.items.length,
      },
    })
  } catch (error) {
    console.error('Error sending storefront order to PACE:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send order to PACE' },
      { status: 500 }
    )
  }
}
