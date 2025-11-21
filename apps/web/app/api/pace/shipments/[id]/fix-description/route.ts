import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// POST /api/pace/shipments/[id]/fix-description - Fix corrupted description field
export async function POST(
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

    const { id: shipmentId } = await params

    const credentials = await getPaceApiCredentials()
    const paceApiUrl = credentials.url
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    // Try to fix the description field by setting it to an empty string
    const updateUrl = `${paceApiUrl}/UpdateObject/updateJobShipment`

    console.log('Attempting to fix description field for shipment:', shipmentId)

    const response = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: parseInt(shipmentId),
        description: '', // Set to empty string to fix the array issue
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to fix description:', errorText)
      return NextResponse.json(
        { error: 'Failed to fix description field', details: errorText },
        { status: response.status }
      )
    }

    const result = await response.json()
    console.log('Description field fixed successfully:', result)

    return NextResponse.json({
      success: true,
      message: 'Description field fixed successfully',
      data: result,
    })
  } catch (error) {
    console.error('Fix description error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
