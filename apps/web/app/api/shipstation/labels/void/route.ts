import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getShipStationClient } from '@/lib/shipstation'

// POST /api/shipstation/labels/void - Void/cancel shipping labels
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

    // Check if ShipStation integration is enabled
    const integration = await db.integration.findUnique({
      where: {
        tenantId_provider: {
          tenantId: membership.tenantId,
          provider: 'shipstation',
        },
      },
      select: {
        enabled: true,
      },
    })

    if (!integration?.enabled) {
      return NextResponse.json(
        { error: 'ShipStation integration is not enabled' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { labelId, shipmentId } = body

    if (!labelId && !shipmentId) {
      return NextResponse.json(
        { error: 'Either labelId or shipmentId is required' },
        { status: 400 }
      )
    }

    // Get ShipStation client
    const client = await getShipStationClient(membership.tenantId)

    let voidedLabelId = labelId

    // If shipmentId provided instead of labelId, look up the label
    if (!labelId && shipmentId) {
      // Find shipping label with this ShipStation shipment ID
      const shippingLabel = await db.shippingLabel.findFirst({
        where: {
          providerShipmentId: shipmentId,
          provider: 'shipstation',
        },
        select: {
          providerLabelId: true,
        },
      })

      if (shippingLabel?.providerLabelId) {
        voidedLabelId = shippingLabel.providerLabelId
      } else {
        return NextResponse.json(
          { error: 'Label not found for shipment ID' },
          { status: 404 }
        )
      }
    }

    // Void the label in ShipStation
    const voidResponse = await client.voidLabel(voidedLabelId)

    // Update ShippingLabel status in our tracking database
    try {
      await db.shippingLabel.updateMany({
        where: {
          tenantId: membership.tenantId,
          providerLabelId: voidedLabelId,
          status: 'active',
        },
        data: {
          status: 'voided',
        },
      })
    } catch (dbError) {
      console.error('Failed to update ShippingLabel status:', dbError)
    }

    return NextResponse.json({
      success: true,
      data: {
        approved: voidResponse.approved,
        message: voidResponse.message,
        labelId: voidedLabelId,
      },
    })
  } catch (error: any) {
    console.error('ShipStation void label error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to void shipping label' },
      { status: 500 }
    )
  }
}
