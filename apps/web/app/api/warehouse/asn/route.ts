import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, ASNStatus } from '@repo/database'
import { z } from 'zod'

const createASNSchema = z.object({
  customerId: z.string().optional().nullable(),
  vendorName: z.string().min(1),
  vendorEmail: z.string().email().optional().nullable(),
  warehouseId: z.string().min(1),
  expectedDate: z.string().transform((str) => new Date(str)),
  carrier: z.string().optional().nullable(),
  trackingNumber: z.string().optional().nullable(),
  poNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    itemId: z.string().optional().nullable(),
    sku: z.string().min(1),
    description: z.string().min(1),
    expectedQty: z.number().int().positive(),
    lotNumber: z.string().optional().nullable(),
    expirationDate: z.string().optional().nullable().transform((str) => str ? new Date(str) : null),
  })).min(1),
})

// GET /api/warehouse/asn - List ASNs
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
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') as ASNStatus | null
    const warehouseId = searchParams.get('warehouseId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where = {
      tenantId: membership.tenantId,
      ...(search && {
        OR: [
          { asnNumber: { contains: search, mode: 'insensitive' as const } },
          { vendorName: { contains: search, mode: 'insensitive' as const } },
          { poNumber: { contains: search, mode: 'insensitive' as const } },
          { trackingNumber: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(status && { status }),
      ...(warehouseId && { warehouseId }),
    }

    const [asns, total] = await Promise.all([
      db.aSN.findMany({
        where,
        include: {
          warehouse: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, company: true, paceCustomerId: true } },
          items: { select: { id: true, sku: true, expectedQty: true, receivedQty: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.aSN.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: asns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching ASNs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ASNs' },
      { status: 500 }
    )
  }
}

// POST /api/warehouse/asn - Create ASN
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
    const validatedData = createASNSchema.parse(body)

    // Verify warehouse exists and belongs to tenant
    const warehouse = await db.warehouse.findFirst({
      where: { id: validatedData.warehouseId, tenantId: membership.tenantId },
    })

    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    // Generate ASN number
    const year = new Date().getFullYear()
    const lastASN = await db.aSN.findFirst({
      where: {
        tenantId: membership.tenantId,
        asnNumber: { startsWith: `ASN-${year}-` },
      },
      orderBy: { asnNumber: 'desc' },
    })

    let nextNumber = 1
    if (lastASN) {
      const parts = lastASN.asnNumber.split('-')
      const lastNum = parseInt(parts[2] || '0')
      nextNumber = lastNum + 1
    }

    const asnNumber = `ASN-${year}-${nextNumber.toString().padStart(4, '0')}`

    // Create ASN with items
    const asn = await db.aSN.create({
      data: {
        asnNumber,
        tenantId: membership.tenantId,
        customerId: validatedData.customerId || null,
        vendorName: validatedData.vendorName,
        vendorEmail: validatedData.vendorEmail,
        warehouseId: validatedData.warehouseId,
        expectedDate: validatedData.expectedDate,
        carrier: validatedData.carrier,
        trackingNumber: validatedData.trackingNumber,
        poNumber: validatedData.poNumber,
        notes: validatedData.notes,
        status: 'DRAFT',
        items: {
          create: validatedData.items.map((item) => ({
            itemId: item.itemId,
            sku: item.sku,
            description: item.description,
            expectedQty: item.expectedQty,
            lotNumber: item.lotNumber,
            expirationDate: item.expirationDate,
          })),
        },
      },
      include: {
        warehouse: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, company: true, paceCustomerId: true } },
        items: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: asn,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating ASN:', error)
    return NextResponse.json(
      { error: 'Failed to create ASN' },
      { status: 500 }
    )
  }
}
