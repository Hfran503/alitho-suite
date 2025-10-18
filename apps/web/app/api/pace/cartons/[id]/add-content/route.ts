import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// POST /api/pace/cartons/[id]/add-content - Add content to existing carton
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: cartonId } = await params
    const body = await req.json()

    const credentials = await getPaceApiCredentials()
    const paceApiUrl = credentials.url
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    // Create the carton content
    const contentPayload: any = {
      carton: parseInt(cartonId),
      quantity: body.quantity,
    }

    // Add content type fields
    // IMPORTANT: For JobPart references, PACE uses jobPartJob field (not job field)
    // - job: null
    // - jobPart: "02" (just the part number)
    // - jobPartJob: "1" (the job ID)
    if (body.isJobPart && body.job && body.jobPart) {
      contentPayload.jobPartJob = body.job.toString()
      contentPayload.jobPart = body.jobPart
    } else if (body.jobPart) {
      contentPayload.jobPart = body.jobPart
    } else if (body.job) {
      contentPayload.job = body.job
    }

    if (body.jobComponent) {
      contentPayload.jobComponent = body.jobComponent
    }
    if (body.jobProduct) {
      contentPayload.jobProduct = body.jobProduct
    }
    if (body.description) {
      contentPayload.contentDescription = body.description
    }

    const createContentUrl = `${paceApiUrl}/CreateObject/createCartonContent`

    console.log('Adding content to carton:', { url: createContentUrl, payload: contentPayload })

    const response = await fetch(createContentUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contentPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PACE API error (add content):', {
        status: response.status,
        statusText: response.statusText,
        response: errorText,
      })
      return NextResponse.json(
        { error: `Failed to add content to carton: ${errorText}` },
        { status: response.status }
      )
    }

    const createdContent = await response.json()
    console.log('Content added to carton:', createdContent)

    return NextResponse.json({ success: true, data: createdContent })
  } catch (error) {
    console.error('Add content to carton error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
