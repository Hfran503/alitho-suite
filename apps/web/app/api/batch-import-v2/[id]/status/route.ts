import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getShipStationApiKey } from '@repo/shared'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Await params for Next.js 15
    const { id: batchId } = await params

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      select: { tenantId: true },
    })

    if (!membership?.tenantId) {
      return NextResponse.json({ error: 'User has no tenant' }, { status: 400 })
    }

    // Get ShipStation API key
    const apiKey = await getShipStationApiKey(membership.tenantId)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ShipStation API key not configured' },
        { status: 400 }
      )
    }

    // Get batch status from ShipEngine
    const response = await fetch(
      `${process.env.SHIPENGINE_API_URL || 'https://api.shipengine.com'}/v1/batches/${batchId}`,
      {
        method: 'GET',
        headers: {
          'API-Key': apiKey,
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error('[Batch V2] Failed to get batch status:', errorData)
      throw new Error(
        errorData.errors?.[0]?.message || errorData.message || 'Failed to get batch status'
      )
    }

    const batchData = await response.json()

    return NextResponse.json({
      success: true,
      data: batchData,
    })
  } catch (error: any) {
    console.error('[Batch V2] Status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get batch status' },
      { status: 500 }
    )
  }
}
