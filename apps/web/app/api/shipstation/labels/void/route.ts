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
      // Find carton with this ShipStation shipment ID
      const carton = await db.carton.findFirst({
        where: {
          u_shipstation_shipment_id: shipmentId,
        },
        select: {
          u_shipstation_label_id: true,
        },
      })

      if (carton?.u_shipstation_label_id) {
        voidedLabelId = carton.u_shipstation_label_id
      } else {
        return NextResponse.json(
          { error: 'Label not found for shipment ID' },
          { status: 404 }
        )
      }
    }

    // Void the label in ShipStation
    const voidResponse = await client.voidLabel(voidedLabelId)

    // Update cartons in database to mark as voided
    if (shipmentId) {
      await db.carton.updateMany({
        where: {
          u_shipstation_shipment_id: shipmentId,
        },
        data: {
          u_label_voided: true,
          u_label_voided_at: new Date(),
        },
      })
    } else if (labelId) {
      await db.carton.updateMany({
        where: {
          u_shipstation_label_id: labelId,
        },
        data: {
          u_label_voided: true,
          u_label_voided_at: new Date(),
        },
      })
    }

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
