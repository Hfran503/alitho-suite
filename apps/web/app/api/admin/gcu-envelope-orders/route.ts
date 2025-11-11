import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { isStaffRole } from '@/lib/roles'

export async function GET(_req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify staff role (admin/manager access)
    const userRole = (session.user as any).role
    if (!isStaffRole(userRole)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Fetch all orders across all tenants, sorted by newest first
    const orders = await db.gcuEnvelopeOrder.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        tenant: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      orders,
    })
  } catch (error) {
    console.error('Error fetching GCU envelope orders (admin):', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}
