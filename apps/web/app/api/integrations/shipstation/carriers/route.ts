import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

/**
 * GET /api/integrations/shipstation/carriers
 * Fetch configured ShipStation carriers with their available services
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      select: { tenantId: true },
    })

    if (!membership?.tenantId) {
      return NextResponse.json({ error: 'User has no tenant' }, { status: 400 })
    }

    // Fetch ShipStation integration config
    const integration = await db.integration.findFirst({
      where: {
        tenantId: membership.tenantId,
        provider: 'shipstation',
      },
    })

    if (!integration || !integration.config) {
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    const config = integration.config as any
    const carriers = config.carriers || []

    // Format carriers for dropdown
    const formattedCarriers = carriers.map((carrier: any) => ({
      id: carrier.id,
      name: carrier.name || carrier.id,
    }))

    return NextResponse.json({
      success: true,
      data: formattedCarriers,
    })
  } catch (error: any) {
    console.error('[API] ShipStation carriers GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch carriers' },
      { status: 500 }
    )
  }
}
