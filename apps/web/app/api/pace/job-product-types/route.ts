import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPaceApiCredentials } from '@/lib/secrets'

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get PACE API credentials
    const credentials = await getPaceApiCredentials()
    const { url: paceApiUrl, username, password } = credentials

    if (!paceApiUrl || !username || !password) {
      return NextResponse.json(
        { error: 'PACE API not configured' },
        { status: 500 }
      )
    }

    // Create auth header
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

    // Step 1: Find all JobProductType objects
    const findQueryParams = new URLSearchParams({
      type: 'JobProductType',
      xpath: '@id > 0',
      offset: '0',
      limit: '1000',
    })

    const findResponse = await fetch(
      `${paceApiUrl}/FindObjects/findSortAndLimit?${findQueryParams.toString()}`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([]),
      }
    )

    if (!findResponse.ok) {
      const errorText = await findResponse.text()
      console.error('PACE API find error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch JobProductTypes from PACE', details: errorText },
        { status: findResponse.status }
      )
    }

    const findResult = await findResponse.json()
    console.log('FindObjects response type:', typeof findResult, 'isArray:', Array.isArray(findResult))
    console.log('FindObjects response:', JSON.stringify(findResult).substring(0, 500))

    // PACE API returns array of IDs directly, not wrapped in object
    const ids: number[] = Array.isArray(findResult) ? findResult : (findResult.ids || [])
    const total = ids.length

    console.log(`Found ${total} JobProductTypes, got ${ids.length} IDs`)

    if (ids.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          total: 0,
        },
      })
    }

    // Step 2: Fetch details for each JobProductType
    const detailsPromises = ids.map(async (id: number) => {
      try {
        const detailResponse = await fetch(
          `${paceApiUrl}/ReadObject/readJobProductType?primaryKey=${id}`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              Authorization: authHeader,
            },
            body: '',
          }
        )

        if (!detailResponse.ok) {
          console.error(`Failed to fetch JobProductType ${id}`)
          return null
        }

        const detail = await detailResponse.json()
        return detail
      } catch (error) {
        console.error(`Error fetching JobProductType ${id}:`, error)
        return null
      }
    })

    // Execute all requests in parallel
    const results = await Promise.all(detailsPromises)

    // Filter out null results
    const validResults = results.filter((r) => r !== null)

    // Return the results
    return NextResponse.json({
      success: true,
      data: {
        items: validResults,
        total,
      },
    })
  } catch (error) {
    console.error('Error fetching JobProductTypes:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
