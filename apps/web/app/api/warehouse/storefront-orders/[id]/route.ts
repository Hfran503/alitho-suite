import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

const shipOrderSchema = z.object({
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
})

const updateOrderSchema = z.object({
  shipToName: z.string().optional().nullable(),
  shipToAddress1: z.string().optional().nullable(),
  shipToAddress2: z.string().optional().nullable(),
  shipToCity: z.string().optional().nullable(),
  shipToState: z.string().optional().nullable(),
  shipToZip: z.string().optional().nullable(),
  shipToCountry: z.string().optional().nullable(),
  shipToPhone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

// GET /api/warehouse/storefront-orders/[id] - Get single order
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

    const order = await db.storefrontOrder.findFirst({
      where: { id, tenantId: membership.tenantId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
            phone: true,
            paceCustomerId: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            isBulkOrder: true,
            referenceNumber: true,
            lotNumber: true,
            notes: true,
            item: {
              select: {
                id: true,
                itemCode: true,
                sku: true,
                name: true,
                category: true,
                sellPrice: true,
                canOrderInBulk: true,
                bulkUnitName: true,
                unitsPerBulk: true,
                bulkSellPrice: true,
              },
            },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error('Error fetching storefront order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    )
  }
}

// PUT /api/warehouse/storefront-orders/[id] - Update order details (address, notes)
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

    // Check role permissions
    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics', 'customer_service']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const order = await db.storefrontOrder.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status === 'SHIPPED') {
      return NextResponse.json(
        { error: 'Cannot edit a shipped order' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validation = updateOrderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const updateData = validation.data

    const updatedOrder = await db.storefrontOrder.update({
      where: { id },
      data: updateData,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
            phone: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        items: {
          include: {
            item: {
              select: {
                id: true,
                itemCode: true,
                sku: true,
                name: true,
                category: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: updatedOrder })
  } catch (error) {
    console.error('Error updating storefront order:', error)
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    )
  }
}

// PATCH /api/warehouse/storefront-orders/[id] - Ship order (pull from inventory)
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

    // Check role permissions
    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const order = await db.storefrontOrder.findFirst({
      where: { id, tenantId: membership.tenantId },
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status === 'SHIPPED') {
      return NextResponse.json(
        { error: 'Order has already been shipped' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validation = shipOrderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { trackingNumber, carrier } = validation.data

    // Ship order in transaction: update status and pull from inventory
    const updatedOrder = await db.$transaction(async (tx) => {
      // For each item, move from reserved to actually pulled (decrement quantity)
      for (const orderItem of order.items) {
        let remainingToPull = orderItem.quantity

        const stockWhere: any = {
          tenantId: membership.tenantId,
          itemId: orderItem.itemId,
          reserved: { gt: 0 },
        }
        if (orderItem.referenceNumber) stockWhere.referenceNumber = orderItem.referenceNumber
        if (orderItem.lotNumber) stockWhere.lotNumber = orderItem.lotNumber

        const stockRecords = await tx.inventoryStock.findMany({
          where: stockWhere,
          orderBy: { createdAt: 'asc' },
        })

        for (const stock of stockRecords) {
          if (remainingToPull <= 0) break

          const toPull = Math.min(stock.reserved, remainingToPull)

          await tx.inventoryStock.update({
            where: { id: stock.id },
            data: {
              reserved: { decrement: toPull },
              // Note: available was already decremented when order was created
              // The items are now shipped out of the system
            },
          })

          // Create transaction record
          await tx.inventoryTransaction.create({
            data: {
              tenantId: membership.tenantId,
              itemId: orderItem.itemId,
              locationId: stock.locationId,
              type: 'SHIP',
              quantity: -toPull,
              previousQty: stock.reserved,
              newQty: stock.reserved - toPull,
              referenceType: 'ORDER',
              referenceId: order.id,
              referenceNumber: orderItem.referenceNumber || stock.referenceNumber,
              lotNumber: orderItem.lotNumber || stock.lotNumber,
              notes: `Shipped - Order ${order.orderNumber}`,
              userId: session.user.id,
            },
          })

          remainingToPull -= toPull
        }
      }

      // Update order status to SHIPPED
      const shipped = await tx.storefrontOrder.update({
        where: { id },
        data: {
          status: 'SHIPPED',
          shippedAt: new Date(),
          trackingNumber: trackingNumber || null,
          carrier: carrier || null,
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

      return shipped
    })

    return NextResponse.json({ success: true, data: updatedOrder })
  } catch (error) {
    console.error('Error shipping order:', error)
    const message = error instanceof Error ? error.message : 'Failed to ship order'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/warehouse/storefront-orders/[id] - Cancel/delete order
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

    // Check role permissions
    const allowedRoles = ['admin', 'full_admin', 'warehouse']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const order = await db.storefrontOrder.findFirst({
      where: { id, tenantId: membership.tenantId },
      include: { items: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status === 'SHIPPED') {
      return NextResponse.json(
        { error: 'Cannot delete a shipped order' },
        { status: 400 }
      )
    }

    // Release reserved stock and delete order in transaction
    await db.$transaction(async (tx) => {
      // Release reserved stock for each item
      for (const orderItem of order.items) {
        let remainingToRelease = orderItem.quantity

        const stockWhere: any = {
          tenantId: membership.tenantId,
          itemId: orderItem.itemId,
          reserved: { gt: 0 },
        }
        if (orderItem.referenceNumber) stockWhere.referenceNumber = orderItem.referenceNumber
        if (orderItem.lotNumber) stockWhere.lotNumber = orderItem.lotNumber

        const stockRecords = await tx.inventoryStock.findMany({
          where: stockWhere,
          orderBy: { createdAt: 'asc' },
        })

        for (const stock of stockRecords) {
          if (remainingToRelease <= 0) break

          const toRelease = Math.min(stock.reserved, remainingToRelease)

          await tx.inventoryStock.update({
            where: { id: stock.id },
            data: {
              reserved: { decrement: toRelease },
              available: { increment: toRelease },
            },
          })

          remainingToRelease -= toRelease
        }
      }

      // Delete the order (items cascade delete)
      await tx.storefrontOrder.delete({
        where: { id },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Order cancelled and deleted',
    })
  } catch (error) {
    console.error('Error deleting storefront order:', error)
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    )
  }
}
