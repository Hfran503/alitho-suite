import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

const createOrderSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  // Shipping address (optional - will default to customer address)
  shipToName: z.string().optional(),
  shipToAddress1: z.string().optional(),
  shipToAddress2: z.string().optional(),
  shipToCity: z.string().optional(),
  shipToState: z.string().optional(),
  shipToZip: z.string().optional(),
  shipToCountry: z.string().optional(),
  shipToPhone: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    itemId: z.string().min(1, 'Item ID is required'),
    quantity: z.number().int().positive('Quantity must be positive'),
    unitPrice: z.number().optional(), // Price per unit at time of order
    isBulkOrder: z.boolean().optional(), // Whether ordered as bulk/case
    referenceNumber: z.string().optional(),
    lotNumber: z.string().optional(),
    notes: z.string().optional(),
  })).min(1, 'At least one item is required'),
})

// Generate order number
async function generateOrderNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `SO-${year}-`

  const lastOrder = await db.storefrontOrder.findFirst({
    where: {
      tenantId,
      orderNumber: { startsWith: prefix },
    },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  })

  let nextNumber = 1
  if (lastOrder) {
    const lastNum = parseInt(lastOrder.orderNumber.replace(prefix, ''), 10)
    if (!isNaN(lastNum)) {
      nextNumber = lastNum + 1
    }
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`
}

// GET /api/warehouse/storefront-orders - List storefront orders
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = { tenantId: membership.tenantId }

    if (status) {
      where.status = status
    }

    if (customerId) {
      where.customerId = customerId
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { shipToName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [orders, total] = await Promise.all([
      db.storefrontOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          customer: {
            select: { id: true, name: true, company: true, paceCustomerId: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          items: {
            include: {
              item: {
                select: { id: true, itemCode: true, sku: true, name: true },
              },
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      db.storefrontOrder.count({ where }),
    ])

    // Calculate totals for each order
    const ordersWithTotals = orders.map(order => ({
      ...order,
      totalItems: order.items.reduce((sum, item) => sum + item.quantity, 0),
    }))

    return NextResponse.json({
      success: true,
      data: ordersWithTotals,
      pagination: { total, limit, offset },
    })
  } catch (error) {
    console.error('Error listing storefront orders:', error)
    return NextResponse.json(
      { error: 'Failed to list orders' },
      { status: 500 }
    )
  }
}

// POST /api/warehouse/storefront-orders - Create new storefront order
export async function POST(request: NextRequest) {
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
    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics', 'customer_service']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validation = createOrderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { customerId, notes, items, ...shippingAddress } = validation.data

    // Verify customer exists and belongs to tenant
    const customer = await db.warehouseCustomer.findFirst({
      where: { id: customerId, tenantId: membership.tenantId },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 400 })
    }

    // Validate all items exist and belong to tenant
    const itemIds = [...new Set(items.map(i => i.itemId))]
    const inventoryItems = await db.inventoryItem.findMany({
      where: { id: { in: itemIds }, tenantId: membership.tenantId, isActive: true },
      select: { id: true, sku: true, name: true, itemCode: true },
    })

    if (inventoryItems.length !== itemIds.length) {
      const foundIds = inventoryItems.map(i => i.id)
      const missingIds = itemIds.filter(id => !foundIds.includes(id))
      return NextResponse.json(
        { error: 'Some items not found or inactive', missingIds },
        { status: 400 }
      )
    }

    // Check stock availability for each item
    const itemsMap = new Map(inventoryItems.map(i => [i.id, i]))
    for (const item of items) {
      const stock = await db.inventoryStock.aggregate({
        where: {
          tenantId: membership.tenantId,
          itemId: item.itemId,
          ...(item.referenceNumber ? { referenceNumber: item.referenceNumber } : {}),
          ...(item.lotNumber ? { lotNumber: item.lotNumber } : {}),
        },
        _sum: { available: true },
      })

      const available = stock._sum.available || 0
      if (available < item.quantity) {
        const invItem = itemsMap.get(item.itemId)
        return NextResponse.json(
          {
            error: `Insufficient stock for ${invItem?.itemCode || invItem?.sku || item.itemId}. Requested: ${item.quantity}, Available: ${available}`,
          },
          { status: 400 }
        )
      }
    }

    // Generate order number
    const orderNumber = await generateOrderNumber(membership.tenantId)

    // Use shipping address from request, or fall back to customer defaults
    const finalShippingAddress = {
      shipToName: shippingAddress.shipToName || customer.shipToName,
      shipToAddress1: shippingAddress.shipToAddress1 || customer.shipToAddress1,
      shipToAddress2: shippingAddress.shipToAddress2 || customer.shipToAddress2,
      shipToCity: shippingAddress.shipToCity || customer.shipToCity,
      shipToState: shippingAddress.shipToState || customer.shipToState,
      shipToZip: shippingAddress.shipToZip || customer.shipToZip,
      shipToCountry: shippingAddress.shipToCountry || customer.shipToCountry || 'US',
      shipToPhone: shippingAddress.shipToPhone || customer.shipToPhone,
    }

    // Create order with items and reserve stock in transaction
    const order = await db.$transaction(async (tx) => {
      // Create the order
      const newOrder = await tx.storefrontOrder.create({
        data: {
          orderNumber,
          tenantId: membership.tenantId,
          customerId,
          status: 'CREATED',
          ...finalShippingAddress,
          notes,
          createdById: session.user.id,
          items: {
            create: items.map(item => ({
              itemId: item.itemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice || null,
              isBulkOrder: item.isBulkOrder || false,
              referenceNumber: item.referenceNumber || null,
              lotNumber: item.lotNumber || null,
              notes: item.notes || null,
            })),
          },
        },
        include: {
          customer: {
            select: { id: true, name: true, company: true },
          },
          items: {
            include: {
              item: {
                select: { id: true, itemCode: true, sku: true, name: true },
              },
            },
          },
        },
      })

      // Reserve stock for each item (decrement available, increment reserved)
      for (const item of items) {
        let remainingToReserve = item.quantity

        const stockWhere: any = {
          tenantId: membership.tenantId,
          itemId: item.itemId,
          available: { gt: 0 },
        }
        if (item.referenceNumber) stockWhere.referenceNumber = item.referenceNumber
        if (item.lotNumber) stockWhere.lotNumber = item.lotNumber

        const stockRecords = await tx.inventoryStock.findMany({
          where: stockWhere,
          orderBy: { createdAt: 'asc' },
        })

        for (const stock of stockRecords) {
          if (remainingToReserve <= 0) break

          const toReserve = Math.min(stock.available, remainingToReserve)

          await tx.inventoryStock.update({
            where: { id: stock.id },
            data: {
              available: { decrement: toReserve },
              reserved: { increment: toReserve },
            },
          })

          remainingToReserve -= toReserve
        }
      }

      return newOrder
    })

    return NextResponse.json({ success: true, data: order }, { status: 201 })
  } catch (error) {
    console.error('Error creating storefront order:', error)
    const message = error instanceof Error ? error.message : 'Failed to create order'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
