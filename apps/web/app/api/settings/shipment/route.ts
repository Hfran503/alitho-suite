import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/settings/shipment - Get shipment settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      include: { tenant: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Get or create shipment settings
    let settings = await db.shipmentSettings.findUnique({
      where: { tenantId: membership.tenantId },
    })

    if (!settings) {
      // Create default settings if they don't exist
      settings = await db.shipmentSettings.create({
        data: {
          tenantId: membership.tenantId,
          enforcePoValidation: true, // Default to enabled
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('Get shipment settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/settings/shipment - Update shipment settings
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      include: { tenant: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const body = await req.json()
    const { enforcePoValidation } = body

    if (typeof enforcePoValidation !== 'boolean') {
      return NextResponse.json(
        { error: 'enforcePoValidation must be a boolean' },
        { status: 400 }
      )
    }

    // Upsert settings
    const settings = await db.shipmentSettings.upsert({
      where: { tenantId: membership.tenantId },
      update: { enforcePoValidation },
      create: {
        tenantId: membership.tenantId,
        enforcePoValidation,
      },
    })

    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('Update shipment settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
