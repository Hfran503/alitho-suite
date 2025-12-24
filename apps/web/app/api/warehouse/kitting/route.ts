import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, Prisma } from '@repo/database'
import { z } from 'zod'

// GET /api/warehouse/kitting - List kit assemblies
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const kitId = searchParams.get('kitId')
    const skip = (page - 1) * limit

    const where = {
      tenantId: membership.tenantId,
      ...(kitId && { kitId }),
    }

    const [assemblies, total] = await Promise.all([
      db.kitAssembly.findMany({
        where,
        include: {
          kit: {
            select: {
              id: true,
              itemCode: true,
              sku: true,
              name: true,
            },
          },
          location: {
            select: {
              id: true,
              barcode: true,
              name: true,
              warehouse: {
                select: { id: true, name: true },
              },
            },
          },
          assembledBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { assembledAt: 'desc' },
        skip,
        take: limit,
      }),
      db.kitAssembly.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: assemblies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching kit assemblies:', error)
    return NextResponse.json(
      { error: 'Failed to fetch kit assemblies' },
      { status: 500 }
    )
  }
}

// POST /api/warehouse/kitting - Assemble kits
const assembleKitSchema = z.object({
  kitId: z.string().min(1, 'Kit is required'),
  locationId: z.string().min(1, 'Location is required'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  notes: z.string().optional().nullable(),
})

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

    // Check permissions
    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = assembleKitSchema.parse(body)

    // Get the kit with its components
    const kit = await db.inventoryItem.findFirst({
      where: {
        id: validatedData.kitId,
        tenantId: membership.tenantId,
        itemType: { in: ['KIT', 'KIT_AND_COMPONENT'] },
      },
      include: {
        kitComponents: {
          include: {
            component: {
              select: { id: true, itemCode: true, sku: true, name: true },
            },
          },
        },
      },
    })

    if (!kit) {
      return NextResponse.json({ error: 'Kit not found or not a kit type' }, { status: 404 })
    }

    if (kit.kitComponents.length === 0) {
      return NextResponse.json({ error: 'Kit has no components defined' }, { status: 400 })
    }

    // Verify location exists and belongs to tenant
    const location = await db.warehouseLocation.findFirst({
      where: {
        id: validatedData.locationId,
        tenantId: membership.tenantId,
        isActive: true,
      },
    })

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    // Check component availability
    const componentRequirements = kit.kitComponents.map((kc: (typeof kit.kitComponents)[number]) => ({
      componentId: kc.componentId,
      component: kc.component,
      requiredQty: kc.quantity * validatedData.quantity,
    }))

    // Get available stock for all components
    const componentStock = await db.inventoryStock.groupBy({
      by: ['itemId'],
      where: {
        tenantId: membership.tenantId,
        itemId: { in: componentRequirements.map((c: (typeof componentRequirements)[number]) => c.componentId) },
      },
      _sum: {
        available: true,
      },
    })

    const stockMap = new Map(componentStock.map((s: (typeof componentStock)[number]) => [s.itemId, s._sum.available || 0]))

    // Check each component has sufficient stock
    const shortages: Array<{ component: string; required: number; available: number }> = []
    for (const req of componentRequirements) {
      const available = stockMap.get(req.componentId) || 0
      if (available < req.requiredQty) {
        shortages.push({
          component: `${req.component.itemCode || req.component.sku || req.component.name}`,
          required: req.requiredQty,
          available,
        })
      }
    }

    if (shortages.length > 0) {
      return NextResponse.json({
        error: 'Insufficient component stock',
        shortages,
      }, { status: 400 })
    }

    // Perform the assembly in a transaction
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Deduct components from inventory (from ANY location with stock)
      for (const req of componentRequirements) {
        let remainingToDeduct = req.requiredQty

        // Get all stock records for this component, ordered by available qty
        const stockRecords = await tx.inventoryStock.findMany({
          where: {
            tenantId: membership.tenantId,
            itemId: req.componentId,
            available: { gt: 0 },
          },
          orderBy: { available: 'desc' },
        })

        for (const stock of stockRecords) {
          if (remainingToDeduct <= 0) break

          const deductQty = Math.min(stock.available, remainingToDeduct)
          const previousQty = stock.available
          const newQty = stock.available - deductQty

          // Update stock
          await tx.inventoryStock.update({
            where: { id: stock.id },
            data: { available: { decrement: deductQty } },
          })

          // Create transaction record
          await tx.inventoryTransaction.create({
            data: {
              tenantId: membership.tenantId,
              itemId: req.componentId,
              locationId: stock.locationId,
              type: 'KIT_ASSEMBLE',
              quantity: -deductQty,
              previousQty,
              newQty,
              userId: session.user.id,
              notes: `Component consumed for kit assembly: ${kit.itemCode || kit.sku || kit.name} x ${validatedData.quantity}`,
              referenceType: 'kit_assembly',
            },
          })

          remainingToDeduct -= deductQty
        }
      }

      // 2. Add assembled kits to inventory at specified location
      // First, try to find existing stock record for this kit at this location
      let kitStock = await tx.inventoryStock.findFirst({
        where: {
          tenantId: membership.tenantId,
          itemId: kit.id,
          locationId: validatedData.locationId,
          lotNumber: null,
          referenceNumber: null,
        },
      })

      const kitPreviousQty = kitStock?.available ?? 0

      if (kitStock) {
        // Update existing stock
        kitStock = await tx.inventoryStock.update({
          where: { id: kitStock.id },
          data: { available: { increment: validatedData.quantity } },
        })
      } else {
        // Create new stock record
        kitStock = await tx.inventoryStock.create({
          data: {
            tenantId: membership.tenantId,
            itemId: kit.id,
            locationId: validatedData.locationId,
            available: validatedData.quantity,
            reserved: 0,
            damaged: 0,
            onHold: 0,
          },
        })
      }

      const kitNewQty = kitPreviousQty + validatedData.quantity

      // Create transaction for kit production
      await tx.inventoryTransaction.create({
        data: {
          tenantId: membership.tenantId,
          itemId: kit.id,
          locationId: validatedData.locationId,
          type: 'KIT_PRODUCE',
          quantity: validatedData.quantity,
          previousQty: kitPreviousQty,
          newQty: kitNewQty,
          userId: session.user.id,
          notes: validatedData.notes || `Kit assembled: ${validatedData.quantity} units`,
          referenceType: 'kit_assembly',
        },
      })

      // 3. Create assembly record
      const assembly = await tx.kitAssembly.create({
        data: {
          tenantId: membership.tenantId,
          kitId: kit.id,
          locationId: validatedData.locationId,
          quantity: validatedData.quantity,
          assembledById: session.user.id,
          notes: validatedData.notes,
        },
        include: {
          kit: {
            select: { id: true, itemCode: true, sku: true, name: true },
          },
          location: {
            select: {
              id: true,
              barcode: true,
              name: true,
              warehouse: { select: { id: true, name: true } },
            },
          },
          assembledBy: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      return assembly
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: `Successfully assembled ${validatedData.quantity} ${kit.itemCode || kit.name}`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error assembling kit:', error)
    return NextResponse.json(
      { error: 'Failed to assemble kit' },
      { status: 500 }
    )
  }
}
