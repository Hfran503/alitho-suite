import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, Prisma } from '@repo/database'
import { z } from 'zod'
import { sendOrderDeliveredNotification, sendOrderCancelledNotification } from '@/lib/notifications/storefront-notifications'
import { updatePaceJobShipment } from '@/lib/pace'

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
            paceJobPart: true,
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
      select: {
        id: true,
        status: true,
        paceJobNumber: true,
        paceResponse: true,
        shipToName: true,
        shipToAddress1: true,
        shipToAddress2: true,
        shipToCity: true,
        shipToState: true,
        shipToZip: true,
        shipToCountry: true,
      },
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

    if (order.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot edit a cancelled order' },
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

    // Sync shipping address to PACE if order has been sent there
    let paceSyncResult: { success: boolean; error?: string } | null = null
    if (order.paceJobNumber) {
      // Check if any shipping address fields were updated
      const shippingFieldsUpdated =
        updateData.shipToName !== undefined ||
        updateData.shipToAddress1 !== undefined ||
        updateData.shipToAddress2 !== undefined ||
        updateData.shipToCity !== undefined ||
        updateData.shipToState !== undefined ||
        updateData.shipToZip !== undefined ||
        updateData.shipToCountry !== undefined

      if (shippingFieldsUpdated) {
        try {
          // Get the shipment ID from the stored PACE response
          const paceResponse = order.paceResponse as Record<string, any> | null
          const shipmentId = paceResponse?.jobShipment?.id || paceResponse?.jobShipment?.shipment

          if (shipmentId) {
            // Build update payload with only changed fields
            const paceUpdateData: {
              id: number
              name?: string
              address1?: string
              address2?: string
              city?: string
              state?: string
              zip?: string
            } = {
              id: shipmentId,
            }

            // Map local fields to PACE fields (use new values from updateData, falling back to existing)
            if (updateData.shipToName !== undefined) {
              paceUpdateData.name = updateData.shipToName || ''
            }
            if (updateData.shipToAddress1 !== undefined) {
              paceUpdateData.address1 = updateData.shipToAddress1 || ''
            }
            if (updateData.shipToAddress2 !== undefined) {
              paceUpdateData.address2 = updateData.shipToAddress2 || ''
            }
            if (updateData.shipToCity !== undefined) {
              paceUpdateData.city = updateData.shipToCity || ''
            }
            if (updateData.shipToState !== undefined) {
              paceUpdateData.state = updateData.shipToState || ''
            }
            if (updateData.shipToZip !== undefined) {
              paceUpdateData.zip = updateData.shipToZip || ''
            }
            // Note: country field excluded as it may cause issues with PACE

            console.log('Syncing shipping address to PACE:', paceUpdateData)
            await updatePaceJobShipment(paceUpdateData)
            console.log('PACE shipment updated successfully')
            paceSyncResult = { success: true }
          } else {
            console.warn('Cannot sync to PACE: No shipment ID found in paceResponse')
            paceSyncResult = { success: false, error: 'No shipment ID found' }
          }
        } catch (paceError) {
          console.error('Failed to sync shipping address to PACE:', paceError)
          paceSyncResult = {
            success: false,
            error: paceError instanceof Error ? paceError.message : 'PACE sync failed',
          }
          // Don't fail the request - local update succeeded
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      paceSync: paceSyncResult,
    })
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
        customer: {
          select: { id: true, name: true, email: true },
        },
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
    const updatedOrder = await db.$transaction(async (tx: Prisma.TransactionClient) => {
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

    // Send order delivered/shipped notification (async, don't wait)
    sendOrderDeliveredNotification(membership.tenantId, {
      orderNumber: order.orderNumber,
      customerName: order.customer?.name || order.shipToName || 'Customer',
      customerEmail: order.customer?.email || undefined,
      items: updatedOrder.items.map((i: any) => ({
        name: i.item?.name || 'Unknown Item',
        sku: i.item?.sku || i.item?.itemCode,
        quantity: i.quantity,
        referenceNumber: i.referenceNumber || undefined,
      })),
      shippingAddress: {
        name: order.shipToName || undefined,
        address1: order.shipToAddress1 || undefined,
        city: order.shipToCity || undefined,
        state: order.shipToState || undefined,
        zip: order.shipToZip || undefined,
      },
      trackingNumber: trackingNumber || undefined,
      carrier: carrier || undefined,
    }).catch((err) => console.error('Failed to send order shipped notification:', err))

    return NextResponse.json({ success: true, data: updatedOrder })
  } catch (error) {
    console.error('Error shipping order:', error)
    const message = error instanceof Error ? error.message : 'Failed to ship order'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/warehouse/storefront-orders/[id] - Cancel order
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
      include: {
        customer: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            item: { select: { id: true, name: true, sku: true, itemCode: true } },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status === 'SHIPPED') {
      return NextResponse.json(
        { error: 'Cannot cancel a shipped order' },
        { status: 400 }
      )
    }

    if (order.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Order is already cancelled' },
        { status: 400 }
      )
    }

    // Release reserved stock and update order status to CANCELLED
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
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

      // Update order status to CANCELLED instead of deleting
      await tx.storefrontOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
      })
    })

    // Send order cancelled notification (async, don't wait)
    sendOrderCancelledNotification(membership.tenantId, {
      orderNumber: order.orderNumber,
      customerName: order.customer?.name || order.shipToName || 'Customer',
      customerEmail: order.customer?.email || undefined,
      items: order.items.map((i: any) => ({
        name: i.item?.name || 'Unknown Item',
        sku: i.item?.sku || i.item?.itemCode,
        quantity: i.quantity,
        referenceNumber: i.referenceNumber || undefined,
      })),
      shippingAddress: {
        name: order.shipToName || undefined,
        address1: order.shipToAddress1 || undefined,
        city: order.shipToCity || undefined,
        state: order.shipToState || undefined,
        zip: order.shipToZip || undefined,
      },
    }).catch((err) => console.error('Failed to send order cancelled notification:', err))

    return NextResponse.json({
      success: true,
      message: 'Order cancelled',
    })
  } catch (error) {
    console.error('Error cancelling storefront order:', error)
    return NextResponse.json(
      { error: 'Failed to cancel order' },
      { status: 500 }
    )
  }
}
