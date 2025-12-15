import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// GET /api/pace/shipment-types - Fetch all active ShipmentType options from PACE
export async function GET() {
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

    // Get PACE API credentials
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

    // Query all ShipmentType options
    const queryParams = new URLSearchParams({
      type: 'ShipmentType',
      xpath: '@id > 0',
      offset: '0',
      limit: '500',
    })

    const paceUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${queryParams.toString()}`

    // Sort by description ascending
    const requestBody = [{ xpath: '@description', descending: false }]

    const response = await fetch(paceUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PACE API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch shipment types from PACE API', details: errorText },
        { status: response.status }
      )
    }

    const shipmentTypeIds: number[] = await response.json()
    console.log(`Found ${shipmentTypeIds.length} shipment types`)

    // Fetch details for each shipment type
    const fetchShipmentTypeDetail = async (id: number) => {
      try {
        const detailResponse = await fetch(
          `${paceApiUrl}/ReadObject/readShipmentType?primaryKey=${encodeURIComponent(id)}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )

        if (detailResponse.ok) {
          const detail = await detailResponse.json()
          return {
            id: detail.id,
            description: detail.description || `Shipment Type ${id}`,
            active: detail.active !== false,
          }
        }
      } catch (err) {
        console.error(`Error fetching shipment type ${id}:`, err)
      }
      return null
    }

    // Fetch all details in parallel
    const results = await Promise.all(shipmentTypeIds.map(fetchShipmentTypeDetail))
    // Filter to only active options and remove nulls
    const activeTypes = results.filter((r): r is NonNullable<typeof r> => r !== null && r.active === true)

    // Sort by description
    activeTypes.sort((a, b) => a.description.localeCompare(b.description))

    return NextResponse.json({
      success: true,
      data: {
        items: activeTypes,
        total: activeTypes.length,
      },
    })
  } catch (error) {
    console.error('Get shipment types error:', error)

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
