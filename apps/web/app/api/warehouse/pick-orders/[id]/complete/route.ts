import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, Prisma } from '@repo/database'
import { InventoryTransactionType } from '@prisma/client'
import { z } from 'zod'
import { sendPickOrderCompletedNotification } from '@/lib/notifications/storefront-notifications'

const completePickOrderSchema = z.object({
  notes: z.string().optional(),
})

// POST /api/warehouse/pick-orders/[id]/complete - Complete pick order and decrement inventory
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

    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Get pick order with items and creator
    const pickOrder = await db.pickOrder.findFirst({
      where: { id, tenantId: membership.tenantId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            location: { select: { id: true, barcode: true, name: true } },
          },
        },
      },
    })

    if (!pickOrder) {
      return NextResponse.json({ error: 'Pick order not found' }, { status: 404 })
    }

    // Can only complete IN_PROGRESS orders
    if (pickOrder.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: `Cannot complete pick order in status ${pickOrder.status}. Must be IN_PROGRESS.` },
        { status: 400 }
      )
    }

    // Check all items have been picked (pickedQty > 0 and location assigned)
    const unpickedItems = pickOrder.items.filter((item: (typeof pickOrder.items)[number]) => !item.isPicked || !item.locationId)
    if (unpickedItems.length > 0) {
      return NextResponse.json(
        {
          error: 'All items must be picked before completing',
          unpickedItems: unpickedItems.map((i: (typeof unpickedItems)[number]) => ({
            itemId: i.id,
            sku: i.item.sku,
            requestedQty: i.requestedQty,
            pickedQty: i.pickedQty,
            hasLocation: !!i.locationId,
          })),
        },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const validation = completePickOrderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { notes } = validation.data

    // Process in a transaction
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const transactionRecords: any[] = []

      for (const orderItem of pickOrder.items) {
        // Find the stock record
        const stockWhere: any = {
          tenantId: membership.tenantId,
          itemId: orderItem.itemId,
          locationId: orderItem.locationId!,
        }
        if (orderItem.referenceNumber) stockWhere.referenceNumber = orderItem.referenceNumber
        if (orderItem.lotNumber) stockWhere.lotNumber = orderItem.lotNumber

        const stock = await tx.inventoryStock.findFirst({ where: stockWhere })

        if (!stock) {
          throw new Error(`Stock not found for item ${orderItem.item.sku} at location ${orderItem.location?.barcode}`)
        }

        // Stock was reserved when pick order was created, so we decrement from reserved
        if (stock.reserved < orderItem.pickedQty) {
          throw new Error(
            `Insufficient reserved stock for ${orderItem.item.sku}. Reserved: ${stock.reserved}, Picked: ${orderItem.pickedQty}`
          )
        }

        const previousQty = stock.available + stock.reserved // Total before
        const newQty = stock.available + (stock.reserved - orderItem.pickedQty) // Total after

        // Decrement from reserved (stock leaves the warehouse)
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: { reserved: { decrement: orderItem.pickedQty } },
        })

        // Create transaction record with PICK type
        const txRecord = await tx.inventoryTransaction.create({
          data: {
            tenantId: membership.tenantId,
            itemId: orderItem.itemId,
            locationId: orderItem.locationId!,
            type: 'PICK' as InventoryTransactionType,
            quantity: -orderItem.pickedQty, // Negative because items are leaving
            previousQty,
            newQty,
            referenceType: 'PICK_ORDER',
            referenceId: pickOrder.id,
            referenceNumber: orderItem.referenceNumber,
            lotNumber: orderItem.lotNumber,
            userId: session.user.id,
            notes: `Pick order ${pickOrder.pickOrderNumber} - ${pickOrder.destination}${notes ? ` | ${notes}` : ''}`,
          },
        })

        transactionRecords.push({
          itemSku: orderItem.item.sku,
          itemName: orderItem.item.name,
          location: orderItem.location?.barcode,
          referenceNumber: orderItem.referenceNumber,
          pickedQty: orderItem.pickedQty,
          previousQty,
          newQty,
          transactionId: txRecord.id,
        })
      }

      // Update pick order status to COMPLETED
      const updatedOrder = await tx.pickOrder.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          notes: notes ? `${pickOrder.notes || ''}\n\nCompletion notes: ${notes}`.trim() : pickOrder.notes,
        },
        include: {
          items: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
              location: { select: { id: true, barcode: true, name: true } },
            },
          },
        },
      })

      return {
        pickOrder: updatedOrder,
        transactions: transactionRecords,
        summary: {
          totalItems: pickOrder.items.length,
          totalQuantityPicked: pickOrder.items.reduce((sum: number, i: (typeof pickOrder.items)[number]) => sum + i.pickedQty, 0),
          destination: pickOrder.destination,
          completedAt: updatedOrder.completedAt,
        },
      }
    })

    // Send pick order completed notification (async, don't wait)
    sendPickOrderCompletedNotification(membership.tenantId, {
      pickOrderNumber: pickOrder.pickOrderNumber,
      destination: pickOrder.destination,
      priority: pickOrder.priority,
      status: 'COMPLETED',
      items: result.pickOrder.items.map((i: any) => ({
        name: i.item?.name || 'Unknown Item',
        sku: i.item?.sku,
        requestedQty: i.requestedQty,
        pickedQty: i.pickedQty,
        referenceNumber: i.referenceNumber || undefined,
      })),
      createdBy: pickOrder.createdBy?.name || pickOrder.createdBy?.email || 'Unknown',
      createdByEmail: pickOrder.createdBy?.email || undefined,
      completedAt: result.summary.completedAt || undefined,
    }).catch((err) => console.error('Failed to send pick order completed notification:', err))

    return NextResponse.json({
      success: true,
      data: result.pickOrder,
      transactions: result.transactions,
      summary: result.summary,
    })
  } catch (error) {
    console.error('Error completing pick order:', error)
    const message = error instanceof Error ? error.message : 'Failed to complete pick order'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
