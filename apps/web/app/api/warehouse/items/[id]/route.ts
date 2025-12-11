import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, Prisma } from '@repo/database'
import { z } from 'zod'

const dimensionsSchema = z.object({
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  unit: z.enum(['in', 'cm']).default('in'),
}).optional().nullable()

const updateItemSchema = z.object({
  sku: z.string().min(1).optional(),
  upc: z.string().optional().nullable(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  weight: z.number().positive().optional().nullable(),
  dimensions: dimensionsSchema,
  isActive: z.boolean().optional(),
  metadata: z.record(z.any()).optional().nullable(),
})

// GET /api/warehouse/items/[id] - Get single item
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params

    const item = await db.inventoryItem.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: item,
    })
  } catch (error) {
    console.error('Error fetching item:', error)
    return NextResponse.json(
      { error: 'Failed to fetch item' },
      { status: 500 }
    )
  }
}

// PATCH /api/warehouse/items/[id] - Update item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant and role
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

    const { id } = await params

    // Verify item belongs to tenant
    const existing = await db.inventoryItem.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = updateItemSchema.parse(body)

    // If SKU is being changed, check it doesn't conflict
    if (validatedData.sku && validatedData.sku !== existing.sku) {
      const skuExists = await db.inventoryItem.findUnique({
        where: {
          tenantId_sku: {
            tenantId: membership.tenantId,
            sku: validatedData.sku,
          },
        },
      })

      if (skuExists) {
        return NextResponse.json(
          { error: 'An item with this SKU already exists' },
          { status: 400 }
        )
      }
    }

    // Build update data with proper null handling for JSON fields
    const updateData: Prisma.InventoryItemUpdateInput = {
      ...(validatedData.sku !== undefined && { sku: validatedData.sku }),
      ...(validatedData.upc !== undefined && { upc: validatedData.upc }),
      ...(validatedData.name !== undefined && { name: validatedData.name }),
      ...(validatedData.description !== undefined && { description: validatedData.description }),
      ...(validatedData.category !== undefined && { category: validatedData.category }),
      ...(validatedData.weight !== undefined && { weight: validatedData.weight }),
      ...(validatedData.isActive !== undefined && { isActive: validatedData.isActive }),
      // Handle JSON fields with proper Prisma null type
      ...(validatedData.dimensions !== undefined && {
        dimensions: validatedData.dimensions === null ? Prisma.JsonNull : validatedData.dimensions,
      }),
      ...(validatedData.metadata !== undefined && {
        metadata: validatedData.metadata === null ? Prisma.JsonNull : validatedData.metadata,
      }),
    }

    // Update the item
    const item = await db.inventoryItem.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: item,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating item:', error)
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

// DELETE /api/warehouse/items/[id] - Delete item
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant and role
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Only admin roles can delete
    const allowedRoles = ['admin', 'full_admin']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Verify item belongs to tenant
    const existing = await db.inventoryItem.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // TODO: In Module 3, check if item has inventory stock before deleting
    // For now, just delete the item

    await db.inventoryItem.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Item deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting item:', error)
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}
