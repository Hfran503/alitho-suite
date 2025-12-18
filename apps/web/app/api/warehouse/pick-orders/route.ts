import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'
import { sendPickOrderCreatedNotification } from '@/lib/notifications/storefront-notifications'

type PickOrderStatus = 'DRAFT' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

const createPickOrderSchema = z.object({
  destination: z.string().min(1, 'Destination is required'),
  destinationNotes: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  notes: z.string().optional(),
  items: z.array(z.object({
    itemId: z.string().min(1, 'Item ID is required'),
    locationId: z.string().optional(),
    referenceNumber: z.string().optional(),
    lotNumber: z.string().optional(),
    requestedQty: z.number().int().positive('Quantity must be positive'),
    notes: z.string().optional(),
  })).min(1, 'At least one item is required'),
})

// Generate pick order number
async function generatePickOrderNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PICK-${year}-`

  // Find the highest number for this year
  const lastOrder = await db.pickOrder.findFirst({
    where: {
      tenantId,
      pickOrderNumber: { startsWith: prefix },
    },
    orderBy: { pickOrderNumber: 'desc' },
    select: { pickOrderNumber: true },
  })

  let nextNumber = 1
  if (lastOrder) {
    const lastNum = parseInt(lastOrder.pickOrderNumber.replace(prefix, ''), 10)
    if (!isNaN(lastNum)) {
      nextNumber = lastNum + 1
    }
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`
}

// GET /api/warehouse/pick-orders - List pick orders
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
    const status = searchParams.get('status') as PickOrderStatus | null
    const priority = searchParams.get('priority')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = { tenantId: membership.tenantId }

    if (status) {
      where.status = status
    }

    if (priority) {
      where.priority = priority
    }

    if (search) {
      where.OR = [
        { pickOrderNumber: { contains: search, mode: 'insensitive' } },
        { destination: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [pickOrders, total] = await Promise.all([
      db.pickOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          items: {
            include: {
              item: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  trackByReference: true,
                },
              },
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      db.pickOrder.count({ where }),
    ])

    // Calculate summary stats for each order
    const ordersWithStats = pickOrders.map(order => {
      const totalItems = order.items.length
      const pickedItems = order.items.filter(i => i.isPicked).length
      const totalRequestedQty = order.items.reduce((sum, i) => sum + i.requestedQty, 0)
      const totalPickedQty = order.items.reduce((sum, i) => sum + i.pickedQty, 0)

      return {
        ...order,
        stats: {
          totalItems,
          pickedItems,
          totalRequestedQty,
          totalPickedQty,
          progress: totalItems > 0 ? Math.round((pickedItems / totalItems) * 100) : 0,
        },
      }
    })

    return NextResponse.json({
      success: true,
      data: ordersWithStats,
      pagination: {
        total,
        limit,
        offset,
      },
    })
  } catch (error) {
    console.error('Error listing pick orders:', error)
    return NextResponse.json(
      { error: 'Failed to list pick orders' },
      { status: 500 }
    )
  }
}

// POST /api/warehouse/pick-orders - Create new pick order
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
    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validation = createPickOrderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { destination, destinationNotes, priority, notes, items } = validation.data

    // Validate all items exist
    const itemIds = [...new Set(items.map(i => i.itemId))]
    const inventoryItems = await db.inventoryItem.findMany({
      where: { id: { in: itemIds }, tenantId: membership.tenantId },
      select: { id: true, sku: true, name: true, trackByReference: true },
    })

    if (inventoryItems.length !== itemIds.length) {
      const foundIds = inventoryItems.map(i => i.id)
      const missingIds = itemIds.filter(id => !foundIds.includes(id))
      return NextResponse.json(
        { error: 'Some items not found', missingIds },
        { status: 400 }
      )
    }

    // Build items map for later use
    const itemsMap = new Map(inventoryItems.map(i => [i.id, i]))

    // Validate locations if specified
    const locationIds = items.map(i => i.locationId).filter(Boolean) as string[]
    if (locationIds.length > 0) {
      const locations = await db.warehouseLocation.findMany({
        where: { id: { in: locationIds }, tenantId: membership.tenantId },
      })
      if (locations.length !== locationIds.length) {
        return NextResponse.json(
          { error: 'Some locations not found' },
          { status: 400 }
        )
      }
    }

    // Check stock availability for each item
    for (const item of items) {
      const stockWhere: any = {
        tenantId: membership.tenantId,
        itemId: item.itemId,
      }
      if (item.locationId) stockWhere.locationId = item.locationId
      if (item.referenceNumber) stockWhere.referenceNumber = item.referenceNumber
      if (item.lotNumber) stockWhere.lotNumber = item.lotNumber

      const stock = await db.inventoryStock.aggregate({
        where: stockWhere,
        _sum: { available: true },
      })

      const available = stock._sum.available || 0
      if (available < item.requestedQty) {
        const invItem = itemsMap.get(item.itemId)
        return NextResponse.json(
          {
            error: `Insufficient stock for ${invItem?.sku || item.itemId}. Requested: ${item.requestedQty}, Available: ${available}`,
          },
          { status: 400 }
        )
      }
    }

    // Generate pick order number
    const pickOrderNumber = await generatePickOrderNumber(membership.tenantId)

    // Use transaction to create pick order and reserve stock
    const pickOrder = await db.$transaction(async (tx) => {
      // Create pick order with items
      const order = await tx.pickOrder.create({
        data: {
          pickOrderNumber,
          tenantId: membership.tenantId,
          status: 'PENDING',
          destination,
          destinationNotes,
          priority,
          notes,
          createdById: session.user.id,
          items: {
            create: items.map(item => ({
              itemId: item.itemId,
              locationId: item.locationId || null,
              referenceNumber: item.referenceNumber || null,
              lotNumber: item.lotNumber || null,
              requestedQty: item.requestedQty,
              notes: item.notes || null,
            })),
          },
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          items: {
            include: {
              item: {
                select: { id: true, sku: true, name: true },
              },
              location: {
                select: { id: true, barcode: true, name: true },
              },
            },
          },
        },
      })

      // Reserve stock for each item
      for (const item of items) {
        let remainingToReserve = item.requestedQty

        // Find stock records to reserve from (FIFO by createdAt)
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

      return order
    })

    // Send pick order created notification (async, don't wait)
    sendPickOrderCreatedNotification(membership.tenantId, {
      pickOrderNumber: pickOrder.pickOrderNumber,
      destination: pickOrder.destination,
      priority: pickOrder.priority,
      items: pickOrder.items.map((i: any) => ({
        name: i.item?.name || 'Unknown Item',
        sku: i.item?.sku,
        requestedQty: i.requestedQty,
        referenceNumber: i.referenceNumber || undefined,
      })),
      createdBy: pickOrder.createdBy?.name || pickOrder.createdBy?.email || 'Unknown',
      createdByEmail: pickOrder.createdBy?.email || undefined,
    }).catch((err) => console.error('Failed to send pick order notification:', err))

    return NextResponse.json({ success: true, data: pickOrder }, { status: 201 })
  } catch (error) {
    console.error('Error creating pick order:', error)
    const message = error instanceof Error ? error.message : 'Failed to create pick order'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
