import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db as prisma } from '@repo/database'
import { z } from 'zod'

const updateWarehouseSchema = z.object({
  name: z.string().min(1).optional(),
  companyName: z.string().optional().nullable(),
  addressLine1: z.string().min(1).optional(),
  addressLine2: z.string().optional().nullable(),
  cityLocality: z.string().min(1).optional(),
  stateProvince: z.string().min(1).optional(),
  postalCode: z.string().min(1).optional(),
  countryCode: z.string().optional(),
  phone: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
  warehouseType: z.enum(['STORAGE_FACILITY', 'BOTH']).optional(),
})

// GET - Get single warehouse
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
    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const { id } = await params

    const warehouse = await prisma.warehouse.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
        // Only allow access to storage facilities in WMS
        warehouseType: { in: ['STORAGE_FACILITY', 'BOTH'] },
      },
      include: {
        _count: {
          select: { locations: true }
        }
      }
    })

    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    return NextResponse.json({ data: warehouse })
  } catch (error) {
    console.error('Error fetching warehouse:', error)
    return NextResponse.json(
      { error: 'Failed to fetch warehouse' },
      { status: 500 }
    )
  }
}

// PATCH - Update warehouse
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
    const membership = await prisma.membership.findFirst({
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

    // Verify warehouse belongs to tenant and is a storage facility
    const existing = await prisma.warehouse.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
        warehouseType: { in: ['STORAGE_FACILITY', 'BOTH'] },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    const body = await request.json()
    const validation = updateWarehouseSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // If setting as default, unset other defaults
    if (data.isDefault === true) {
      await prisma.warehouse.updateMany({
        where: {
          tenantId: membership.tenantId,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      })
    }

    const warehouse = await prisma.warehouse.update({
      where: { id },
      data,
    })

    return NextResponse.json({ data: warehouse })
  } catch (error) {
    console.error('Error updating warehouse:', error)
    return NextResponse.json(
      { error: 'Failed to update warehouse' },
      { status: 500 }
    )
  }
}

// DELETE - Delete warehouse
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
    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const allowedRoles = ['admin', 'full_admin']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Verify warehouse belongs to tenant and is a storage facility
    const existing = await prisma.warehouse.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
        warehouseType: { in: ['STORAGE_FACILITY', 'BOTH'] },
      },
      include: {
        _count: {
          select: { locations: true }
        }
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    // Prevent deletion if warehouse has locations
    if (existing._count.locations > 0) {
      return NextResponse.json(
        { error: `Cannot delete warehouse with ${existing._count.locations} location(s). Remove locations first.` },
        { status: 400 }
      )
    }

    await prisma.warehouse.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting warehouse:', error)
    return NextResponse.json(
      { error: 'Failed to delete warehouse' },
      { status: 500 }
    )
  }
}
