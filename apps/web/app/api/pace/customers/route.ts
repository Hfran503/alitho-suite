import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPaceApiCredentials } from '@/lib/secrets'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const credentials = await getPaceApiCredentials()
    const { url: paceApiUrl, username, password } = credentials

    if (!paceApiUrl || !username || !password) {
      return NextResponse.json(
        { error: 'PACE API not configured' },
        { status: 500 }
      )
    }

    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

    // Find all active customers
    const findQueryParams = new URLSearchParams({
      type: 'Customer',
      xpath: '@id != "" and customerStatus/@customerActive = "true"',
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
        { error: 'Failed to fetch customers from PACE', details: errorText },
        { status: findResponse.status }
      )
    }

    const customerIds: string[] = await findResponse.json()

    console.log(`Found ${customerIds.length} customers, limiting to first 200`)

    // Limit to first 200 active customers
    const limitedIds = customerIds.slice(0, 200)

    // Fetch details in batches to avoid overwhelming the PACE API
    const batchSize = 10
    const results: any[] = []

    for (let i = 0; i < limitedIds.length; i += batchSize) {
      const batch = limitedIds.slice(i, i + batchSize)
      console.log(`Fetching customer batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(limitedIds.length / batchSize)}`)

      const batchPromises = batch.map(async (id: string) => {
        try {
          const detailResponse = await fetch(
            `${paceApiUrl}/ReadObject/readCustomer?primaryKey=${encodeURIComponent(id)}`,
            {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                Authorization: authHeader,
              },
              body: '',
            }
          )

          if (detailResponse.ok) {
            const customer = await detailResponse.json()
            return {
              id: customer.id || id,
              name: customer.custName || customer.name || id,
              company: customer.company,
              salesPerson: customer.salesPerson, // Include salesperson ID
            }
          }
        } catch (err) {
          console.error(`Error fetching customer ${id}:`, err)
        }
        return null
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults.filter((r) => r !== null))

      // Small delay between batches to avoid overwhelming the API
      if (i + batchSize < limitedIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    const customers = results

    return NextResponse.json({
      success: true,
      data: customers,
    })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
