import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { jobShipmentFilterSchema, type JobShipment } from '@repo/types'
import { ZodError } from 'zod'
import { getPaceApiCredentials } from '@/lib/secrets'
import { toZonedTime } from 'date-fns-tz'

const TIMEZONE = 'America/Los_Angeles'

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

    // Build XPath query for PACE API
    const xpathConditions: string[] = []

    // Add date filter to XPath query if present (using PACE date() function like Python script)
    if (filters.startDate && filters.endDate) {
      // The frontend sends ISO strings that represent PT dates (e.g., "2025-10-20T07:00:00.000Z" for Oct 20 PT)
      // We need to convert back to PT and extract the date components
      // PACE's date() function expects dates in the server's timezone (Pacific Time)

      // Parse the ISO string and convert to Pacific Time
      const startDatePT = toZonedTime(new Date(filters.startDate), TIMEZONE)
      const endDatePT = toZonedTime(new Date(filters.endDate), TIMEZONE)

      // Extract date components in Pacific Time
      const startYear = startDatePT.getFullYear()
      const startMonth = startDatePT.getMonth() + 1
      const startDay = startDatePT.getDate()

      const endYear = endDatePT.getFullYear()
      const endMonth = endDatePT.getMonth() + 1
      const endDay = endDatePT.getDate()

      // Use PACE's date() function for date comparison (same as Python script)
      const dateXPath = `@date >= date(${startYear}, ${startMonth}, ${startDay}) and @date <= date(${endYear}, ${endMonth}, ${endDay})`
      xpathConditions.push(dateXPath)

      console.log('Date filtering:', {
        requestedDates: { start: filters.startDate, end: filters.endDate },
        pacificTimeDates: {
          start: { year: startYear, month: startMonth, day: startDay, iso: startDatePT.toISOString() },
          end: { year: endYear, month: endMonth, day: endDay, iso: endDatePT.toISOString() }
        },
        xpath: dateXPath
      })
    }

    // Add job filter
    if (filters.job) {
      // Wrap string values in single quotes for XPath
      xpathConditions.push(`@job = '${filters.job}'`)
    }

    // Note: Customer filter will be applied after enrichment since customer name
    // comes from the Job->Customer lookup, not directly from JobShipment

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
    // With date filtering in XPath, we only get shipments in the date range
    // So we can use a reasonable limit instead of fetching everything
    const fetchLimit = 1000 // Reasonable limit since XPath filters by date

    const queryParams = new URLSearchParams({
      type: 'JobShipment',
      xpath: xpath,
      offset: offset.toString(),
      limit: fetchLimit.toString(),
    })

    // Call PACE API using findSortAndLimit
    const paceUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${queryParams.toString()}`

    console.log('PACE API Request (XPath Date Filtering):', {
      url: paceUrl,
      xpath: xpath,
      offset,
      limit: fetchLimit,
      filters: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        job: filters.job,
        note: 'Date filtering now done in XPath query at PACE API level (like Python script)'
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

    // Fetch details in parallel batches for better performance
    const batchSize = 100
    const batches: string[][] = []
    for (let i = 0; i < shipmentIds.length; i += batchSize) {
      batches.push(shipmentIds.slice(i, i + batchSize))
    }

    console.log(`Processing ${shipmentIds.length} shipments in ${batches.length} batches of ${batchSize}...`)

    // Function to fetch a single shipment's details
    const fetchShipmentDetail = async (id: string) => {
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

          // Normalize the response and fix timezone issue
          const rawDate =
            shipmentDetail.dateTime ?? shipmentDetail.date ?? shipmentDetail.shipDate
          if (rawDate) {
            // PACE returns dates in UTC format but WITHOUT the 'Z' suffix
            // e.g., "2025-10-22T01:05:00" is actually UTC, which displays as Oct 21 in PT
            const dateStr = String(rawDate)
            if (dateStr && !dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.match(/-\d{2}:\d{2}$/)) {
              // No timezone info - treat as UTC by adding 'Z'
              const dateTimeStr = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`
              shipmentDetail.dateTime = dateTimeStr + 'Z'
            } else {
              shipmentDetail.dateTime = rawDate
            }
          }

          // Date filtering is now done at the XPath level in PACE API
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
    const shipments: JobShipment[] = []
    let processedCount = 0

    for (const batch of batches) {
      const batchResults = await Promise.all(batch.map(fetchShipmentDetail))

      for (const result of batchResults) {
        if ('shipment' in result && result.shipment) {
          shipments.push(result.shipment)
        }
      }

      processedCount += batch.length
      if (processedCount % 500 === 0 || processedCount === shipmentIds.length) {
        console.log(`Processed ${processedCount}/${shipmentIds.length} shipments...`)
      }
    }

    console.log(`✅ Fetched ${shipments.length} shipments (date filtering done by PACE XPath query)`)

    // Enrich shipments with customer data from Job lookup
    console.log(`Enriching ${shipments.length} shipments with customer data...`)
    const uniqueJobs = [...new Set(shipments.map(s => s.job).filter(Boolean))]

    // Fetch all unique jobs in parallel
    const jobPromises = uniqueJobs.map(async (jobNum) => {
      try {
        const jobResponse = await fetch(
          `${paceApiUrl}/ReadObject/readJob?primaryKey=${encodeURIComponent(jobNum!)}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )

        if (jobResponse.ok) {
          const jobData = await jobResponse.json()
          return { jobNum, customer: jobData.customer }
        }
      } catch (err) {
        console.error(`Error fetching job ${jobNum}:`, err)
      }
      return { jobNum, customer: null }
    })

    const jobResults = await Promise.all(jobPromises)
    const jobCustomerMap = new Map(jobResults.map(r => [r.jobNum, r.customer]))

    // Add customer ID to each shipment
    shipments.forEach(shipment => {
      if (shipment.job && jobCustomerMap.has(shipment.job)) {
        shipment.customer = jobCustomerMap.get(shipment.job) || null
      }
    })

    // Fetch customer names from Customer objects
    const uniqueCustomers = [...new Set(shipments.map(s => s.customer).filter(Boolean))]
    console.log(`Fetching ${uniqueCustomers.length} unique customer names...`)

    const customerPromises = uniqueCustomers.map(async (customerId) => {
      try {
        const customerResponse = await fetch(
          `${paceApiUrl}/ReadObject/readCustomer?primaryKey=${encodeURIComponent(customerId!)}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )

        if (customerResponse.ok) {
          const customerData = await customerResponse.json()
          return { customerId, customerName: customerData.custName || customerData.id }
        }
      } catch (err) {
        console.error(`Error fetching customer ${customerId}:`, err)
      }
      return { customerId, customerName: null }
    })

    const customerResults = await Promise.all(customerPromises)
    const customerNameMap = new Map(customerResults.map(r => [r.customerId, r.customerName]))

    // Add customer name to each shipment
    shipments.forEach(shipment => {
      if (shipment.customer && customerNameMap.has(shipment.customer)) {
        shipment.customerName = customerNameMap.get(shipment.customer) || null
      }
    })

    console.log(`✅ Enriched shipments with customer data`)

    // Fetch Ship Via descriptions
    const uniqueShipVias = [...new Set(shipments.map(s => s.shipVia).filter(Boolean))]
    console.log(`Fetching ${uniqueShipVias.length} unique Ship Via descriptions...`)

    const shipViaPromises = uniqueShipVias.map(async (shipViaId) => {
      try {
        const shipViaResponse = await fetch(
          `${paceApiUrl}/ReadObject/readShipVia?primaryKey=${encodeURIComponent(shipViaId!)}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )

        if (shipViaResponse.ok) {
          const shipViaData = await shipViaResponse.json()
          return {
            shipViaId,
            description: shipViaData.description || null,
            provider: shipViaData.provider || null
          }
        }
      } catch (err) {
        console.error(`Error fetching Ship Via ${shipViaId}:`, err)
      }
      return { shipViaId, description: null, provider: null }
    })

    const shipViaResults = await Promise.all(shipViaPromises)
    const shipViaMap = new Map(shipViaResults.map(r => [r.shipViaId, { description: r.description, provider: r.provider }]))

    // Fetch Ship Provider descriptions for Ship Vias that have providers
    const uniqueProviders = [...new Set(shipViaResults.map(r => r.provider).filter(Boolean))]
    console.log(`Fetching ${uniqueProviders.length} unique Ship Provider descriptions...`)

    const providerPromises = uniqueProviders.map(async (providerId) => {
      try {
        const providerResponse = await fetch(
          `${paceApiUrl}/ReadObject/readShipProvider?primaryKey=${encodeURIComponent(providerId!)}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )

        if (providerResponse.ok) {
          const providerData = await providerResponse.json()
          return { providerId, description: providerData.name || null }
        }
      } catch (err) {
        console.error(`Error fetching Ship Provider ${providerId}:`, err)
      }
      return { providerId, description: null }
    })

    const providerResults = await Promise.all(providerPromises)
    const providerMap = new Map(providerResults.map(r => [r.providerId, r.description]))

    // Add Ship Via and Provider descriptions to each shipment
    shipments.forEach(shipment => {
      if (shipment.shipVia && shipViaMap.has(shipment.shipVia)) {
        const shipViaInfo = shipViaMap.get(shipment.shipVia)
        shipment.shipViaDescription = shipViaInfo?.description || null

        if (shipViaInfo?.provider && providerMap.has(shipViaInfo.provider)) {
          shipment.shipViaProvider = providerMap.get(shipViaInfo.provider) || null
        }
      }
    })

    console.log(`✅ Enriched shipments with Ship Via and Provider data`)

    // Sort newest first for a predictable UI ordering
    shipments.sort((a, b) => {
      const aTime = a.dateTime ? new Date(a.dateTime).getTime() : 0
      const bTime = b.dateTime ? new Date(b.dateTime).getTime() : 0
      return bTime - aTime
    })

    // Note: Customer filter is handled client-side in the frontend
    // We return all shipments to enable fast client-side filtering without re-fetching

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

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
          details: error.errors
        },
        { status: 400 }
      )
    }

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

