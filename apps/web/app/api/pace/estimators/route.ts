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

    // Find all Estimators
    const findQueryParams = new URLSearchParams({
      type: 'Estimator',
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
        { error: 'Failed to fetch Estimators from PACE', details: errorText },
        { status: findResponse.status }
      )
    }

    const estimatorIds: number[] = await findResponse.json()

    // Fetch details for each Estimator
    const estimatorPromises = estimatorIds.map(async (id: number) => {
      try {
        const detailResponse = await fetch(
          `${paceApiUrl}/ReadObject/readEstimator?primaryKey=${id}`,
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
          const estimator = await detailResponse.json()
          return {
            id: estimator.id || id,
            name: estimator.name || `Estimator ${id}`,
            email: estimator.email,
          }
        }
      } catch (err) {
        console.error(`Error fetching Estimator ${id}:`, err)
      }
      return null
    })

    const estimators = (await Promise.all(estimatorPromises)).filter((e) => e !== null)

    return NextResponse.json({
      success: true,
      data: estimators,
    })
  } catch (error) {
    console.error('Error fetching Estimators:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
