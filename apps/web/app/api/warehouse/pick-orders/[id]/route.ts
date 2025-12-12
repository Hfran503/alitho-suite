import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

const updatePickOrderSchema = z.object({
  destination: z.string().min(1).optional(),
  destinationNotes: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  notes: z.string().optional(),
  status: z.enum(['DRAFT', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
})

const pickItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  locationId: z.string().min(1, 'Location ID is required'),
  referenceNumber: z.string().nullable().optional(),
  lotNumber: z.string().nullable().optional(),
  pickedQty: z.number().int().nonnegative('Picked quantity must be non-negative'),
})

// GET /api/warehouse/pick-orders/[id] - Get pick order details
export async function GET(
  _request: NextRequest,
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

    const { id } = await params

    const pickOrder = await db.pickOrder.findFirst({
      where: { id, tenantId: membership.tenantId },
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
                customer: {
                  select: {
                    id: true,
                    name: true,
                    company: true,
                  },
                },
              },
            },
            location: {
              select: {
                id: true,
                barcode: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!pickOrder) {
      return NextResponse.json({ error: 'Pick order not found' }, { status: 404 })
    }

    // Get stock for each item to help with picking
    // Check reserved stock first (new orders), fall back to available (legacy orders)
    const itemsWithStock = await Promise.all(
      pickOrder.items.map(async (orderItem) => {
        const baseWhere: any = {
          tenantId: membership.tenantId,
          itemId: orderItem.itemId,
        }

        // If reference number is specified, filter by it
        if (orderItem.referenceNumber) {
          baseWhere.referenceNumber = orderItem.referenceNumber
        }
        if (orderItem.lotNumber) {
          baseWhere.lotNumber = orderItem.lotNumber
        }

        // First try to find reserved stock
        const reservedStock = await db.inventoryStock.findMany({
          where: { ...baseWhere, reserved: { gt: 0 } },
          include: {
            location: {
              select: { id: true, barcode: true, name: true },
            },
          },
          orderBy: { reserved: 'desc' },
        })

        // If no reserved stock, fall back to available stock (legacy orders)
        if (reservedStock.length === 0) {
          const availableStock = await db.inventoryStock.findMany({
            where: { ...baseWhere, available: { gt: 0 } },
            include: {
              location: {
                select: { id: true, barcode: true, name: true },
              },
            },
            orderBy: { available: 'desc' },
          })

          return {
            ...orderItem,
            availableStock: availableStock.map(s => ({
              locationId: s.locationId,
              location: s.location,
              available: s.available,
              referenceNumber: s.referenceNumber,
              lotNumber: s.lotNumber,
            })),
          }
        }

        return {
          ...orderItem,
          availableStock: reservedStock.map(s => ({
            locationId: s.locationId,
            location: s.location,
            available: s.reserved, // Show reserved qty as "available" for picking
            referenceNumber: s.referenceNumber,
            lotNumber: s.lotNumber,
          })),
        }
      })
    )

    // Calculate stats
    const totalItems = pickOrder.items.length
    const pickedItems = pickOrder.items.filter(i => i.isPicked).length
    const totalRequestedQty = pickOrder.items.reduce((sum, i) => sum + i.requestedQty, 0)
    const totalPickedQty = pickOrder.items.reduce((sum, i) => sum + i.pickedQty, 0)

    return NextResponse.json({
      success: true,
      data: {
        ...pickOrder,
        items: itemsWithStock,
        stats: {
          totalItems,
          pickedItems,
          totalRequestedQty,
          totalPickedQty,
          progress: totalItems > 0 ? Math.round((pickedItems / totalItems) * 100) : 0,
        },
      },
    })
  } catch (error) {
    console.error('Error getting pick order:', error)
    return NextResponse.json(
      { error: 'Failed to get pick order' },
      { status: 500 }
    )
  }
}

