import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPaceApiCredentials } from '@/lib/secrets'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const resolvedParams = await params
    const inventoryItemId = resolvedParams.id

    const detailResponse = await fetch(
      `${paceApiUrl}/ReadObject/readInventoryItem?primaryKey=${encodeURIComponent(inventoryItemId)}`,
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
      const errorText = await detailResponse.text()
      console.error('PACE API error:', errorText)
      return NextResponse.json(
        { error: 'Inventory item not found', details: errorText },
        { status: detailResponse.status }
      )
    }

    const item = await detailResponse.json()

    return NextResponse.json({
      success: true,
      data: {
        id: item.id || inventoryItemId,
        description: item.description || inventoryItemId,
        sizeWidth: item.sizeWidth,
        sizeLength: item.sizeLength,
        inventoryItemType: item.inventoryItemType,
      },
    })
  } catch (error) {
    console.error('Error fetching inventory item:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
