import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getShipStationApiKey } from '@/lib/secrets'
import { db } from '@repo/database'

/**
 * POST /api/shipstation/labels/reprint
 * Reprint a label for a ShipStation shipment
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
    const { shipmentId } = body

    if (!shipmentId) {
      return NextResponse.json(
        { error: 'ShipStation shipment ID is required' },
        { status: 400 }
      )
    }

    const apiKey = await getShipStationApiKey(membership.tenantId)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ShipStation API key not configured' },
        { status: 500 }
      )
    }

    // Get the shipment details from ShipStation to retrieve the label URL
    const shipmentResponse = await fetch(
      `https://api.shipengine.com/v1/labels/shipment/${shipmentId}`,
      {
        method: 'GET',
        headers: {
          'API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!shipmentResponse.ok) {
      const errorText = await shipmentResponse.text()
      console.error('ShipStation get label error:', errorText)
      return NextResponse.json(
        { error: 'Failed to retrieve label from ShipStation', details: errorText },
        { status: shipmentResponse.status }
      )
    }

    const labelData = await shipmentResponse.json()

    // Return the label URL
    return NextResponse.json({
      success: true,
      data: {
        labelUrl: labelData.label_download?.pdf || labelData.label_download?.href,
        trackingNumber: labelData.tracking_number,
      },
    })
  } catch (error: any) {
    console.error('Reprint ShipStation label error:', error)
    return NextResponse.json(
      { error: 'Failed to reprint label', details: error.message },
      { status: 500 }
    )
  }
}
