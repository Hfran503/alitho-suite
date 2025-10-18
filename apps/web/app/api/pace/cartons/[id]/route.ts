import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// PATCH /api/pace/cartons/[id] - Update carton
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

    const { id: cartonId } = await params
    const body = await req.json()

    const credentials = await getPaceApiCredentials()
    const paceApiUrl = credentials.url
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    // Update the carton
    const updateUrl = `${paceApiUrl}/UpdateObject/updateCarton`

    const cartonPayload: any = {
      id: parseInt(cartonId),
      ...body,
    }

    console.log('Updating carton:', { url: updateUrl, payload: cartonPayload })

    const response = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cartonPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PACE API error (update carton):', {
        status: response.status,
        statusText: response.statusText,
        response: errorText,
      })
      return NextResponse.json(
        { error: `Failed to update carton: ${errorText}` },
        { status: response.status }
      )
    }

    const updatedCarton = await response.json()
    console.log('Carton updated:', updatedCarton)

    return NextResponse.json({ success: true, data: updatedCarton })
  } catch (error) {
    console.error('Update carton error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/pace/cartons/[id] - Delete carton
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

    const { id: cartonId } = await params

    const credentials = await getPaceApiCredentials()
    const paceApiUrl = credentials.url
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    // Use PACE DeleteObject endpoint to delete the carton
    const deleteUrl = `${paceApiUrl}/DeleteObject/DeleteObject?${new URLSearchParams({
      type: 'Carton',
      key: cartonId,
    })}`

    console.log('Deleting carton:', { url: deleteUrl, cartonId })

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PACE API error (delete carton):', {
        status: response.status,
        statusText: response.statusText,
        response: errorText,
      })
      return NextResponse.json(
        { error: `Failed to delete carton: ${errorText}` },
        { status: response.status }
      )
    }

    console.log('Carton deleted successfully')

    return NextResponse.json({ success: true, message: 'Carton deleted' })
  } catch (error) {
    console.error('Delete carton error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
