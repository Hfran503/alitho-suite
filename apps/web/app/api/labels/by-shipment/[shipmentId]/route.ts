import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

/**
 * GET /api/labels/by-shipment/[shipmentId] - Get all labels for a specific shipment
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shipmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Await params before accessing properties
    const { shipmentId: shipmentIdParam } = await params
    const shipmentId = parseInt(shipmentIdParam)

    if (isNaN(shipmentId)) {
      return NextResponse.json({ error: 'Invalid shipment ID' }, { status: 400 })
    }

    // Fetch only ACTIVE labels from database for this shipment
    const labels = await db.shippingLabel.findMany({
      where: {
        tenantId: membership.tenantId,
        paceShipmentId: shipmentId,
        status: 'active', // Only fetch active labels, exclude voided/refunded
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Separate outbound and return labels (both are already active)
    const outboundLabels = labels.filter(l => !l.isReturnLabel)
    const returnLabels = labels.filter(l => l.isReturnLabel)

    return NextResponse.json({
      success: true,
      data: {
        labels,
        outboundLabels,
        returnLabels,
      },
    })
  } catch (error: any) {
    console.error('Get shipment labels error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch labels', details: error.message },
      { status: 500 }
    )
  }
}
