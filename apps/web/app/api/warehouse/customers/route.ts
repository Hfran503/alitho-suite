import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

const createCustomerSchema = z.object({
  paceCustomerId: z.string().min(1, 'PACE Customer ID is required'),
  name: z.string().min(1, 'Customer name is required'),
  company: z.string().optional().nullable(),
})

// GET /api/warehouse/customers - List warehouse customers
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

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const activeOnly = searchParams.get('activeOnly') !== 'false'
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where = {
      tenantId: membership.tenantId,
      ...(activeOnly && { isActive: true }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { company: { contains: search, mode: 'insensitive' as const } },
          { paceCustomerId: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const [customers, total] = await Promise.all([
      db.warehouseCustomer.findMany({
        where,
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: {
              inventoryItems: true,
              asns: true,
            },
          },
        },
      }),
      db.warehouseCustomer.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: customers,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + customers.length < total,
      },
    })
  } catch (error) {
    console.error('Error fetching warehouse customers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch warehouse customers' },
      { status: 500 }
    )
  }
}

// POST /api/warehouse/customers - Add a PACE customer to warehouse
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

    // Only admin, full_admin, warehouse, logistics can add customers
    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validation = createCustomerSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { paceCustomerId, name, company } = validation.data

    // Check if customer already exists
    const existing = await db.warehouseCustomer.findFirst({
      where: {
        tenantId: membership.tenantId,
        paceCustomerId,
      },
    })

    if (existing) {
      // If exists but inactive, reactivate
      if (!existing.isActive) {
        const updated = await db.warehouseCustomer.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            name,
            company,
            lastSyncedAt: new Date(),
          },
        })
        return NextResponse.json({
          success: true,
          data: updated,
          message: 'Customer reactivated',
        })
      }
      return NextResponse.json(
        { error: 'Customer already exists in warehouse' },
        { status: 409 }
      )
    }

    const customer = await db.warehouseCustomer.create({
      data: {
        tenantId: membership.tenantId,
        paceCustomerId,
        name,
        company,
        isActive: true,
        lastSyncedAt: new Date(),
      },
    })

    return NextResponse.json(
      { success: true, data: customer },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating warehouse customer:', error)
    return NextResponse.json(
      { error: 'Failed to create warehouse customer' },
      { status: 500 }
    )
  }
}
