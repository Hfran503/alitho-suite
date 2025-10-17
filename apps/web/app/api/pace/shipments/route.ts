import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { jobShipmentFilterSchema, type JobShipment } from '@repo/types'

// GET /api/pace/shipments - List job shipments with date filtering
export async function GET(req: NextRequest) {
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

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const job = searchParams.get('job') || undefined
    const customer = searchParams.get('customer') || undefined

    // Validate filters
    const filters = jobShipmentFilterSchema.parse({
      startDate,
      endDate,
      job,
      customer,
      page,
      pageSize,
    })

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

    // Build XPath query for PACE API
    const xpathConditions: string[] = []

    // Store date filters for client-side validation as fallback
    const dateFilters = {
      startTimestamp: filters.startDate ? new Date(filters.startDate).getTime() : null,
      endTimestamp: filters.endDate ? new Date(filters.endDate).getTime() : null,
    }

    // Add date filter to XPath query if present
    // NOTE: Don't use date filtering in XPath for now - PACE doesn't reliably support it
    // We'll fetch more records and filter client-side instead
    // if (filters.startDate && filters.endDate) {
    //   const startDate = filters.startDate.replace('Z', '').substring(0, 19)
    //   const endDate = filters.endDate.replace('Z', '').substring(0, 19)
    //   xpathConditions.push(`dateTime >= '${startDate}' and dateTime <= '${endDate}'`)
    // }

    // Add job filter
    if (filters.job) {
      // Wrap string values in single quotes for XPath
      xpathConditions.push(`@job = '${filters.job}'`)
    }

    // Add customer filter
    if (filters.customer) {
      // Using 'contains' for partial match
      xpathConditions.push(`contains(@customer, '${filters.customer}')`)
    }

    // Build final XPath query
    const xpath = xpathConditions.length > 0
      ? xpathConditions.join(' and ')
      : '@id > 0' // Default query to get all shipments

    // Calculate offset for pagination
    const resolvedPage = filters.page ?? 1
    const resolvedPageSize = filters.pageSize ?? pageSize
    const offset = 0 // We'll handle pagination after fetching and filtering locally

    // Prepare Basic Auth header
    const authHeader = `Basic ${Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')}`

    // Build query parameters for PACE API
    // Always fetch more records since PACE returns by ID order (oldest first)
    // We'll sort by date on the backend to show newest first
    const fetchLimit = 500 // Fetch enough to ensure we get recent shipments

    const queryParams = new URLSearchParams({
      type: 'JobShipment',
      xpath: xpath,
      offset: offset.toString(),
      limit: fetchLimit.toString(),
    })

    // Call PACE API using findSortAndLimit
    const paceUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${queryParams.toString()}`

    console.log('PACE API Request:', {
      url: paceUrl,
      xpath: xpath,
      offset,
      limit: fetchLimit,
      filters: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        startTimestamp: filters.startDate ? new Date(filters.startDate).getTime() : null,
        endTimestamp: filters.endDate ? new Date(filters.endDate).getTime() : null,
      }
    })

    // Try sorting by a date field with @ prefix and descending flag
    // This should get us the most recent shipments first
    const requestBody = [{ xpath: '@id', descending: true }]

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
      console.error('PACE API error:', {
        status: response.status,
        statusText: response.statusText,
        url: paceUrl,
        response: errorText,
      })
      return NextResponse.json(
        {
          error: `Failed to fetch shipments from PACE API (${response.status} ${response.statusText})`,
          details: errorText,
          status: response.status,
        },
        { status: response.status }
      )
    }

    // PACE returns array of primary keys (IDs)
    const shipmentIds: string[] = await response.json()

    console.log(`PACE returned ${shipmentIds.length} shipment IDs`)

    // Now fetch full details for each shipment
    const shipments: JobShipment[] = []

    for (const id of shipmentIds) {
      try {
        const detailResponse = await fetch(
          `${paceApiUrl}/ReadObject/readJobShipment?primaryKey=${id}`,
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
          const shipmentDetail = await detailResponse.json()

          // Normalise the response so we always have a `dateTime` field for the UI
          const rawDate =
            shipmentDetail.dateTime ?? shipmentDetail.date ?? shipmentDetail.shipDate
          if (rawDate) {
            shipmentDetail.dateTime = rawDate
          }

          // Client-side date filtering since PACE XPath doesn't support dateTime field
          if (dateFilters.startTimestamp || dateFilters.endTimestamp) {
            if (!rawDate) {
              continue
            }

            // PACE returns dates without timezone (e.g., '2025-10-17T16:18:00')
            // Parse as local time
            const shipmentDate = new Date(rawDate).getTime()

            if (dateFilters.startTimestamp && shipmentDate < dateFilters.startTimestamp) {
              continue // Skip this shipment
            }
            if (dateFilters.endTimestamp && shipmentDate > dateFilters.endTimestamp) {
              continue // Skip this shipment
            }
          }

          shipments.push(shipmentDetail)
        } else {
          const errorText = await detailResponse.text()
          console.error(`Error fetching shipment ${id}:`, {
            status: detailResponse.status,
            error: errorText,
          })
        }
      } catch (err) {
        console.error(`Error fetching shipment ${id}:`, err)
      }
    }

    console.log(`After filtering: ${shipments.length} shipments matched the criteria`)

    // Sort newest first for a predictable UI ordering
    shipments.sort((a, b) => {
      const aTime = a.dateTime ? new Date(a.dateTime).getTime() : 0
      const bTime = b.dateTime ? new Date(b.dateTime).getTime() : 0
      return bTime - aTime
    })

    const total = shipments.length
    const totalPages = Math.max(1, Math.ceil(total / resolvedPageSize))
    const adjustedPage = Math.min(resolvedPage, totalPages)
    const startIndex = (adjustedPage - 1) * resolvedPageSize
    const paginatedShipments = shipments.slice(startIndex, startIndex + resolvedPageSize)

    return NextResponse.json({
      success: true,
      data: {
        items: paginatedShipments,
        total,
        page: adjustedPage,
        pageSize: resolvedPageSize,
        totalPages,
      },
    })
  } catch (error) {
    console.error('Get job shipments error:', error)

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