// PUT /api/warehouse/pick-orders/[id] - Update pick order
export async function PUT(
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

    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const pickOrder = await db.pickOrder.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!pickOrder) {
      return NextResponse.json({ error: 'Pick order not found' }, { status: 404 })
    }

    // Can only update DRAFT or PENDING orders (except status changes)
    const body = await request.json()
    const validation = updatePickOrderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // Validate status transitions
    if (data.status) {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ['PENDING', 'CANCELLED'],
        PENDING: ['IN_PROGRESS', 'CANCELLED'],
        IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
        COMPLETED: [],
        CANCELLED: [],
      }

      const allowed = validTransitions[pickOrder.status] || []
      if (!allowed.includes(data.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${pickOrder.status} to ${data.status}` },
          { status: 400 }
        )
      }
    }

    // Cannot modify details if not DRAFT or PENDING
    const detailFields = ['destination', 'destinationNotes', 'priority', 'notes']
    const hasDetailChanges = detailFields.some(f => (data as any)[f] !== undefined)
    if (hasDetailChanges && !['DRAFT', 'PENDING'].includes(pickOrder.status)) {
      return NextResponse.json(
        { error: `Cannot modify details when status is ${pickOrder.status}` },
        { status: 400 }
      )
    }

    const updatedOrder = await db.pickOrder.update({
      where: { id },
      data,
      include: {
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

    return NextResponse.json({ success: true, data: updatedOrder })
  } catch (error) {
    console.error('Error updating pick order:', error)
    return NextResponse.json(
      { error: 'Failed to update pick order' },
      { status: 500 }
    )
  }
}

// PATCH /api/warehouse/pick-orders/[id] - Pick items (update picked quantities)
export async function PATCH(
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

    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const pickOrder = await db.pickOrder.findFirst({
      where: { id, tenantId: membership.tenantId },
      include: { items: true },
    })

    if (!pickOrder) {
      return NextResponse.json({ error: 'Pick order not found' }, { status: 404 })
    }

    // Can only pick items in PENDING or IN_PROGRESS status
    if (!['PENDING', 'IN_PROGRESS'].includes(pickOrder.status)) {
      return NextResponse.json(
        { error: `Cannot pick items when status is ${pickOrder.status}` },
        { status: 400 }
      )
    }

    const body = await request.json()
    console.log('PATCH pick order body:', JSON.stringify(body))

    const validation = pickItemSchema.safeParse(body)

    if (!validation.success) {
      console.log('PATCH validation failed:', JSON.stringify(validation.error.flatten()))
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { itemId, locationId, referenceNumber, lotNumber, pickedQty } = validation.data

    // Find the pick order item
    const orderItem = pickOrder.items.find(i => i.id === itemId)
    if (!orderItem) {
      return NextResponse.json({ error: 'Pick order item not found' }, { status: 404 })
    }

    // Validate picked quantity
    if (pickedQty > orderItem.requestedQty) {
      return NextResponse.json(
        { error: `Cannot pick more than requested (${orderItem.requestedQty})` },
        { status: 400 }
      )
    }

    // Verify stock at the specified location
    const stockWhere: any = {
      tenantId: membership.tenantId,
      itemId: orderItem.itemId,
      locationId,
    }
    if (referenceNumber) stockWhere.referenceNumber = referenceNumber
    if (lotNumber) stockWhere.lotNumber = lotNumber

    const stock = await db.inventoryStock.findFirst({ where: stockWhere })
    console.log('PATCH stock check:', JSON.stringify({ stockWhere, stock: stock ? { id: stock.id, available: stock.available, reserved: stock.reserved } : null }))

    if (!stock) {
      return NextResponse.json(
        { error: `No stock found at this location` },
        { status: 400 }
      )
    }

    // Check stock availability - use reserved if available, fall back to available for legacy orders
    const hasReservedStock = stock.reserved >= pickedQty
    const hasAvailableStock = stock.available >= pickedQty
    console.log('PATCH stock availability:', JSON.stringify({ pickedQty, hasReservedStock, hasAvailableStock }))

    if (!hasReservedStock && !hasAvailableStock) {
      return NextResponse.json(
        { error: `Insufficient stock. Reserved: ${stock.reserved}, Available: ${stock.available}` },
        { status: 400 }
      )
    }

    // Determine which stock to use (reserved takes priority)
    const useReserved = hasReservedStock

    // Update pick order item
    const updatedItem = await db.pickOrderItem.update({
      where: { id: itemId },
      data: {
        locationId,
        referenceNumber: referenceNumber || orderItem.referenceNumber,
        lotNumber: lotNumber || orderItem.lotNumber,
        pickedQty,
        isPicked: pickedQty >= orderItem.requestedQty,
        pickedAt: pickedQty >= orderItem.requestedQty ? new Date() : null,
      },
    })

    // If this was the first pick, change status to IN_PROGRESS
    if (pickOrder.status === 'PENDING') {
      await db.pickOrder.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
      })
    }

    // Check if all items are picked
    const allItems = await db.pickOrderItem.findMany({
      where: { pickOrderId: id },
    })
    const allPicked = allItems.every(i => i.isPicked)

    return NextResponse.json({
      success: true,
      data: updatedItem,
      allItemsPicked: allPicked,
    })
  } catch (error) {
    console.error('Error picking item:', error)
    return NextResponse.json(
      { error: 'Failed to pick item' },
      { status: 500 }
    )
  }
}

// DELETE /api/warehouse/pick-orders/[id] - Delete/Cancel pick order
export async function DELETE(
  _request: NextRequest,
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

    const allowedRoles = ['admin', 'full_admin', 'warehouse']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const pickOrder = await db.pickOrder.findFirst({
      where: { id, tenantId: membership.tenantId },
      include: { items: true },
    })

    if (!pickOrder) {
      return NextResponse.json({ error: 'Pick order not found' }, { status: 404 })
    }

    // Can only delete DRAFT orders, otherwise cancel
    if (pickOrder.status === 'DRAFT') {
      await db.pickOrder.delete({ where: { id } })
      return NextResponse.json({ success: true, message: 'Pick order deleted' })
    } else if (['PENDING', 'IN_PROGRESS'].includes(pickOrder.status)) {
      // Release reserved stock back to available
      await db.$transaction(async (tx) => {
        for (const item of pickOrder.items) {
          // Only release unpicked quantity
          const toRelease = item.requestedQty - item.pickedQty
          if (toRelease <= 0) continue

          // Find stock records to release (matching item/reference/lot)
          const stockWhere: any = {
            tenantId: membership.tenantId,
            itemId: item.itemId,
            reserved: { gt: 0 },
          }
          if (item.referenceNumber) stockWhere.referenceNumber = item.referenceNumber
          if (item.lotNumber) stockWhere.lotNumber = item.lotNumber

          let remainingToRelease = toRelease
          const stockRecords = await tx.inventoryStock.findMany({
            where: stockWhere,
            orderBy: { createdAt: 'asc' },
          })

          for (const stock of stockRecords) {
            if (remainingToRelease <= 0) break

            const releaseQty = Math.min(stock.reserved, remainingToRelease)
            await tx.inventoryStock.update({
              where: { id: stock.id },
              data: {
                available: { increment: releaseQty },
                reserved: { decrement: releaseQty },
              },
            })
            remainingToRelease -= releaseQty
          }
        }

        // Update order status
        await tx.pickOrder.update({
          where: { id },
          data: { status: 'CANCELLED' },
        })
      })

      return NextResponse.json({ success: true, message: 'Pick order cancelled' })
    } else {
      return NextResponse.json(
        { error: `Cannot delete/cancel pick order in status ${pickOrder.status}` },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error deleting pick order:', error)
    return NextResponse.json(
      { error: 'Failed to delete pick order' },
      { status: 500 }
    )
  }
}
