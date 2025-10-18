import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import type { Carton, CartonContent } from '@repo/types'
import { getPaceApiCredentials } from '@/lib/secrets'

// GET /api/pace/shipments/[id]/cartons - Get all cartons for a shipment with their contents
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
    const { id: shipmentId } = await params

    if (!shipmentId) {
      return NextResponse.json(
        { error: 'Shipment ID is required' },
        { status: 400 }
      )
    }

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

    // Prepare Basic Auth header
    const authHeader = `Basic ${Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')}`

    // Step 1: Find all cartons for this shipment using xpath query
    const xpath = `@shipment=${shipmentId}`
    const queryParams = new URLSearchParams({
      type: 'Carton',
      xpath: xpath,
      offset: '0',
      limit: '1000',
    })

    const findCartonsUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${queryParams.toString()}`

    console.log('Finding cartons for shipment:', {
      url: findCartonsUrl,
      shipmentId,
      xpath,
    })

    const findResponse = await fetch(findCartonsUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([]),
    })

    if (!findResponse.ok) {
      const errorText = await findResponse.text()
      console.error('PACE API error (find cartons):', {
        status: findResponse.status,
        statusText: findResponse.statusText,
        url: findCartonsUrl,
        response: errorText,
      })

      return NextResponse.json(
        {
          error: `Failed to find cartons from PACE API (${findResponse.status} ${findResponse.statusText})`,
          details: errorText,
        },
        { status: findResponse.status }
      )
    }

    const cartonIds: string[] = await findResponse.json()

    // If no cartons found, return empty array
    if (!cartonIds || cartonIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    // Step 2: Fetch each carton's details
    const cartonPromises = cartonIds.map(async (cartonId) => {
      const readCartonUrl = `${paceApiUrl}/ReadObject/readCarton?primaryKey=${cartonId}`

      const cartonResponse = await fetch(readCartonUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: '',
      })

      if (!cartonResponse.ok) {
        console.error('Failed to read carton:', cartonId)
        return null
      }

      const carton: Carton = await cartonResponse.json()

      // Step 3: Find all CartonContent for this carton
      const contentXpath = `@carton=${cartonId}`
      const contentQueryParams = new URLSearchParams({
        type: 'CartonContent',
        xpath: contentXpath,
        offset: '0',
        limit: '1000',
      })

      const findContentUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${contentQueryParams.toString()}`

      const findContentResponse = await fetch(findContentUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([]),
      })

      if (!findContentResponse.ok) {
        console.error('Failed to find carton contents:', cartonId)
        // Return carton without contents
        return carton
      }

      const contentIds: string[] = await findContentResponse.json()

      // Step 4: Fetch each CartonContent's details
      if (contentIds && contentIds.length > 0) {
        const contentPromises = contentIds.map(async (contentId) => {
          const readContentUrl = `${paceApiUrl}/ReadObject/readCartonContent?primaryKey=${contentId}`

          const contentResponse = await fetch(readContentUrl, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          })

          if (!contentResponse.ok) {
            console.error('Failed to read carton content:', contentId)
            return null
          }

          const content: CartonContent = await contentResponse.json()

          // Fetch descriptions for the content
          const lookupPromises: Promise<void>[] = []

          // Lookup Job description
          if (content.job) {
            lookupPromises.push(
              fetch(`${paceApiUrl}/ReadObject/readJob?primaryKey=${encodeURIComponent(content.job)}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Authorization': authHeader },
                body: '',
              })
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                  if (data?.description) {
                    content.jobDescription = data.description
                  }
                })
                .catch(err => console.error('Failed to fetch Job description:', err))
            )
          }

          // Lookup JobComponent description
          if (content.jobComponent) {
            lookupPromises.push(
              fetch(`${paceApiUrl}/ReadObject/readJobComponent?primaryKey=${content.jobComponent}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Authorization': authHeader },
                body: '',
              })
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                  if (data) {
                    content.jobComponentDescription = data.description
                    content.jobComponentItemNumber = data.u_itemNumber
                    content.jobComponentPO = data.u_po
                  }
                })
                .catch(err => console.error('Failed to fetch JobComponent description:', err))
            )
          }

          // Lookup JobProduct description
          if (content.jobProduct) {
            lookupPromises.push(
              fetch(`${paceApiUrl}/ReadObject/readJobProduct?primaryKey=${content.jobProduct}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Authorization': authHeader },
                body: '',
              })
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                  if (data?.description) {
                    content.jobProductDescription = data.description
                  }
                })
                .catch(err => console.error('Failed to fetch JobProduct description:', err))
            )
          }

          // Wait for all lookups to complete
          await Promise.all(lookupPromises)

          return content
        })

        const contents = await Promise.all(contentPromises)
        carton.contents = contents.filter((c): c is CartonContent => c !== null)
      }

      return carton
    })

    const cartons = await Promise.all(cartonPromises)
    const validCartons = cartons.filter((c): c is Carton => c !== null)

    return NextResponse.json({
      success: true,
      data: validCartons,
    })
  } catch (error) {
    console.error('Get cartons error:', error)

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
