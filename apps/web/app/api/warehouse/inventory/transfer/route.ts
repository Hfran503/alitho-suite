import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'
import { transferStock } from '@/lib/services/inventory'

const transferStockSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  fromLocationId: z.string().min(1, 'Source location is required'),
  toLocationId: z.string().min(1, 'Destination location is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  notes: z.string().optional(),
  lotNumber: z.string().optional().nullable(),
})

// POST /api/warehouse/inventory/transfer - Transfer stock between locations
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
    const validatedData = transferStockSchema.parse(body)

    // Verify item belongs to tenant
    const item = await db.inventoryItem.findFirst({
      where: { id: validatedData.itemId, tenantId: membership.tenantId },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Verify both locations belong to tenant
    const [fromLocation, toLocation] = await Promise.all([
      db.warehouseLocation.findFirst({
        where: { id: validatedData.fromLocationId, tenantId: membership.tenantId },
      }),
      db.warehouseLocation.findFirst({
        where: { id: validatedData.toLocationId, tenantId: membership.tenantId },
      }),
    ])

    if (!fromLocation) {
      return NextResponse.json({ error: 'Source location not found' }, { status: 404 })
    }

    if (!toLocation) {
      return NextResponse.json({ error: 'Destination location not found' }, { status: 404 })
    }

    // Perform the transfer
    const result = await transferStock({
      tenantId: membership.tenantId,
      itemId: validatedData.itemId,
      fromLocationId: validatedData.fromLocationId,
      toLocationId: validatedData.toLocationId,
      quantity: validatedData.quantity,
      userId: session.user.id,
      notes: validatedData.notes,
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
    console.error('Error transferring stock:', error)
    return NextResponse.json(
      { error: 'Failed to transfer stock' },
      { status: 500 }
    )
  }
}
