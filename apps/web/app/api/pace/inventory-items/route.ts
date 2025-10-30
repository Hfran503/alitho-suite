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

    // Find all inventory items
    // Note: Filtering by type will be done after fetching, as the xpath field name is unknown
    const findQueryParams = new URLSearchParams({
      type: 'InventoryItem',
      xpath: '@id != ""',
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
        body: JSON.stringify([{ xpath: '@id', descending: false }]),
      }
    )

    if (!findResponse.ok) {
      const errorText = await findResponse.text()
      console.error('PACE API find error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch inventory items from PACE', details: errorText },
        { status: findResponse.status }
      )
    }

    const inventoryItemIds: string[] = await findResponse.json()

    console.log(`Found ${inventoryItemIds.length} inventory items, limiting to first 100`)

    // Limit to first 100 items to avoid overwhelming the API
    const limitedIds = inventoryItemIds.slice(0, 100)

    // Fetch details in batches to avoid overwhelming the PACE API
    const batchSize = 10
    const results: any[] = []

    for (let i = 0; i < limitedIds.length; i += batchSize) {
      const batch = limitedIds.slice(i, i + batchSize)
      console.log(`Fetching batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(limitedIds.length / batchSize)}`)

      const batchPromises = batch.map(async (id: string) => {
        try {
          const detailResponse = await fetch(
            `${paceApiUrl}/ReadObject/readInventoryItem?primaryKey=${encodeURIComponent(id)}`,
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
            const item = await detailResponse.json()

            // Log the first item to see the structure
            if (id === limitedIds[0]) {
              console.log('Sample InventoryItem structure:', JSON.stringify(item, null, 2))
            }

            // Size fields are directly on the item (not nested in size object)
            // Return all items that have size dimensions (paper/material items typically have these)
            const hasSizeInfo = item.sizeWidth && item.sizeLength

            if (hasSizeInfo) {
              return {
                id: item.id || id,
                description: item.description || id,
                sizeWidth: item.sizeWidth,
                sizeLength: item.sizeLength,
                inventoryItemType: item.inventoryItemType,
              }
            }
            return null
          }
        } catch (err) {
          console.error(`Error fetching inventory item ${id}:`, err)
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

    const inventoryItems = results

    return NextResponse.json({
      success: true,
      data: inventoryItems,
    })
  } catch (error) {
    console.error('Error fetching inventory items:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
