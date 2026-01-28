import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getShipStationClient } from '@/lib/shipstation'

// GET /api/shipstation/rates/bulk/[requestId] - Get bulk rate result
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { requestId } = await params

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Get ShipStation client
    const client = await getShipStationClient(membership.tenantId)

    // Get the bulk rate result
    const result = await client.getBulkRateResult(requestId)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('ShipStation get bulk rate result error:', error)
    return NextResponse.json(
      { error: `ShipStation API error: ${error.message}` },
      { status: 500 }
    )
  }
}
