import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import type { JobShipment } from '@repo/types'
import { getPaceApiCredentials } from '@/lib/secrets'

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

    // Get PACE API credentials from AWS Secrets Manager or environment
    let paceApiUrl: string
    let paceUsername: string
    let pacePassword: string

    try {
      const credentials = await getPaceApiCredentials()
      paceApiUrl = credentials.url
      paceUsername = credentials.username
      pacePassword = credentials.password
    } catch (error) {
      console.error('Failed to get PACE API credentials:', error)
      return NextResponse.json(
        {
          error: 'PACE API not configured',
          message: error instanceof Error ? error.message : 'Failed to get PACE API credentials'
        },
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

// PATCH /api/pace/shipments/[id] - Update shipment address
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const { id: shipmentId } = await params
    const body = await req.json()
    const { address } = body

    if (!address) {
      return NextResponse.json({ error: 'Address data is required' }, { status: 400 })
    }

    const credentials = await getPaceApiCredentials()
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    // Update the shipment in PACE
    const updateData: any = {}
    if (address.city) updateData.shipCity = address.city
    if (address.state) updateData.shipState = address.state
    if (address.zip) updateData.shipZip = address.zip
    if (address.street1) updateData.shipStreet = address.street1
    if (address.street2) updateData.shipStreet2 = address.street2

    const paceUrl = `${credentials.url}/UpdateObject/updateJobShipment`
    const response = await fetch(paceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        id: parseInt(shipmentId),
        ...updateData,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PACE update shipment error:', errorText)
      return NextResponse.json(
        { error: 'Failed to update shipment in PACE', details: errorText },
        { status: response.status }
      )
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('Update shipment error:', error)
    return NextResponse.json(
      { error: 'Failed to update shipment', message: error.message },
      { status: 500 }
    )
  }
}
