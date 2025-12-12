import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/warehouse/inventory/item/[id]/pending-orders
// Get pending pick orders that have reserved stock for this item
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

    const { id: itemId } = await params

    // Find all unpicked items from PENDING or IN_PROGRESS pick orders for this item
    const pendingItems = await db.pickOrderItem.findMany({
      where: {
        itemId,
        isPicked: false,
        pickOrder: {
          tenantId: membership.tenantId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      },
      include: {
        pickOrder: {
          select: {
            id: true,
            pickOrderNumber: true,
            status: true,
            priority: true,
            destination: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        pickOrder: {
          createdAt: 'desc',
        },
      },
    })

    // Group by pick order and calculate reserved quantities
    const orderMap = new Map<string, {
      pickOrder: {
        id: string
        pickOrderNumber: string
        status: string
        priority: string
        destination: string
        createdAt: Date
      }
      items: Array<{
        id: string
        referenceNumber: string | null
        lotNumber: string | null
        requestedQty: number
        pickedQty: number
        reservedQty: number
      }>
      totalReserved: number
    }>()

    for (const item of pendingItems) {
      const reservedQty = item.requestedQty - item.pickedQty
      if (reservedQty <= 0) continue

      const existing = orderMap.get(item.pickOrderId)
      if (existing) {
        existing.items.push({
          id: item.id,
          referenceNumber: item.referenceNumber,
          lotNumber: item.lotNumber,
          requestedQty: item.requestedQty,
          pickedQty: item.pickedQty,
          reservedQty,
        })
        existing.totalReserved += reservedQty
      } else {
        orderMap.set(item.pickOrderId, {
          pickOrder: item.pickOrder,
          items: [{
            id: item.id,
            referenceNumber: item.referenceNumber,
            lotNumber: item.lotNumber,
            requestedQty: item.requestedQty,
            pickedQty: item.pickedQty,
            reservedQty,
          }],
          totalReserved: reservedQty,
        })
      }
    }

    const pendingOrders = Array.from(orderMap.values())
    const totalReserved = pendingOrders.reduce((sum, o) => sum + o.totalReserved, 0)

    return NextResponse.json({
      success: true,
      data: {
        pendingOrders,
        totalReserved,
        orderCount: pendingOrders.length,
      },
    })
  } catch (error) {
    console.error('Error fetching pending orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending orders' },
      { status: 500 }
    )
  }
}
