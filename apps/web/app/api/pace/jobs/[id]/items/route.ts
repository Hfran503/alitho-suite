import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// GET /api/pace/jobs/[id]/items - Get all components, products, and parts for a job
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Await params before accessing properties
    const { id: jobId } = await params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
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
        {
          error: 'PACE API not configured',
          message: error instanceof Error ? error.message : 'Failed to get PACE API credentials'
        },
        { status: 500 }
      )
    }

    // Prepare Basic Auth header
    const authHeader = `Basic ${Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')}`

    console.log(`Fetching items for job ${jobId}`)

    // Fetch all items in parallel
    const [componentsIds, productsIds, partsIds] = await Promise.all([
      // Fetch JobComponents
      fetch(
        `${paceApiUrl}/FindObjects/findSortAndLimit?${new URLSearchParams({
          type: 'JobComponent',
          xpath: `@job=${encodeURIComponent(jobId)}`,
          offset: '0',
          limit: '1000',
        })}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([{ xpath: '@id', descending: false }]),
        }
      ).then(res => res.ok ? res.json() : []),

      // Fetch JobProducts
      fetch(
        `${paceApiUrl}/FindObjects/findSortAndLimit?${new URLSearchParams({
          type: 'JobProduct',
          xpath: `@job=${encodeURIComponent(jobId)}`,
          offset: '0',
          limit: '1000',
        })}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([{ xpath: '@id', descending: false }]),
        }
      ).then(res => res.ok ? res.json() : []),

      // Fetch JobParts
      fetch(
        `${paceApiUrl}/FindObjects/findSortAndLimit?${new URLSearchParams({
          type: 'JobPart',
          xpath: `@job=${encodeURIComponent(jobId)}`,
          offset: '0',
          limit: '1000',
        })}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([{ xpath: '@jobPart', descending: false }]),
        }
      ).then(async res => {
        if (!res.ok) {
          const errorText = await res.text()
          console.error('Failed to fetch JobParts:', res.status, errorText)
          return []
        }
        const data = await res.json()
        console.log('JobPart IDs response:', data)
        return data
      }),
    ])

    console.log('IDs fetched:', {
      components: componentsIds?.length || 0,
      products: productsIds?.length || 0,
      parts: partsIds?.length || 0,
      partsIds: partsIds,
    })

    // Fetch details for each component
    const components = await Promise.all(
      (componentsIds || []).map(async (id: string) => {
        const response = await fetch(
          `${paceApiUrl}/ReadObject/readJobComponent?primaryKey=${id}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )
        if (!response.ok) return null
        const data = await response.json()
        return {
          id: data.id,
          description: data.description || `Component ${data.id}`,
          itemNumber: data.u_itemNumber,
          qtyOrdered: data.qtyOrdered,
        }
      })
    )

    // Fetch details for each product
    const products = await Promise.all(
      (productsIds || []).map(async (id: string) => {
        const response = await fetch(
          `${paceApiUrl}/ReadObject/readJobProduct?primaryKey=${id}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )
        if (!response.ok) return null
        const data = await response.json()
        return {
          id: data.id,
          description: data.description || `Product ${data.id}`,
          productID: data.productID,
        }
      })
    )

    // Fetch details for each part
    // JobPart primaryKey is composite: job:jobPart (e.g., "112823:01")
    // FindObjects already returns the full composite key
    const parts = await Promise.all(
      (partsIds || []).map(async (compositePrimaryKey: string) => {
        const response = await fetch(
          `${paceApiUrl}/ReadObject/readJobPart?primaryKey=${encodeURIComponent(compositePrimaryKey)}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )
        if (!response.ok) {
          console.error(`Failed to fetch JobPart ${compositePrimaryKey}:`, response.status, response.statusText)
          const errorText = await response.text()
          console.error('Error response:', errorText)
          return null
        }
        const data = await response.json()
        console.log('JobPart data received:', data)
        // Use the composite primaryKey as the ID
        return {
          id: data.primaryKey || compositePrimaryKey,
          description: data.description || `Part ${compositePrimaryKey}`,
          partName: data.partName,
          job: data.job,
          jobPart: data.jobPart,
        }
      })
    )

    const result = {
      job: jobId,
      components: components.filter(c => c !== null),
      products: products.filter(p => p !== null),
      parts: parts.filter(p => p !== null),
    }

    console.log('Job items fetched:', {
      job: jobId,
      componentsCount: result.components.length,
      productsCount: result.products.length,
      partsCount: result.parts.length,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Get job items error:', error)

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
