import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getStockByLocation } from '@/lib/services/inventory'

// GET /api/warehouse/inventory/location/[id] - Get stock at a specific location
export async function GET(
  _request: NextRequest,
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

    const { id } = await params

    // Verify location belongs to tenant
    const location = await db.warehouseLocation.findFirst({
      where: { id, tenantId: membership.tenantId },
      include: {
        warehouse: {
          select: { id: true, name: true },
        },
      },
    })

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const stockData = await getStockByLocation(membership.tenantId, id)

    return NextResponse.json({
      success: true,
      data: {
        location: {
          id: location.id,
          barcode: location.barcode,
          name: location.name,
          warehouse: location.warehouse,
        },
        items: stockData,
      },
    })
  } catch (error) {
    console.error('Error fetching location stock:', error)
    return NextResponse.json(
      { error: 'Failed to fetch location stock' },
      { status: 500 }
    )
  }
}
