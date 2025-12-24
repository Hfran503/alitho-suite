import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, Prisma } from '@repo/database'
import { z } from 'zod'
import { isCustomerRole } from '@/lib/roles'

const createOrderSchema = z.object({
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
    unitPrice: z.number().optional(),
    isBulkOrder: z.boolean().optional(),
    referenceNumber: z.string().optional(),
    lotNumber: z.string().optional(),
    notes: z.string().optional(),
  })).min(1, 'At least one item is required'),
})

// Generate order number
async function generateOrderNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PO-${year}-` // PO = Portal Order

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

// GET /api/portal/storefront-orders - List customer's storefront orders
export async function GET(request: NextRequest) {
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
    const customer = await db.warehouseCustomer.findFirst({
      where: { tenantId, paceCustomerId: user.paceCustomerId },
      select: { id: true },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const myOrdersOnly = searchParams.get('myOrders') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause - filter by customer ID
    const where: any = {
      tenantId,
      customerId: customer.id,
    }

    if (status) {
      where.status = status
    }

    // Filter to only show orders created by the current user
    if (myOrdersOnly) {
      where.createdById = session.user.id
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
    const ordersWithTotals = orders.map((order: (typeof orders)[number]) => ({
      ...order,
      totalItems: order.items.reduce((sum: number, item: (typeof order.items)[number]) => sum + item.quantity, 0),
    }))

    return NextResponse.json({
      success: true,
      data: ordersWithTotals,
      pagination: { total, limit, offset },
    })
  } catch (error) {
    console.error('Error listing portal storefront orders:', error)
    return NextResponse.json(
      { error: 'Failed to list orders' },
      { status: 500 }
    )
  }
}

// POST /api/portal/storefront-orders - Create new storefront order from portal
export async function POST(request: NextRequest) {
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
        { error: 'No PACE Customer ID associated with your account. Please contact support.' },
        { status: 400 }
      )
    }

    const tenantId = user.memberships[0]?.tenantId
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Find the customer by paceCustomerId
    const customer = await db.warehouseCustomer.findFirst({
      where: { tenantId, paceCustomerId: user.paceCustomerId, isActive: true },
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found in system. Please contact support.' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validation = createOrderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { notes, items, ...shippingAddress } = validation.data

    // Validate all items exist and belong to tenant (and optionally to this customer)
    const itemIds = [...new Set(items.map((i: (typeof items)[number]) => i.itemId))]
    const inventoryItems = await db.inventoryItem.findMany({
      where: {
        id: { in: itemIds },
        tenantId,
        isActive: true,
        // Items must either be global (no customer) or assigned to this customer
        OR: [
          { customerId: null },
          { customerId: customer.id },
        ],
      },
      select: { id: true, sku: true, name: true, itemCode: true },
    })

    if (inventoryItems.length !== itemIds.length) {
      const foundIds = inventoryItems.map((i: (typeof inventoryItems)[number]) => i.id)
      const missingIds = itemIds.filter((id: string) => !foundIds.includes(id))
      return NextResponse.json(
        { error: 'Some items not found or not available', missingIds },
        { status: 400 }
      )
    }

    // Check stock availability for each item
    type InventoryItemType = (typeof inventoryItems)[number]
    const itemsMap = new Map<string, InventoryItemType>(inventoryItems.map((i) => [i.id, i]))
    for (const item of items) {
      const stock = await db.inventoryStock.aggregate({
        where: {
          tenantId,
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
    const orderNumber = await generateOrderNumber(tenantId)

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
    const order = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create the order
      const newOrder = await tx.storefrontOrder.create({
        data: {
          orderNumber,
          tenantId,
          customerId: customer.id,
          status: 'CREATED',
          ...finalShippingAddress,
          notes,
          createdById: session.user.id,
          items: {
            create: items.map((item: (typeof items)[number]) => ({
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
            select: { id: true, name: true, company: true, paceCustomerId: true },
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
          tenantId,
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
    console.error('Error creating portal storefront order:', error)
    const message = error instanceof Error ? error.message : 'Failed to create order'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
