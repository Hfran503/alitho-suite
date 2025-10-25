import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

/**
 * POST /api/labels/reprint
 * Reprint a label by carton ID - retrieves from database
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const { cartonId } = body

    if (!cartonId) {
      return NextResponse.json(
        { error: 'Carton ID is required' },
        { status: 400 }
      )
    }

    // Find the shipping label in database
    // Allow active, delivered, or in_transit labels (exclude voided/refunded)
    const label = await db.shippingLabel.findFirst({
      where: {
        tenantId: membership.tenantId,
        paceCartonId: parseInt(cartonId),
        status: {
          notIn: ['voided', 'refunded'], // Exclude voided and refunded labels
        },
      },
      orderBy: {
        createdAt: 'desc', // Get the most recent label if there are multiple
      },
    })

    if (!label) {
      return NextResponse.json(
        { error: 'No label found for this carton' },
        { status: 404 }
      )
    }

    // Return the label URL
    return NextResponse.json({
      success: true,
      data: {
        labelUrl: label.labelUrl,
        trackingNumber: label.trackingNumber,
        carrier: label.carrier,
        service: label.service,
        provider: label.provider,
      },
    })
  } catch (error: any) {
    console.error('Reprint label error:', error)
    return NextResponse.json(
      { error: 'Failed to reprint label', details: error.message },
      { status: 500 }
    )
  }
}
