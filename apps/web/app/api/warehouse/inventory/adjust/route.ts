import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'
import { adjustStock } from '@/lib/services/inventory'

const adjustStockSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  locationId: z.string().min(1, 'Location is required'),
  quantity: z.number().int(), // Can be positive or negative
  type: z.enum(['RECEIVE', 'ADJUST', 'DAMAGE']),
  notes: z.string().optional(),
  lotNumber: z.string().optional().nullable(),
})

// POST /api/warehouse/inventory/adjust - Adjust stock levels
export async function POST(request: NextRequest) {
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

    // Check role permissions
    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = adjustStockSchema.parse(body)

    // Verify item belongs to tenant
    const item = await db.inventoryItem.findFirst({
      where: { id: validatedData.itemId, tenantId: membership.tenantId },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Verify location belongs to tenant
    const location = await db.warehouseLocation.findFirst({
      where: { id: validatedData.locationId, tenantId: membership.tenantId },
    })

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    // Perform the adjustment
    const result = await adjustStock({
      tenantId: membership.tenantId,
      itemId: validatedData.itemId,
      locationId: validatedData.locationId,
      quantity: validatedData.quantity,
      type: validatedData.type,
      userId: session.user.id,
      notes: validatedData.notes,
      referenceType: 'ADJUSTMENT',
      lotNumber: validatedData.lotNumber || undefined,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    console.error('Error adjusting stock:', error)
    return NextResponse.json(
      { error: 'Failed to adjust stock' },
      { status: 500 }
    )
  }
}
