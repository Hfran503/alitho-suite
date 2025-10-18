import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// PATCH /api/pace/carton-content/[id] - Update carton content
export async function PATCH(
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

    const { id: contentId } = await params
    const body = await req.json()

    const credentials = await getPaceApiCredentials()
    const paceApiUrl = credentials.url
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    // Update the carton content
    const updateUrl = `${paceApiUrl}/UpdateObject/updateCartonContent`

    const contentPayload: any = {
      id: parseInt(contentId),
      ...body,
    }

    console.log('Updating carton content:', { url: updateUrl, payload: contentPayload })

    const response = await fetch(updateUrl, {
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
      console.error('PACE API error (update content):', {
        status: response.status,
        statusText: response.statusText,
        response: errorText,
      })
      return NextResponse.json(
        { error: `Failed to update carton content: ${errorText}` },
        { status: response.status }
      )
    }

    const updatedContent = await response.json()
    console.log('Carton content updated:', updatedContent)

    return NextResponse.json({ success: true, data: updatedContent })
  } catch (error) {
    console.error('Update carton content error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/pace/carton-content/[id] - Delete carton content
export async function DELETE(
  _req: NextRequest,
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

    const { id: contentId } = await params

    const credentials = await getPaceApiCredentials()
    const paceApiUrl = credentials.url
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    // Use PACE DeleteObject endpoint to actually delete the content
    const deleteUrl = `${paceApiUrl}/DeleteObject/DeleteObject?${new URLSearchParams({
      type: 'CartonContent',
      key: contentId,
    })}`

    console.log('Deleting carton content:', { url: deleteUrl, contentId })

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PACE API error (delete content):', {
        status: response.status,
        statusText: response.statusText,
        response: errorText,
      })
      return NextResponse.json(
        { error: `Failed to delete carton content: ${errorText}` },
        { status: response.status }
      )
    }

    console.log('Carton content deleted successfully')

    return NextResponse.json({ success: true, message: 'Carton content deleted' })
  } catch (error) {
    console.error('Delete carton content error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
