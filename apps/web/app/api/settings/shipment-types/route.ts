import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/settings/shipment-types - List all mappings for tenant
export async function GET() {
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

    const mappings = await db.shipmentTypeMapping.findMany({
      where: { tenantId: membership.tenantId },
      orderBy: { plannedTypeName: 'asc' },
    })

    return NextResponse.json({ success: true, data: mappings })
  } catch (error: any) {
    console.error('Get shipment type mappings error:', error)
    return NextResponse.json(
      { error: 'Failed to get mappings', message: error.message },
      { status: 500 }
    )
  }
}

// POST /api/settings/shipment-types - Create new mapping
export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const { plannedTypeId, plannedTypeName, completedTypeId, completedTypeName } = body

    if (!plannedTypeId || !plannedTypeName || !completedTypeId || !completedTypeName) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Check for duplicate mappings
    const existing = await db.shipmentTypeMapping.findFirst({
      where: {
        tenantId: membership.tenantId,
        OR: [
          { plannedTypeId },
          { completedTypeId },
        ],
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A mapping already exists for one of these shipment types' },
        { status: 400 }
      )
    }

    const mapping = await db.shipmentTypeMapping.create({
      data: {
        plannedTypeId,
        plannedTypeName,
        completedTypeId,
        completedTypeName,
        tenantId: membership.tenantId,
      },
    })

    return NextResponse.json({ success: true, data: mapping })
  } catch (error: any) {
    console.error('Create shipment type mapping error:', error)
    return NextResponse.json(
      { error: 'Failed to create mapping', message: error.message },
      { status: 500 }
    )
  }
}
