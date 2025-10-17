import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { jobShipmentFilterSchema, type JobShipment } from '@repo/types'

// GET /api/pace/shipments/by-date - List job shipments with date filtering in XPath
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

    // Validate filters
    const filters = jobShipmentFilterSchema.parse({
      startDate,
      endDate,
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

    // Build XPath query for PACE API with date filtering
    //
    // ⚠️ PACE XPath LIMITATIONS & BUGS (extensively tested and confirmed):
    //
    // ❌ @dateTime - "Unknown field 'dateTime' on object 'JobShipment'"
    // ❌ @u_create_date - "Unknown field 'u_create_date' on object 'JobShipment'"
    // ❌ dateTime >= '...' - "Cannot convert children into a filter: dateTime"
    // ❌ substring(dateTime, ...) - "unknown or unsupported function: substring"
    // ❌ starts-with(dateTime, ...) - "Cannot convert children into a filter: dateTime"
    //
    // 🐛 CRITICAL BUG DISCOVERED:
    // @date field has INVERTED LOGIC:
    //   - @date = '2025-10-17' → Returns shipments with dateTime=null (planned/unshipped)
    //   - @date != '2025-10-17' → Returns shipments with actual dateTime values (shipped)
    //
    // 🎯 OPTIMIZED SOLUTION:
    // Use @date != '' to filter OUT planned shipments, getting only shipped items
    // Then filter server-side by dateTime for specific date range
    // This reduces fetched records significantly vs fetching all @id > 0

    const xpathConditions: string[] = []

    // Use inverted logic bug to get only shipped items (those with actual dateTime)
    // @date != '' filters out all null/planned shipments
    xpathConditions.push("@date != ''")

    // Build final XPath query
    const xpath = xpathConditions.join(' and ')

    // Store date filters for client-side filtering
    const dateFilters = {
      startTimestamp: filters.startDate ? new Date(filters.startDate).getTime() : null,
      endTimestamp: filters.endDate ? new Date(filters.endDate).getTime() : null,
    }

    // Calculate offset for pagination
    const resolvedPage = filters.page ?? 1
    const resolvedPageSize = filters.pageSize ?? pageSize
    const offset = 0 // Fetch from beginning since we filter client-side

    // Prepare Basic Auth header
    const authHeader = `Basic ${Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')}`

    // Build query parameters for PACE API
    // Fetch shipped items only (much smaller dataset than all 10000 records)
    // Most systems have far fewer shipped items than planned items
    const fetchLimit = 5000
    const queryParams = new URLSearchParams({
      type: 'JobShipment',
      xpath: xpath,
      offset: offset.toString(),
      limit: fetchLimit.toString(),
    })

    // Call PACE API using findSortAndLimit
    const paceUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${queryParams.toString()}`

    // Sort by @id descending to get most recent first
    const requestBody = [{ xpath: '@id', descending: true }]

    console.log('PACE API Request (Server-side Date Filtering):', {
      url: paceUrl,
      xpath: xpath,
      offset,
      limit: fetchLimit,
      requestBody: requestBody,
      filters: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        note: 'Using @date!=\'\' to get shipped items, filtering by dateTime server-side',
      }
    })

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

    // Fetch full details for each shipment in parallel batches
    const shipments: JobShipment[] = []
    let fetchErrors = 0
    let skippedByDate = 0
    const corruptedShipmentIds: string[] = []
    const failedShipmentIds: string[] = []

    // Process shipments in parallel batches for better performance
    const BATCH_SIZE = 50 // Fetch 50 shipments at a time in parallel
    const batches: string[][] = []

    for (let i = 0; i < shipmentIds.length; i += BATCH_SIZE) {
      batches.push(shipmentIds.slice(i, i + BATCH_SIZE))
    }

    console.log(`Processing ${shipmentIds.length} shipments in ${batches.length} batches of ${BATCH_SIZE}...`)

    // Helper function to fetch a single shipment
    const fetchShipmentDetail = async (id: string) => {
      try {
        const detailResponse = await fetch(
          `${paceApiUrl}/ReadObject/readJobShipment?primaryKey=${id}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: '',
          }
        )

        if (detailResponse.ok) {
          let shipmentDetail
          try {
            shipmentDetail = await detailResponse.json()
          } catch (jsonError) {
            return { id, error: 'json_parse_error' }
          }

          // Fix PACE API bug: description field sometimes comes as array instead of string
          if (shipmentDetail.description && Array.isArray(shipmentDetail.description)) {
            shipmentDetail.description = shipmentDetail.description.join('\n')
          }

          // Normalize the response
          const rawDate =
            shipmentDetail.dateTime ?? shipmentDetail.date ?? shipmentDetail.shipDate
          if (rawDate) {
            shipmentDetail.dateTime = rawDate
          }

          // Client-side date filtering
          if (dateFilters.startTimestamp || dateFilters.endTimestamp) {
            if (!rawDate) {
              return { id, skipped: true }
            }

            const shipmentDate = new Date(rawDate).getTime()

            if (dateFilters.startTimestamp && shipmentDate < dateFilters.startTimestamp) {
              return { id, skipped: true }
            }
            if (dateFilters.endTimestamp && shipmentDate > dateFilters.endTimestamp) {
              return { id, skipped: true }
            }
          }

          return { id, shipment: shipmentDetail }
        } else {
          const errorText = await detailResponse.text()

          // Check if it's the known description field bug
          if (errorText.includes('description') && errorText.includes('ClassCastException')) {
            return { id, error: 'class_cast_exception' }
          } else {
            return { id, error: 'fetch_error', details: errorText.substring(0, 200) }
          }
        }
      } catch (err) {
        return { id, error: 'exception', details: err instanceof Error ? err.message : 'Unknown error' }
      }
    }

    // Process each batch in parallel
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]

      // Fetch all shipments in this batch in parallel
      const results = await Promise.all(batch.map(id => fetchShipmentDetail(id)))

      // Process results
      for (const result of results) {
        if ('shipment' in result && result.shipment) {
          shipments.push(result.shipment)
        } else if ('skipped' in result) {
          skippedByDate++
        } else if ('error' in result) {
          fetchErrors++
          if (result.error === 'class_cast_exception') {
            corruptedShipmentIds.push(result.id)
            failedShipmentIds.push(result.id)
          } else if (fetchErrors <= 3) {
            console.error(`Error fetching shipment ${result.id}:`, result.error)
          }
        }
      }

      // Log progress
      if ((batchIndex + 1) % 10 === 0 || batchIndex === batches.length - 1) {
        console.log(`Processed ${Math.min((batchIndex + 1) * BATCH_SIZE, shipmentIds.length)}/${shipmentIds.length} shipments...`)
      }
    }

    console.log(`✅ Fetched ${shipments.length} shipments (${fetchErrors} errors, ${skippedByDate} filtered out by date)`)

    // Retry failed shipments in parallel (PACE API bug is often intermittent - retry usually succeeds)
    if (failedShipmentIds.length > 0) {
      console.log(`🔄 Retrying ${failedShipmentIds.length} failed shipment(s) in parallel...`)

      const retryResults = await Promise.all(
        failedShipmentIds.map(async (id) => {
          try {
            const detailResponse = await fetch(
              `${paceApiUrl}/ReadObject/readJobShipment?primaryKey=${id}`,
              {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Authorization': authHeader,
                  'Content-Type': 'application/json',
                },
                body: '',
              }
            )

            if (detailResponse.ok) {
              const shipmentDetail = await detailResponse.json()

              // Fix PACE API bug: description field sometimes comes as array instead of string
              if (shipmentDetail.description && Array.isArray(shipmentDetail.description)) {
                shipmentDetail.description = shipmentDetail.description.join('\n')
              }

              // Normalize the response
              const rawDate =
                shipmentDetail.dateTime ?? shipmentDetail.date ?? shipmentDetail.shipDate
              if (rawDate) {
                shipmentDetail.dateTime = rawDate
              }

              // Apply date filtering
              if (dateFilters.startTimestamp || dateFilters.endTimestamp) {
                if (!rawDate) {
                  return { id, skipped: true }
                }

                const shipmentDate = new Date(rawDate).getTime()

                if (dateFilters.startTimestamp && shipmentDate < dateFilters.startTimestamp) {
                  return { id, skipped: true }
                }
                if (dateFilters.endTimestamp && shipmentDate > dateFilters.endTimestamp) {
                  return { id, skipped: true }
                }
              }

              return { id, success: true, shipment: shipmentDetail }
            }

            return { id, success: false }
          } catch (err) {
            return { id, success: false }
          }
        })
      )

      let retrySuccesses = 0
      for (const result of retryResults) {
        if (result.success && result.shipment) {
          shipments.push(result.shipment)
          retrySuccesses++

          // Remove from corrupted list since retry succeeded
          const corruptedIndex = corruptedShipmentIds.indexOf(result.id)
          if (corruptedIndex > -1) {
            corruptedShipmentIds.splice(corruptedIndex, 1)
          }
        }
      }

      console.log(`✅ Retry recovered ${retrySuccesses} of ${failedShipmentIds.length} shipments`)
    }

    // Report truly corrupted shipments that failed even after retry
    if (corruptedShipmentIds.length > 0) {
      console.error(`\n⚠️  PACE DATA CORRUPTION: ${corruptedShipmentIds.length} shipment(s) still corrupted after retry`)
      console.error(`   The 'description' field causes ClassCastException even on retry`)
      console.error(`   Contact PACE support to fix these shipment IDs: ${corruptedShipmentIds.join(', ')}`)
      console.error(`   These shipments are excluded from results until fixed in PACE database\n`)
    }

    // Sort by dateTime descending for consistent ordering
    shipments.sort((a, b) => {
      const aTime = a.dateTime ? new Date(a.dateTime).getTime() : 0
      const bTime = b.dateTime ? new Date(b.dateTime).getTime() : 0
      return bTime - aTime
    })

    // For pagination, we need to make another request to get total count
    // Since PACE doesn't provide total count directly, we'll estimate
    const total = shipments.length + (resolvedPage - 1) * resolvedPageSize
    const hasMore = shipments.length === resolvedPageSize
    const totalPages = hasMore ? resolvedPage + 1 : resolvedPage

    return NextResponse.json({
      success: true,
      data: {
        items: shipments,
        total,
        page: resolvedPage,
        pageSize: resolvedPageSize,
        totalPages,
        hasMore,
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
