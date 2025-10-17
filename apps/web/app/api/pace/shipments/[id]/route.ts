import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import type { JobShipment } from '@repo/types'

// GET /api/pace/shipments/[id] - Get a single job shipment by primary key
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { id: shipmentId } = await params

    if (!shipmentId) {
      return NextResponse.json(
        { error: 'Shipment ID is required' },
        { status: 400 }
      )
    }

    // Get PACE API credentials from environment
    const paceApiUrl = process.env.PACE_API_URL
    const paceUsername = process.env.PACE_USERNAME
    const pacePassword = process.env.PACE_PASSWORD

    if (!paceApiUrl) {
      return NextResponse.json(
        { error: 'PACE API not configured. Please set PACE_API_URL in environment variables.' },
        { status: 500 }
      )
    }

    if (!paceUsername || !pacePassword) {
      return NextResponse.json(
        { error: 'PACE API credentials not configured. Please set PACE_USERNAME and PACE_PASSWORD.' },
        { status: 500 }
      )
    }

    // Prepare Basic Auth header
    const authHeader = `Basic ${Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')}`

    // Call PACE API to get shipment details
    const paceUrl = `${paceApiUrl}/ReadObject/readJobShipment?primaryKey=${shipmentId}`

    console.log('Fetching shipment from PACE:', {
      url: paceUrl,
      shipmentId,
    })

    const response = await fetch(paceUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
      body: '',
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PACE API error:', {
        status: response.status,
        statusText: response.statusText,
        url: paceUrl,
        response: errorText,
      })

      // Try to parse error message
      let errorMessage = `Failed to fetch shipment from PACE API (${response.status} ${response.statusText})`
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message === 'System License Expired') {
          errorMessage = 'PACE System License Expired. Please contact your PACE administrator to renew the license.'
        }
      } catch (e) {
        // Error text is not JSON, use default message
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details: errorText,
          status: response.status,
        },
        { status: response.status }
      )
    }

    const shipment: JobShipment = await response.json()

    return NextResponse.json({
      success: true,
      data: shipment,
    })
  } catch (error) {
    console.error('Get job shipment error:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
