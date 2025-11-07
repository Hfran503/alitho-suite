import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

/**
 * GET /api/debug/shipping-labels-status
 * Check the status of recent shipping labels
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      select: { tenantId: true },
    })

    if (!membership?.tenantId) {
      return NextResponse.json({ error: 'User has no tenant' }, { status: 400 })
    }

    // Get recent labels with their status
    const recentLabels = await db.shippingLabel.findMany({
      where: { tenantId: membership.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        trackingNumber: true,
        status: true,
        carrier: true,
        cost: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Count by status
    const statusCounts = await db.shippingLabel.groupBy({
      by: ['status'],
      where: { tenantId: membership.tenantId },
      _count: true,
    })

    return NextResponse.json({
      success: true,
      data: {
        recentLabels: recentLabels.map((label) => ({
          trackingNumber: label.trackingNumber,
          status: label.status,
          carrier: label.carrier,
          cost: label.cost?.toNumber() ?? null,
          createdAt: label.createdAt.toISOString(),
          updatedAt: label.updatedAt.toISOString(),
        })),
        statusCounts,
        summary: {
          total: recentLabels.length,
          active: recentLabels.filter((l: { status: string }) => l.status === 'active').length,
          voided: recentLabels.filter((l: { status: string }) => l.status === 'voided').length,
        },
      },
    })
  } catch (error: any) {
    console.error('[API] Debug shipping labels status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch shipping labels status' },
      { status: 500 }
    )
  }
}
