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

    // Find all salespeople
    const findQueryParams = new URLSearchParams({
      type: 'SalesPerson',
      xpath: '@id > 0',
      offset: '0',
      limit: '500',
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
        body: JSON.stringify([{ xpath: '@name', descending: false }]),
      }
    )

    if (!findResponse.ok) {
      const errorText = await findResponse.text()
      console.error('PACE API find error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch salespeople from PACE', details: errorText },
        { status: findResponse.status }
      )
    }

    const salespersonIds: number[] = await findResponse.json()

    // Fetch details for each salesperson
    const salespersonPromises = salespersonIds.map(async (id: number) => {
      try {
        const detailResponse = await fetch(
          `${paceApiUrl}/ReadObject/readSalesPerson?primaryKey=${id}`,
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
          const salesperson = await detailResponse.json()
          return {
            id: salesperson.id || id,
            name: salesperson.name || `SalesPerson ${id}`,
          }
        }
      } catch (err) {
        console.error(`Error fetching salesperson ${id}:`, err)
      }
      return null
    })

    const salespeople = (await Promise.all(salespersonPromises)).filter((s) => s !== null)

    return NextResponse.json({
      success: true,
      data: salespeople,
    })
  } catch (error) {
    console.error('Error fetching salespeople:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
