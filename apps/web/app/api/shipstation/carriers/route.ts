import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getShipStationClient } from '@/lib/shipstation'

// GET /api/shipstation/carriers - Get list of available carriers
export async function GET(_req: NextRequest) {
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

    // Get ShipStation client
    const shipstation = await getShipStationClient(membership.tenantId)

    // Fetch carriers from ShipStation API
    const allCarriers = await shipstation.request('/carriers', {
      method: 'GET',
    }) as { carriers: any[] }

    // Check if there are configured carriers in the integration config
    // Support both carrierIds array and carriers array formats
    const config = integration.config as any
    let configuredCarrierIds: string[] = []

    if (config?.carrierIds && Array.isArray(config.carrierIds)) {
      configuredCarrierIds = config.carrierIds
    } else if (config?.carriers && Array.isArray(config.carriers)) {
      configuredCarrierIds = config.carriers.map((c: any) => c.id)
    }

    // If carrier IDs are configured, filter the carriers
    const carriers = configuredCarrierIds.length > 0
      ? allCarriers.carriers.filter((carrier: any) =>
          configuredCarrierIds.includes(carrier.carrier_id)
        )
      : allCarriers.carriers

    return NextResponse.json({
      success: true,
      data: {
        carriers,
        allCarriers: allCarriers.carriers,
        isFiltered: configuredCarrierIds.length > 0,
      },
    })
  } catch (error: any) {
    console.error('Error fetching carriers:', error)
    return NextResponse.json(
      {
        error: error.response?.data?.message || error.message || 'Failed to fetch carriers',
        details: error.response?.data,
      },
      { status: error.response?.status || 500 }
    )
  }
}
