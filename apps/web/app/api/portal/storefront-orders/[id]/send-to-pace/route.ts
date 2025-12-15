import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { isCustomerRole } from '@/lib/roles'
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
})

/**
 * POST /api/portal/storefront-orders/[id]/send-to-pace
 * Send a portal storefront order to PACE as a new job
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

    // Verify customer role
    if (!isCustomerRole((session.user as any).role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get user's paceCustomerId and tenant
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        paceCustomerId: true,
        memberships: {
          select: { tenantId: true },
          take: 1,
        },
      },
    })

    if (!user?.paceCustomerId) {
      return NextResponse.json(
        { error: 'No PACE Customer ID associated with your account' },
        { status: 400 }
      )
    }

    const tenantId = user.memberships[0]?.tenantId
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Find the customer by paceCustomerId
    const warehouseCustomer = await db.warehouseCustomer.findFirst({
      where: { tenantId, paceCustomerId: user.paceCustomerId },
      select: { id: true },
    })

    if (!warehouseCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
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

    // Fetch the order - ensure it belongs to this customer
    const order = await db.storefrontOrder.findFirst({
      where: {
        id,
        tenantId,
        customerId: warehouseCustomer.id,
      },
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

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check if already sent to PACE
    if (order.paceJobNumber) {
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
    const description = `Portal Order`
    const description2 = `Order # ${order.orderNumber}`

    const jobData = {
      customer: order.customer.paceCustomerId,
      jobType: 5015,
      description,
      description2,
      amountToInvoice: totalAmount,
    }

    console.log('Creating PACE job with data:', jobData)

    // Step 1: Create job in PACE
    const jobResponse = await createPaceJob(jobData)
    console.log('PACE job created:', jobResponse)

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

    // Step 2: Create a single JobProduct
    const jobProductData = {
      job: paceJobNumber,
      jobProduct: '01',
      description: `Order # ${order.orderNumber}`,
      qtyOrdered: order.items.length,
    }

    console.log('Creating PACE JobProduct:', jobProductData)
    const jobProductResponse = await createPaceJobProduct(jobProductData)
    console.log('PACE JobProduct created:', jobProductResponse)
    paceResponses.jobProduct = jobProductResponse

    const jobProductId = jobProductResponse.jobProduct || jobProductResponse.id

    // Step 3: Create JobParts for each order item
    for (let i = 0; i < order.items.length; i++) {
      const orderItem = order.items[i]
      const partNumber = String(i + 1).padStart(2, '0')

      const itemName = orderItem.item.name
      const sku = orderItem.item.sku || orderItem.item.itemCode || ''
      const unitPrice = orderItem.unitPrice
        ? Number(orderItem.unitPrice)
        : orderItem.item.sellPrice
          ? Number(orderItem.item.sellPrice)
          : 0
      const lineTotal = unitPrice * orderItem.quantity

      const isBulk = orderItem.isBulkOrder && orderItem.item.canOrderInBulk && orderItem.item.unitsPerBulk
      const qtyOrdered = isBulk
        ? Math.round(orderItem.quantity / orderItem.item.unitsPerBulk!)
        : orderItem.quantity

      let partDescription = `${sku} - ${itemName}`
      if (orderItem.item.canOrderInBulk) {
        const bulkUnitName = orderItem.item.bulkUnitName || 'Bulk'
        partDescription += orderItem.isBulkOrder ? ` (${bulkUnitName})` : ' (Single)'
      }
      partDescription = partDescription.substring(0, 50)

      if (i === 0) {
        const updatePartData = {
          job: paceJobNumber,
          jobPart: partNumber,
          description: partDescription,
          qtyOrdered,
          quotedPrice: lineTotal,
          ...(jobProductId ? { jobProduct: jobProductId } : {}),
        }

        const partResponse = await updatePaceJobPart(updatePartData)
        ;(paceResponses.jobParts as unknown[]).push({
          partNumber,
          action: 'update',
          response: partResponse,
        })
      } else {
        const createPartData = {
          job: paceJobNumber,
          jobPart: partNumber,
          description: partDescription,
          qtyOrdered,
          ...(jobProductId ? { jobProduct: jobProductId } : {}),
        }

        const createPartResponse = await createPaceJobPart(createPartData)

        const updatePartData = {
          job: paceJobNumber,
          jobPart: partNumber,
          quotedPrice: lineTotal,
        }
        const updatePartResponse = await updatePaceJobPart(updatePartData)
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

      const componentResponse = await createPaceJobComponent(componentData)
      ;(paceResponses.jobComponents as unknown[]).push({
        partNumber,
        response: componentResponse,
      })
    }

    // Step 5: Create JobShipment
    const shipmentData: Record<string, unknown> = {
      job: paceJobNumber,
    }

    if (body.shipmentType) {
      shipmentData.shipmentType = body.shipmentType
    }

    if (body.shipVia) {
      shipmentData.shipVia = body.shipVia
    }

    if (body.shipDate) {
      shipmentData.dateTime = `${body.shipDate}T00:00:00`
    }

    if (order.shipToName) {
      shipmentData.name = order.shipToName
    }
    if (order.shipToAddress1) {
      shipmentData.address1 = order.shipToAddress1
    }
    if (order.shipToAddress2) {
      shipmentData.address2 = order.shipToAddress2
    }
    if (order.shipToCity) {
      shipmentData.city = order.shipToCity
    }
    if (order.shipToState) {
      shipmentData.state = order.shipToState
    }
    if (order.shipToZip) {
      shipmentData.zip = order.shipToZip
    }

    if (body.specialInformation) {
      shipmentData.u_specialinformation = body.specialInformation
    }

    console.log('Creating PACE JobShipment:', shipmentData)
    const shipmentResponse = await createPaceJobShipment(shipmentData as Parameters<typeof createPaceJobShipment>[0])
    console.log('PACE JobShipment created:', shipmentResponse)
    paceResponses.jobShipment = shipmentResponse

    const shipmentId = shipmentResponse.id || shipmentResponse.shipment
    if (shipmentId) {
      // Step 6: Create Carton
      const cartonData = {
        shipment: shipmentId,
        quantity: 1,
        addDefaultContent: false,
      }

      const cartonResponse = await createPaceCarton(cartonData)
      paceResponses.carton = cartonResponse

      const cartonId = cartonResponse.id || cartonResponse.carton
      if (cartonId) {
        // Step 7: Create CartonContent for each JobPart
        paceResponses.cartonContents = []
        for (let i = 0; i < order.items.length; i++) {
          const orderItem = order.items[i]
          const partNumber = String(i + 1).padStart(2, '0')

          const isBulk = orderItem.isBulkOrder && orderItem.item.canOrderInBulk && orderItem.item.unitsPerBulk
          const qtyOrdered = isBulk
            ? Math.round(orderItem.quantity / orderItem.item.unitsPerBulk!)
            : orderItem.quantity

          const contentData = {
            carton: cartonId,
            jobPartKey: `${paceJobNumber}:${partNumber}`,
            quantity: qtyOrdered,
          }

          const contentResponse = await createPaceCartonContent(contentData)
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
    console.error('Error sending portal order to PACE:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send order to PACE' },
      { status: 500 }
    )
  }
}
