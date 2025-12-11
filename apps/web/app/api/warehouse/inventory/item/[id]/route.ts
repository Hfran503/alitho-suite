import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getStockByItem } from '@/lib/services/inventory'

// GET /api/warehouse/inventory/item/[id] - Get stock for a specific item
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

    // Verify item belongs to tenant
    const item = await db.inventoryItem.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const stockData = await getStockByItem(membership.tenantId, id)

    return NextResponse.json({
      success: true,
      data: stockData,
    })
  } catch (error) {
    console.error('Error fetching item stock:', error)
    return NextResponse.json(
      { error: 'Failed to fetch item stock' },
      { status: 500 }
    )
  }
}
