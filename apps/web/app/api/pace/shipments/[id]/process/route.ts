import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// POST /api/pace/shipments/[id]/process - Create cartons and content for a shipment
export async function POST(
  req: NextRequest,
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

    // Parse request body
    const body = await req.json()
    const { cartons } = body

    if (!cartons || !Array.isArray(cartons) || cartons.length === 0) {
      return NextResponse.json(
        { error: 'Cartons data is required' },
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

    const createdCartons = []

    // Process each carton
    for (const cartonData of cartons) {
      // Create carton in PACE
      const createCartonUrl = `${paceApiUrl}/CreateObject/createCarton`

      const cartonPayload = {
        shipment: parseInt(shipmentId),
        count: cartonData.count || 1,
        quantity: cartonData.contents.reduce((sum: number, content: any) => sum + (content.quantity || 0), 0),
        addDefaultContent: false,  // Don't auto-create default content - we'll add it manually
      }

      console.log('Creating carton:', { url: createCartonUrl, payload: cartonPayload })

      const cartonResponse = await fetch(createCartonUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cartonPayload),
      })

      if (!cartonResponse.ok) {
        const errorText = await cartonResponse.text()
        console.error('PACE API error (create carton):', {
          status: cartonResponse.status,
          statusText: cartonResponse.statusText,
          response: errorText,
        })
        throw new Error(`Failed to create carton: ${errorText}`)
      }

      const createdCarton = await cartonResponse.json()
      console.log('Carton created:', createdCarton)

      // Create contents for this carton
      const createdContents = []

      for (const contentData of cartonData.contents) {
        const contentPayload: any = {
          carton: createdCarton.id,
          quantity: contentData.quantity,
        }

        // Add optional fields
        // IMPORTANT: For JobPart references, use jobPartJob field (not job field)
        if (contentData.jobPartJob && contentData.jobPart) {
          // This is a JobPart reference
          contentPayload.jobPartJob = contentData.jobPartJob
          contentPayload.jobPart = contentData.jobPart
        } else if (contentData.job) {
          // This is a Job reference
          contentPayload.job = contentData.job
        } else if (contentData.jobPart) {
          // Legacy: just jobPart without jobPartJob (shouldn't happen anymore)
          contentPayload.jobPart = contentData.jobPart
        }

        if (contentData.jobComponent) {
          contentPayload.jobComponent = contentData.jobComponent
        }
        if (contentData.jobProduct) {
          contentPayload.jobProduct = contentData.jobProduct
        }
        if (contentData.description) {
          contentPayload.contentDescription = contentData.description
        }

        const createContentUrl = `${paceApiUrl}/CreateObject/createCartonContent`

        const contentResponse = await fetch(createContentUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(contentPayload),
        })

        if (!contentResponse.ok) {
          const errorText = await contentResponse.text()
          console.error('PACE API error (create content):', {
            status: contentResponse.status,
            statusText: contentResponse.statusText,
            response: errorText,
          })
          throw new Error(`Failed to create carton content: ${errorText}`)
        }

        const createdContent = await contentResponse.json()
        console.log('Content created:', createdContent)
        createdContents.push(createdContent)
      }

      createdCartons.push({
        carton: createdCarton,
        contents: createdContents,
      })
    }

    return NextResponse.json({
      success: true,
      data: createdCartons,
      message: `Successfully created ${createdCartons.length} carton(s)`,
    })
  } catch (error) {
    console.error('Process shipment error:', error)

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