// POST /api/pace/shipments - Create a new job shipment
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
    const { job, date, shipmentType, shipVia, description } = body

    if (!job) {
      return NextResponse.json({ error: 'Job number is required' }, { status: 400 })
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
        { error: 'PACE API not configured' },
        { status: 500 }
      )
    }

    const authHeader = `Basic ${Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')}`

    // Prepare JobShipment data
    const shipmentData: any = {
      job: job,
    }

    // Add optional fields
    if (date) {
      shipmentData.dateTime = new Date(date).toISOString().substring(0, 19)
    }

    if (shipmentType) {
      shipmentData.shipmentType = shipmentType
    }

    if (shipVia) {
      shipmentData.shipVia = shipVia
    }

    if (description) {
      shipmentData.description = description
    }

    // Create JobShipment in PACE
    const response = await fetch(`${paceApiUrl}/CreateObject/createJobShipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
      body: JSON.stringify(shipmentData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PACE createJobShipment error:', errorText)
      return NextResponse.json(
        { error: 'Failed to create JobShipment in PACE', details: errorText },
        { status: response.status }
      )
    }

    const result = await response.json()

    console.log('Created JobShipment in PACE:', result.id)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('Create job shipment error:', error)
    return NextResponse.json(
      { error: 'Failed to create job shipment', message: error.message },
      { status: 500 }
    )
  }
}
