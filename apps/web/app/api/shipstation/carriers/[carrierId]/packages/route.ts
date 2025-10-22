import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getShipStationClient } from '@/lib/shipstation'

// GET /api/shipstation/carriers/:carrierId/packages - Get package types for a carrier
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ carrierId: string }> }
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

    // Check if ShipStation integration is enabled
    const integration = await db.integration.findUnique({
      where: {
        tenantId_provider: {
          tenantId: membership.tenantId,
          provider: 'shipstation',
        },
      },
      select: {
        enabled: true,
        config: true,
      },
    })

    if (!integration?.enabled) {
      return NextResponse.json(
        { error: 'ShipStation integration is not enabled' },
        { status: 400 }
      )
    }

    // Await params in Next.js 15
    const { carrierId } = await params

    // Get ShipStation client
    const shipstation = await getShipStationClient(membership.tenantId)

    // Fetch carrier packages from ShipStation API
    // Using the public request method directly (more reliable than getCarrierPackages during dev)
    const packages = await shipstation.request(`/carriers/${carrierId}/packages`, {
      method: 'GET',
    })

    return NextResponse.json({
      success: true,
      data: packages,
    })
  } catch (error: any) {
    console.error('Error fetching carrier packages:', error)
    return NextResponse.json(
      {
        error: error.response?.data?.message || error.message || 'Failed to fetch carrier packages',
        details: error.response?.data,
      },
      { status: error.response?.status || 500 }
    )
  }
}
