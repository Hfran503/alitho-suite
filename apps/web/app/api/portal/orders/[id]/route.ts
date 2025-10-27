import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { isCustomerRole } from '@/lib/roles'

// GET /api/portal/orders/[id] - Get single order details
export async function GET(
  _req: NextRequest,
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

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Await params in Next.js 15
    const { id } = await params

    // Fetch order with tenant verification
    const order = await db.order.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
        // Optional: Add customer email filter for extra security
        // customerEmail: session.user.email,
      },
      include: {
        items: true,
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ order })
  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    )
  }
}
