import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/warehouse/inventory/item/[id]/pending-storefront-orders
// Get pending storefront orders that have reserved stock for this item
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

    // Find all items from CREATED (not yet shipped) storefront orders for this item
    const pendingItems = await db.storefrontOrderItem.findMany({
      where: {
        itemId,
        order: {
          tenantId: membership.tenantId,
          status: 'CREATED',
        },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            shipToName: true,
            shipToCity: true,
            shipToState: true,
            createdAt: true,
            customer: {
              select: {
                id: true,
                name: true,
                company: true,
              },
            },
          },
        },
      },
      orderBy: {
        order: {
          createdAt: 'desc',
        },
      },
    })

    // Group by storefront order and calculate reserved quantities
    const orderMap = new Map<string, {
      storefrontOrder: {
        id: string
        orderNumber: string
        status: string
        shipToName: string | null
        shipToCity: string | null
        shipToState: string | null
        createdAt: Date
        customer: {
          id: string
          name: string
          company: string | null
        }
      }
      items: Array<{
        id: string
        referenceNumber: string | null
        lotNumber: string | null
        quantity: number
      }>
      totalReserved: number
    }>()

    for (const item of pendingItems) {
      const existing = orderMap.get(item.orderId)
      if (existing) {
        existing.items.push({
          id: item.id,
          referenceNumber: item.referenceNumber,
          lotNumber: item.lotNumber,
          quantity: item.quantity,
        })
        existing.totalReserved += item.quantity
      } else {
        orderMap.set(item.orderId, {
          storefrontOrder: item.order,
          items: [{
            id: item.id,
            referenceNumber: item.referenceNumber,
            lotNumber: item.lotNumber,
            quantity: item.quantity,
          }],
          totalReserved: item.quantity,
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
    console.error('Error fetching pending storefront orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending storefront orders' },
      { status: 500 }
    )
  }
}
