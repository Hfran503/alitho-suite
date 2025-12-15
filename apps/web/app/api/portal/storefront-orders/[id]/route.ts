import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { isCustomerRole } from '@/lib/roles'

// GET /api/portal/storefront-orders/[id] - Get storefront order details
export async function GET(
  _request: NextRequest,
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
    const customer = await db.warehouseCustomer.findFirst({
      where: { tenantId, paceCustomerId: user.paceCustomerId },
      select: { id: true },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const { id } = await params

    // Fetch the order - ensure it belongs to this customer
    const order = await db.storefrontOrder.findFirst({
      where: {
        id,
        tenantId,
        customerId: customer.id, // Ensure order belongs to this customer
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            company: true,
            paceCustomerId: true,
            email: true,
            phone: true,
          },
        },
        items: {
          include: {
            item: {
              select: {
                id: true,
                itemCode: true,
                sku: true,
                name: true,
                description: true,
                sellPrice: true,
                bulkSellPrice: true,
                canOrderInBulk: true,
                unitsPerBulk: true,
                bulkUnitName: true,
              },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Calculate totals
    const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0)
    const totalPrice = order.items.reduce((sum, item) => {
      const unitPrice = item.unitPrice
        ? Number(item.unitPrice)
        : item.item.sellPrice
          ? Number(item.item.sellPrice)
          : 0
      return sum + (unitPrice * item.quantity)
    }, 0)

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        totalItems,
        totalPrice,
      },
    })
  } catch (error) {
    console.error('Error fetching portal storefront order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    )
  }
}
