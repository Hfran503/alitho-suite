import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPaceApiCredentials } from '@/lib/secrets'

export async function GET(_request: NextRequest) {
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

    console.log('Fetching Fold Patterns from PACE...')

    // Step 1: Find all fold pattern IDs
    const findQueryParams = new URLSearchParams({
      type: 'FoldPattern',
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
        body: JSON.stringify([]),
      }
    )

    if (!findResponse.ok) {
      const errorText = await findResponse.text()
      console.error('PACE FindObjects error:', findResponse.status, errorText)
      return NextResponse.json(
        { error: 'Failed to fetch fold patterns from PACE', details: errorText },
        { status: findResponse.status }
      )
    }

    const foldPatternIds: string[] = await findResponse.json()
    console.log(`Found ${foldPatternIds.length} fold pattern IDs`)

    if (foldPatternIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Step 2: Fetch details for each fold pattern with batching
    const foldPatterns = []
    const batchSize = 10
    const limitedIds = foldPatternIds.slice(0, 100) // Limit to first 100

    for (let i = 0; i < limitedIds.length; i += batchSize) {
      const batch = limitedIds.slice(i, i + batchSize)
      console.log(`Fetching fold patterns batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(limitedIds.length / batchSize)}...`)

      const batchPromises = batch.map(async (id: string) => {
        try {
          const detailResponse = await fetch(
            `${paceApiUrl}/ReadObject/readFoldPattern?primaryKey=${encodeURIComponent(id)}`,
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
            console.error(`Failed to fetch fold pattern ${id}:`, detailResponse.status)
            return null
          }

          const foldPattern = await detailResponse.json()
          return {
            id: foldPattern.id || id,
            numPages: foldPattern.numPages,
            itemsFoldPattern: foldPattern.itemsFoldPattern,
          }
        } catch (err) {
          console.error(`Error fetching fold pattern ${id}:`, err)
          return null
        }
      })

      const batchResults = await Promise.all(batchPromises)
      foldPatterns.push(...batchResults.filter((fp) => fp !== null))

      // Add a small delay between batches to avoid overwhelming the API
      if (i + batchSize < limitedIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    console.log(`Successfully fetched ${foldPatterns.length} fold patterns`)

    return NextResponse.json({
      success: true,
      data: foldPatterns,
    })
  } catch (error) {
    console.error('Error in GET /api/pace/fold-patterns:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
