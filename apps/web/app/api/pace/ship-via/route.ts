import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// GET /api/pace/ship-via - Fetch all active ShipVia options from PACE
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

    // Query all ShipVia options (filter by active after fetching details)
    const queryParams = new URLSearchParams({
      type: 'ShipVia',
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
        { error: 'Failed to fetch ship via options from PACE API', details: errorText },
        { status: response.status }
      )
    }

    const shipViaIds: number[] = await response.json()
    console.log(`Found ${shipViaIds.length} ship via options`)

    // Fetch details for each ship via option (including provider ID)
    const fetchShipViaDetail = async (id: number) => {
      try {
        const detailResponse = await fetch(
          `${paceApiUrl}/ReadObject/readShipVia?primaryKey=${encodeURIComponent(id)}`,
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
          const shipViaDetail = await detailResponse.json()
          return {
            id: shipViaDetail.id,
            description: shipViaDetail.description || `Ship Via ${id}`,
            active: shipViaDetail.active !== false,
            providerId: shipViaDetail.provider || null,
          }
        }
      } catch (err) {
        console.error(`Error fetching ship via ${id}:`, err)
      }
      return null
    }

    // Fetch ShipProvider details
    const fetchProviderDetail = async (providerId: number) => {
      try {
        const detailResponse = await fetch(
          `${paceApiUrl}/ReadObject/readShipProvider?primaryKey=${encodeURIComponent(providerId)}`,
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
          const providerDetail = await detailResponse.json()
          return {
            id: providerDetail.id,
            name: providerDetail.name || `Provider ${providerId}`,
          }
        }
      } catch (err) {
        console.error(`Error fetching provider ${providerId}:`, err)
      }
      return null
    }

    // Fetch all ShipVia details in parallel
    const shipViaResults = await Promise.all(shipViaIds.map(fetchShipViaDetail))
    // Filter to only active options and remove nulls
    const activeShipVias = shipViaResults.filter((r): r is NonNullable<typeof r> => r !== null && r.active === true)

    // Get unique provider IDs and fetch their details
    const uniqueProviderIds = [...new Set(activeShipVias.map(sv => sv.providerId).filter((id): id is number => id !== null))]
    const providerResults = await Promise.all(uniqueProviderIds.map(fetchProviderDetail))
    const providerMap = new Map<number, string>()
    for (const provider of providerResults) {
      if (provider) {
        providerMap.set(provider.id, provider.name)
      }
    }

    // Combine ShipVia with Provider name
    const shipViaOptions = activeShipVias.map(sv => ({
      id: sv.id,
      description: sv.description,
      active: sv.active,
      providerId: sv.providerId,
      providerName: sv.providerId ? providerMap.get(sv.providerId) || null : null,
    }))

    // Sort by provider name, then description
    shipViaOptions.sort((a, b) => {
      const providerCompare = (a.providerName || '').localeCompare(b.providerName || '')
      if (providerCompare !== 0) return providerCompare
      return a.description.localeCompare(b.description)
    })

    return NextResponse.json({
      success: true,
      data: {
        items: shipViaOptions,
        total: shipViaOptions.length,
      },
    })
  } catch (error) {
    console.error('Get ship via options error:', error)

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
