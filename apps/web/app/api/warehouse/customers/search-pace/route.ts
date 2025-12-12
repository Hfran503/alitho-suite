import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// GET /api/warehouse/customers/search-pace - Search PACE for customers
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    if (!search || search.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      )
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

    // Search for active customers by ID or name
    // XPath query: active customers with ID or name containing search term (case-sensitive)
    // Note: PACE doesn't support lower-case() function, so search is case-sensitive
    const xpath = `@id != "" and customerStatus/@customerActive = "true" and (contains(@id, "${search}") or contains(@custName, "${search}"))`

    const findQueryParams = new URLSearchParams({
      type: 'Customer',
      xpath,
      offset: '0',
      limit: String(limit * 2), // Get more to filter out already-added
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
        { error: 'Failed to search PACE customers', details: errorText },
        { status: findResponse.status }
      )
    }

    const customerIds: string[] = await findResponse.json()

    if (customerIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    // Get already-added customer IDs
    const existingCustomers = await db.warehouseCustomer.findMany({
      where: {
        tenantId: membership.tenantId,
        paceCustomerId: { in: customerIds },
      },
      select: { paceCustomerId: true, isActive: true },
    })

    const existingMap = new Map(
      existingCustomers.map((c) => [c.paceCustomerId, c.isActive])
    )

    // Fetch details for found customers
    const batchPromises = customerIds.slice(0, limit).map(async (id: string) => {
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
          const isAdded = existingMap.has(id)
          const isActive = existingMap.get(id)
          return {
            paceCustomerId: customer.id || id,
            name: customer.custName || customer.name || id,
            company: customer.company || null,
            salesPerson: customer.salesPerson || null,
            isAlreadyAdded: isAdded,
            isActive: isAdded ? isActive : null,
          }
        }
      } catch (err) {
        console.error(`Error fetching customer ${id}:`, err)
      }
      return null
    })

    const results = await Promise.all(batchPromises)
    const customers = results.filter((r) => r !== null)

    return NextResponse.json({
      success: true,
      data: customers,
    })
  } catch (error) {
    console.error('Error searching PACE customers:', error)
    return NextResponse.json(
      {
        error: 'Failed to search PACE customers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
