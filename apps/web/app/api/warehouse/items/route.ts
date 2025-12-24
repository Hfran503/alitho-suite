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

const itemTypeSchema = z.enum(['STANDARD', 'KIT_COMPONENT', 'KIT_AND_COMPONENT', 'KIT'])

const createItemSchema = z.object({
  customerId: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  upc: z.string().optional().nullable(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  itemType: itemTypeSchema.default('STANDARD'),
  weight: z.number().positive().optional().nullable(),
  dimensions: dimensionsSchema,
  isActive: z.boolean().default(true),
  trackByReference: z.boolean().default(false),
  // Pricing
  sellPrice: z.number().nonnegative().optional().nullable(),
  // Bulk ordering fields
  canOrderInBulk: z.boolean().default(false),
  bulkUnitName: z.string().optional().nullable(),
  unitsPerBulk: z.number().int().positive().optional().nullable(),
  bulkSellPrice: z.number().nonnegative().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
})

// GET /api/warehouse/items - List items with filters and search
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
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const customerId = searchParams.get('customerId')
    const isActive = searchParams.get('isActive')
    const itemType = searchParams.get('itemType')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      tenantId: membership.tenantId,
    }

    if (category) {
      where.category = category
    }

    if (customerId) {
      where.customerId = customerId
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true'
    }

    if (itemType) {
      // Support comma-separated values for multiple types
      const types = itemType.split(',').filter(Boolean)
      if (types.length === 1) {
        where.itemType = types[0]
      } else if (types.length > 1) {
        where.itemType = { in: types }
      }
    }

    if (search) {
      where.OR = [
        { itemCode: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { upc: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Get items with pagination
    const [items, total] = await Promise.all([
      db.inventoryItem.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, company: true, paceCustomerId: true },
          },
          stockLevels: {
            select: { available: true, referenceNumber: true, lotNumber: true },
          },
        },
        orderBy: [
          { itemCode: 'desc' },
        ],
        skip,
        take: limit,
      }),
      db.inventoryItem.count({ where }),
    ])

    // Calculate total available for each item
    // For items that track by reference, also include stock breakdown
    const itemsWithStock = items.map((item: (typeof items)[number]) => {
      const totalAvailable = item.stockLevels.reduce((sum: number, s: (typeof item.stockLevels)[number]) => sum + s.available, 0)

      // For trackByReference items, group stock by reference number
      let stockByReference: { referenceNumber: string | null; available: number }[] | undefined
      if (item.trackByReference) {
        const refMap = new Map<string | null, number>()
        for (const stock of item.stockLevels) {
          if (stock.available > 0) {
            const current = refMap.get(stock.referenceNumber) || 0
            refMap.set(stock.referenceNumber, current + stock.available)
          }
        }
        stockByReference = Array.from(refMap.entries())
          .map(([referenceNumber, available]) => ({ referenceNumber, available }))
          .sort((a, b) => (a.referenceNumber || '').localeCompare(b.referenceNumber || ''))
      }

      return {
        ...item,
        available: totalAvailable,
        stockByReference,
        stockLevels: undefined, // Remove raw stock levels from response
      }
    })

    // Get unique categories for filter dropdown
    const categories = await db.inventoryItem.findMany({
      where: { tenantId: membership.tenantId },
      select: { category: true },
      distinct: ['category'],
    })

    // Get customers for filter dropdown
    const customers = await db.warehouseCustomer.findMany({
      where: { tenantId: membership.tenantId, isActive: true },
      select: { id: true, name: true, company: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: itemsWithStock,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        categories: categories.map((c: (typeof categories)[number]) => c.category).filter(Boolean),
        customers,
      },
    })
  } catch (error) {
    console.error('Error fetching items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    )
  }
}

// POST /api/warehouse/items - Create a new item
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const validatedData = createItemSchema.parse(body)

    // Check if SKU already exists for this tenant (only if SKU is provided)
    if (validatedData.sku) {
      const existingItem = await db.inventoryItem.findFirst({
        where: {
          tenantId: membership.tenantId,
          sku: validatedData.sku,
        },
      })

      if (existingItem) {
        return NextResponse.json(
          { error: 'An item with this SKU already exists' },
          { status: 400 }
        )
      }
    }

    // Generate next itemCode (CSI-XXXX)
    const lastItem = await db.inventoryItem.findFirst({
      where: {
        tenantId: membership.tenantId,
        itemCode: { not: null },
      },
      orderBy: { itemCode: 'desc' },
      select: { itemCode: true },
    })

    let nextNumber = 1
    if (lastItem?.itemCode) {
      const match = lastItem.itemCode.match(/CSI-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }
    const itemCode = `CSI-${String(nextNumber).padStart(4, '0')}`

    // Create the item with proper null handling for JSON fields
    const item = await db.inventoryItem.create({
      data: {
        tenantId: membership.tenantId,
        itemCode,
        customerId: validatedData.customerId || null,
        sku: validatedData.sku || null,
        upc: validatedData.upc,
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category,
        itemType: validatedData.itemType,
        weight: validatedData.weight,
        dimensions: validatedData.dimensions == null ? Prisma.JsonNull : validatedData.dimensions,
        isActive: validatedData.isActive,
        trackByReference: validatedData.trackByReference,
        // Pricing
        sellPrice: validatedData.sellPrice,
        // Bulk ordering fields
        canOrderInBulk: validatedData.canOrderInBulk,
        bulkUnitName: validatedData.bulkUnitName,
        unitsPerBulk: validatedData.unitsPerBulk,
        bulkSellPrice: validatedData.bulkSellPrice,
        metadata: validatedData.metadata == null ? Prisma.JsonNull : validatedData.metadata,
      },
      include: {
        customer: {
          select: { id: true, name: true, company: true, paceCustomerId: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: item,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating item:', error)
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    )
  }
}
