import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// GET /api/pace/cartons/[id]/test - Test endpoint to check carton details
export async function GET(
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

    // Read the carton
    const cartonResponse = await fetch(
      `${paceApiUrl}/ReadObject/readCarton?primaryKey=${cartonId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: '',
      }
    )

    if (!cartonResponse.ok) {
      const errorText = await cartonResponse.text()
      return NextResponse.json(
        { error: `Failed to read carton: ${errorText}` },
        { status: cartonResponse.status }
      )
    }

    const carton = await cartonResponse.json()

    // Find all contents for this carton
    const findContentsUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${new URLSearchParams({
      type: 'CartonContent',
      xpath: `@carton=${cartonId}`,
      offset: '0',
      limit: '1000',
    })}`

    const contentsIdsResponse = await fetch(findContentsUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ xpath: '@id', descending: false }]),
    })

    const contentIds = contentsIdsResponse.ok ? await contentsIdsResponse.json() : []

    // Fetch each content detail
    const contents = await Promise.all(
      (contentIds || []).map(async (id: number) => {
        const response = await fetch(
          `${paceApiUrl}/ReadObject/readCartonContent?primaryKey=${id}`,
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
        return await response.json()
      })
    )

    return NextResponse.json({
      success: true,
      carton,
      contents: contents.filter(c => c !== null),
    })
  } catch (error) {
    console.error('Test carton error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
