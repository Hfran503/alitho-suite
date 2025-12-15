import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

const createComponentSchema = z.object({
  componentId: z.string().min(1, 'Component item is required'),
  quantity: z.number().int().positive().default(1),
  sortOrder: z.number().int().optional().default(0),
  notes: z.string().optional().nullable(),
})

const updateComponentSchema = z.object({
  kitComponentId: z.string().min(1, 'Kit component ID is required'),
  quantity: z.number().int().positive().optional(),
  sortOrder: z.number().int().optional(),
  notes: z.string().optional().nullable(),
})

const deleteComponentSchema = z.object({
  kitComponentId: z.string().min(1, 'Kit component ID is required'),
})

// GET /api/warehouse/items/[id]/components - List components for a kit
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

    // Verify kit belongs to tenant
    const kit = await db.inventoryItem.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!kit) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Get components for this kit
    const components = await db.kitComponent.findMany({
      where: { kitId: id },
      include: {
        component: {
          select: {
            id: true,
            itemCode: true,
            sku: true,
            name: true,
            description: true,
            isActive: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: components,
    })
  } catch (error) {
    console.error('Error fetching kit components:', error)
    return NextResponse.json(
      { error: 'Failed to fetch kit components' },
      { status: 500 }
    )
  }
}

// POST /api/warehouse/items/[id]/components - Add a component to a kit
export async function POST(
  request: NextRequest,
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

    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Verify kit belongs to tenant and is a kit type
    const kit = await db.inventoryItem.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!kit) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (kit.itemType !== 'KIT' && kit.itemType !== 'KIT_AND_COMPONENT') {
      return NextResponse.json(
        { error: 'Item must be a kit type to have components' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = createComponentSchema.parse(body)

    // Verify component exists and belongs to same tenant
    const component = await db.inventoryItem.findFirst({
      where: {
        id: validatedData.componentId,
        tenantId: membership.tenantId,
      },
    })

    if (!component) {
      return NextResponse.json({ error: 'Component item not found' }, { status: 404 })
    }

    // Prevent kit from containing itself
    if (validatedData.componentId === id) {
      return NextResponse.json(
        { error: 'A kit cannot contain itself as a component' },
        { status: 400 }
      )
    }

    // Check if component already exists in kit
    const existingComponent = await db.kitComponent.findUnique({
      where: {
        kitId_componentId: {
          kitId: id,
          componentId: validatedData.componentId,
        },
      },
    })

    if (existingComponent) {
      return NextResponse.json(
        { error: 'This item is already a component of this kit' },
        { status: 400 }
      )
    }

    // Create the kit component
    const kitComponent = await db.kitComponent.create({
      data: {
        kitId: id,
        componentId: validatedData.componentId,
        quantity: validatedData.quantity,
        sortOrder: validatedData.sortOrder,
        notes: validatedData.notes,
      },
      include: {
        component: {
          select: {
            id: true,
            itemCode: true,
            sku: true,
            name: true,
            description: true,
            isActive: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: kitComponent,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating kit component:', error)
    return NextResponse.json(
      { error: 'Failed to add component to kit' },
      { status: 500 }
    )
  }
}

// PATCH /api/warehouse/items/[id]/components - Update a kit component
export async function PATCH(
  request: NextRequest,
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

    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Verify kit belongs to tenant
    const kit = await db.inventoryItem.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!kit) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = updateComponentSchema.parse(body)

    // Verify component exists and belongs to this kit
    const existingComponent = await db.kitComponent.findFirst({
      where: {
        id: validatedData.kitComponentId,
        kitId: id,
      },
    })

    if (!existingComponent) {
      return NextResponse.json({ error: 'Kit component not found' }, { status: 404 })
    }

    // Update the component
    const kitComponent = await db.kitComponent.update({
      where: { id: validatedData.kitComponentId },
      data: {
        ...(validatedData.quantity !== undefined && { quantity: validatedData.quantity }),
        ...(validatedData.sortOrder !== undefined && { sortOrder: validatedData.sortOrder }),
        ...(validatedData.notes !== undefined && { notes: validatedData.notes }),
      },
      include: {
        component: {
          select: {
            id: true,
            itemCode: true,
            sku: true,
            name: true,
            description: true,
            isActive: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: kitComponent,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating kit component:', error)
    return NextResponse.json(
      { error: 'Failed to update kit component' },
      { status: 500 }
    )
  }
}

// DELETE /api/warehouse/items/[id]/components - Remove a component from a kit
export async function DELETE(
  request: NextRequest,
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

    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Verify kit belongs to tenant
    const kit = await db.inventoryItem.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!kit) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = deleteComponentSchema.parse(body)

    // Verify component exists and belongs to this kit
    const existingComponent = await db.kitComponent.findFirst({
      where: {
        id: validatedData.kitComponentId,
        kitId: id,
      },
    })

    if (!existingComponent) {
      return NextResponse.json({ error: 'Kit component not found' }, { status: 404 })
    }

    // Delete the component
    await db.kitComponent.delete({
      where: { id: validatedData.kitComponentId },
    })

    return NextResponse.json({
      success: true,
      message: 'Component removed from kit successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error deleting kit component:', error)
    return NextResponse.json(
      { error: 'Failed to remove component from kit' },
      { status: 500 }
    )
  }
}
