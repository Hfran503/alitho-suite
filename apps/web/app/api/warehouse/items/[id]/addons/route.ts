import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

const applyToSchema = z.enum(['INDIVIDUAL_ONLY', 'BULK_ONLY', 'BOTH'])

const createAddOnSchema = z.object({
  addOnItemId: z.string().min(1, 'Add-on item is required'),
  applyTo: applyToSchema.default('BOTH'),
  quantity: z.number().int().positive().default(1),
  bulkQuantity: z.number().int().positive().optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
  notes: z.string().optional().nullable(),
})

const updateAddOnSchema = z.object({
  addOnId: z.string().min(1, 'Add-on ID is required'),
  applyTo: applyToSchema.optional(),
  quantity: z.number().int().positive().optional(),
  bulkQuantity: z.number().int().positive().optional().nullable(),
  sortOrder: z.number().int().optional(),
  notes: z.string().optional().nullable(),
})

const deleteAddOnSchema = z.object({
  addOnId: z.string().min(1, 'Add-on ID is required'),
})

// GET /api/warehouse/items/[id]/addons - List add-ons for an item
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

    // Verify item belongs to tenant
    const item = await db.inventoryItem.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Get add-ons for this item
    const addOns = await db.itemAddOn.findMany({
      where: { parentItemId: id },
      include: {
        addOnItem: {
          select: {
            id: true,
            sku: true,
            name: true,
            description: true,
            sellPrice: true,
            canOrderInBulk: true,
            bulkUnitName: true,
            unitsPerBulk: true,
            bulkSellPrice: true,
            isActive: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: addOns,
    })
  } catch (error) {
    console.error('Error fetching add-ons:', error)
    return NextResponse.json(
      { error: 'Failed to fetch add-ons' },
      { status: 500 }
    )
  }
}

// POST /api/warehouse/items/[id]/addons - Add a new add-on to an item
export async function POST(
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

    // Verify parent item belongs to tenant
    const parentItem = await db.inventoryItem.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!parentItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = createAddOnSchema.parse(body)

    // Verify add-on item exists and belongs to same tenant
    const addOnItem = await db.inventoryItem.findFirst({
      where: {
        id: validatedData.addOnItemId,
        tenantId: membership.tenantId,
      },
    })

    if (!addOnItem) {
      return NextResponse.json({ error: 'Add-on item not found' }, { status: 404 })
    }

    // Prevent item from being its own add-on
    if (validatedData.addOnItemId === id) {
      return NextResponse.json(
        { error: 'An item cannot be its own add-on' },
        { status: 400 }
      )
    }

    // Check if add-on already exists
    const existingAddOn = await db.itemAddOn.findUnique({
      where: {
        parentItemId_addOnItemId: {
          parentItemId: id,
          addOnItemId: validatedData.addOnItemId,
        },
      },
    })

    if (existingAddOn) {
      return NextResponse.json(
        { error: 'This item is already an add-on' },
        { status: 400 }
      )
    }

    // Create the add-on
    const addOn = await db.itemAddOn.create({
      data: {
        parentItemId: id,
        addOnItemId: validatedData.addOnItemId,
        applyTo: validatedData.applyTo,
        quantity: validatedData.quantity,
        bulkQuantity: validatedData.bulkQuantity,
        sortOrder: validatedData.sortOrder,
        notes: validatedData.notes,
      },
      include: {
        addOnItem: {
          select: {
            id: true,
            sku: true,
            name: true,
            description: true,
            sellPrice: true,
            canOrderInBulk: true,
            bulkUnitName: true,
            unitsPerBulk: true,
            bulkSellPrice: true,
            isActive: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: addOn,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating add-on:', error)
    return NextResponse.json(
      { error: 'Failed to create add-on' },
      { status: 500 }
    )
  }
}

// PATCH /api/warehouse/items/[id]/addons - Update an add-on
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

    // Verify parent item belongs to tenant
    const parentItem = await db.inventoryItem.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!parentItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = updateAddOnSchema.parse(body)

    // Verify add-on exists and belongs to this item
    const existingAddOn = await db.itemAddOn.findFirst({
      where: {
        id: validatedData.addOnId,
        parentItemId: id,
      },
    })

    if (!existingAddOn) {
      return NextResponse.json({ error: 'Add-on not found' }, { status: 404 })
    }

    // Update the add-on
    const addOn = await db.itemAddOn.update({
      where: { id: validatedData.addOnId },
      data: {
        ...(validatedData.applyTo !== undefined && { applyTo: validatedData.applyTo }),
        ...(validatedData.quantity !== undefined && { quantity: validatedData.quantity }),
        ...(validatedData.bulkQuantity !== undefined && { bulkQuantity: validatedData.bulkQuantity }),
        ...(validatedData.sortOrder !== undefined && { sortOrder: validatedData.sortOrder }),
        ...(validatedData.notes !== undefined && { notes: validatedData.notes }),
      },
      include: {
        addOnItem: {
          select: {
            id: true,
            sku: true,
            name: true,
            description: true,
            sellPrice: true,
            canOrderInBulk: true,
            bulkUnitName: true,
            unitsPerBulk: true,
            bulkSellPrice: true,
            isActive: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: addOn,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating add-on:', error)
    return NextResponse.json(
      { error: 'Failed to update add-on' },
      { status: 500 }
    )
  }
}

// DELETE /api/warehouse/items/[id]/addons - Remove an add-on from an item
export async function DELETE(
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

    // Verify parent item belongs to tenant
    const parentItem = await db.inventoryItem.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!parentItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = deleteAddOnSchema.parse(body)

    // Verify add-on exists and belongs to this item
    const existingAddOn = await db.itemAddOn.findFirst({
      where: {
        id: validatedData.addOnId,
        parentItemId: id,
      },
    })

    if (!existingAddOn) {
      return NextResponse.json({ error: 'Add-on not found' }, { status: 404 })
    }

    // Delete the add-on
    await db.itemAddOn.delete({
      where: { id: validatedData.addOnId },
    })

    return NextResponse.json({
      success: true,
      message: 'Add-on removed successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error deleting add-on:', error)
    return NextResponse.json(
      { error: 'Failed to delete add-on' },
      { status: 500 }
    )
  }
}
