import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

const createLocationSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse is required'),
  zone: z.string().optional(),
  aisle: z.string().optional(),
  rack: z.string().optional(),
  shelf: z.string().optional(),
  bin: z.string().optional(),
  barcode: z.string().min(1, 'Barcode is required'),
  name: z.string().optional(),
  locationType: z.enum(['RECEIVING', 'STORAGE', 'SHIPPING', 'STAGING', 'QUARANTINE']).default('STORAGE'),
  maxCapacity: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
})

// GET /api/warehouse/locations - List locations with filters
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get('warehouseId')
    const zone = searchParams.get('zone')
    const locationType = searchParams.get('locationType')
    const isActive = searchParams.get('isActive')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      tenantId: membership.tenantId,
    }

    if (warehouseId) {
      where.warehouseId = warehouseId
    }

    if (zone) {
      where.zone = zone
    }

    if (locationType) {
      where.locationType = locationType
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    if (search) {
      where.OR = [
        { barcode: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { zone: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Get locations with pagination
    const [locations, total] = await Promise.all([
      db.warehouseLocation.findMany({
        where,
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { zone: 'asc' },
          { aisle: 'asc' },
          { rack: 'asc' },
          { shelf: 'asc' },
          { bin: 'asc' },
        ],
        skip,
        take: limit,
      }),
      db.warehouseLocation.count({ where }),
    ])

    // Get unique zones for filter dropdown
    const zones = await db.warehouseLocation.findMany({
      where: { tenantId: membership.tenantId },
      select: { zone: true },
      distinct: ['zone'],
    })

    return NextResponse.json({
      success: true,
      data: locations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        zones: zones.map(z => z.zone).filter(Boolean),
      },
    })
  } catch (error) {
    console.error('Error fetching locations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    )
  }
}

// POST /api/warehouse/locations - Create a new location
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const validatedData = createLocationSchema.parse(body)

    // Verify the warehouse belongs to this tenant
    const warehouse = await db.warehouse.findFirst({
      where: {
        id: validatedData.warehouseId,
        tenantId: membership.tenantId,
      },
    })

    if (!warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      )
    }

    // Check if barcode already exists for this tenant
    const existingLocation = await db.warehouseLocation.findUnique({
      where: {
        tenantId_barcode: {
          tenantId: membership.tenantId,
          barcode: validatedData.barcode,
        },
      },
    })

    if (existingLocation) {
      return NextResponse.json(
        { error: 'A location with this barcode already exists' },
        { status: 400 }
      )
    }

    // Create the location
    const location = await db.warehouseLocation.create({
      data: {
        tenantId: membership.tenantId,
        warehouseId: validatedData.warehouseId,
        zone: validatedData.zone,
        aisle: validatedData.aisle,
        rack: validatedData.rack,
        shelf: validatedData.shelf,
        bin: validatedData.bin,
        barcode: validatedData.barcode,
        name: validatedData.name,
        locationType: validatedData.locationType,
        maxCapacity: validatedData.maxCapacity,
        isActive: validatedData.isActive,
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: location,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating location:', error)
    return NextResponse.json(
      { error: 'Failed to create location' },
      { status: 500 }
    )
  }
}
