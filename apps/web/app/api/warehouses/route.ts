import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db as prisma } from '@repo/database'
import { z } from 'zod'

const createWarehouseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  companyName: z.string().optional().nullable(),
  addressLine1: z.string().min(1, 'Address is required'),
  addressLine2: z.string().optional().nullable(),
  cityLocality: z.string().min(1, 'City is required'),
  stateProvince: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  countryCode: z.string().default('US'),
  phone: z.string().optional().nullable(),
  isDefault: z.boolean().default(false),
  warehouseType: z.enum(['STORAGE_FACILITY', 'BOTH']).default('STORAGE_FACILITY'),
})

// GET - List warehouses
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const includeLocationCount = searchParams.get('includeLocationCount') === 'true'

    const warehouses = await prisma.warehouse.findMany({
      where: {
        tenantId: membership.tenantId,
        // Only show storage facilities in WMS (not shipping-only origins)
        warehouseType: { in: ['STORAGE_FACILITY', 'BOTH'] },
      },
      include: includeLocationCount ? {
        _count: {
          select: { locations: true }
        }
      } : undefined,
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
    })

    return NextResponse.json({ warehouses })
  } catch (error) {
    console.error('Error fetching warehouses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch warehouses' },
      { status: 500 }
    )
  }
}

// POST - Create warehouse
export async function POST(request: NextRequest) {
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

    // Check role permissions
    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validation = createWarehouseSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await prisma.warehouse.updateMany({
        where: {
          tenantId: membership.tenantId,
          isDefault: true,
        },
        data: { isDefault: false },
      })
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        ...data,
        tenantId: membership.tenantId,
      },
    })

    return NextResponse.json({ data: warehouse }, { status: 201 })
  } catch (error) {
    console.error('Error creating warehouse:', error)
    return NextResponse.json(
      { error: 'Failed to create warehouse' },
      { status: 500 }
    )
  }
}
