import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

/**
 * GET /api/settings/carrier-services
 * Fetch all carrier service mappings for the tenant
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

    // Fetch all carrier service mappings for this tenant
    const mappings = await db.carrierServiceMapping.findMany({
      where: { tenantId: membership.tenantId },
      orderBy: [
        { carrierName: 'asc' },
        { serviceName: 'asc' },
      ],
    })

    return NextResponse.json({ success: true, data: mappings })
  } catch (error: any) {
    console.error('[API] Carrier service mappings GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch carrier service mappings' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/carrier-services
 * Create a new carrier service mapping
 */
export async function POST(req: NextRequest) {
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

    // Parse request body
    const body = await req.json()
    const {
      shipstationCarrierId,
      shipstationCarrierCode,
      shipstationServiceCode,
      carrierName,
      serviceName,
      paceShipViaId,
      paceShipViaName,
      trackingUrlTemplate,
    } = body

    // Validate required fields
    if (
      !shipstationCarrierId ||
      !shipstationCarrierCode ||
      !shipstationServiceCode ||
      !carrierName ||
      !serviceName ||
      !paceShipViaId ||
      !paceShipViaName
    ) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Check for existing mapping with same carrier/service
    const existing = await db.carrierServiceMapping.findFirst({
      where: {
        tenantId: membership.tenantId,
        shipstationCarrierId,
        shipstationServiceCode,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A mapping for this carrier/service already exists' },
        { status: 400 }
      )
    }

    // Create mapping
    const mapping = await db.carrierServiceMapping.create({
      data: {
        tenantId: membership.tenantId,
        shipstationCarrierId,
        shipstationCarrierCode,
        shipstationServiceCode,
        carrierName,
        serviceName,
        paceShipViaId: parseInt(paceShipViaId),
        paceShipViaName,
        trackingUrlTemplate: trackingUrlTemplate || null,
      },
    })

    return NextResponse.json({ success: true, data: mapping }, { status: 201 })
  } catch (error: any) {
    console.error('[API] Carrier service mapping POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create carrier service mapping' },
      { status: 500 }
    )
  }
}
