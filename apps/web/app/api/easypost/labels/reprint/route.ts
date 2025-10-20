import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEasyPostApiKey } from '@/lib/secrets'
import { db } from '@repo/database'

/**
 * POST /api/easypost/labels/reprint
 * Reprint a label for an EasyPost shipment
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
        { error: 'EasyPost shipment ID is required' },
        { status: 400 }
      )
    }

    const apiKey = await getEasyPostApiKey(membership.tenantId)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'EasyPost API key not configured' },
        { status: 500 }
      )
    }

    // Get the shipment details from EasyPost to retrieve the label URL
    const shipmentResponse = await fetch(
      `https://api.easypost.com/v2/shipments/${shipmentId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!shipmentResponse.ok) {
      const errorText = await shipmentResponse.text()
      console.error('EasyPost get shipment error:', errorText)
      return NextResponse.json(
        { error: 'Failed to retrieve shipment from EasyPost', details: errorText },
        { status: shipmentResponse.status }
      )
    }

    const shipmentData = await shipmentResponse.json()

    // Return the label URL from the postage label
    return NextResponse.json({
      success: true,
      data: {
        labelUrl: shipmentData.postage_label?.label_url,
        trackingNumber: shipmentData.tracking_code,
      },
    })
  } catch (error: any) {
    console.error('Reprint EasyPost label error:', error)
    return NextResponse.json(
      { error: 'Failed to reprint label', details: error.message },
      { status: 500 }
    )
  }
}
