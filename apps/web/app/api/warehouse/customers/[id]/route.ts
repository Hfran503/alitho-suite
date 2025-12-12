import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().optional(),
  isActive: z.boolean().optional(),
})

// GET /api/warehouse/customers/[id] - Get single warehouse customer
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

    const customer = await db.warehouseCustomer.findFirst({
      where: { id, tenantId: membership.tenantId },
      include: {
        _count: {
          select: {
            inventoryItems: true,
            asns: true,
          },
        },
      },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: customer })
  } catch (error) {
    console.error('Error fetching warehouse customer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch warehouse customer' },
      { status: 500 }
    )
  }
}

// PATCH /api/warehouse/customers/[id] - Update warehouse customer
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

    const existing = await db.warehouseCustomer.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const body = await request.json()
    const validation = updateCustomerSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const updated = await db.warehouseCustomer.update({
      where: { id },
      data: validation.data,
      include: {
        _count: {
          select: {
            inventoryItems: true,
            asns: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error updating warehouse customer:', error)
    return NextResponse.json(
      { error: 'Failed to update warehouse customer' },
      { status: 500 }
    )
  }
}

// DELETE /api/warehouse/customers/[id] - Remove warehouse customer
export async function DELETE(
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

    const allowedRoles = ['admin', 'full_admin', 'warehouse']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const existing = await db.warehouseCustomer.findFirst({
      where: { id, tenantId: membership.tenantId },
      include: {
        _count: {
          select: {
            inventoryItems: true,
            asns: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Check if customer has associated records
    if (existing._count.inventoryItems > 0 || existing._count.asns > 0) {
      // Soft delete by deactivating
      await db.warehouseCustomer.update({
        where: { id },
        data: { isActive: false },
      })
      return NextResponse.json({
        success: true,
        message: 'Customer deactivated (has associated inventory items or ASNs)',
      })
    }

    // Hard delete if no associations
    await db.warehouseCustomer.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Customer removed from warehouse',
    })
  } catch (error) {
    console.error('Error deleting warehouse customer:', error)
    return NextResponse.json(
      { error: 'Failed to delete warehouse customer' },
      { status: 500 }
    )
  }
}
