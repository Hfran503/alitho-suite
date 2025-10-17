import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { createOrderSchema } from '@repo/types'
import { createAuditLog } from '@/lib/audit'

// GET /api/orders - List orders with pagination and filters
export async function GET(req: NextRequest) {
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

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    // Build where clause
    const where: any = {
      tenantId: membership.tenantId,
    }

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Fetch orders with pagination
    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          items: true,
          _count: {
            select: { attachments: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.order.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items: orders,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Get orders error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/orders - Create new order
export async function POST(req: NextRequest) {
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

    // Parse and validate request body
    const body = await req.json()
    const validated = createOrderSchema.parse(body)

    // Generate order number
    const count = await db.order.count({ where: { tenantId: membership.tenantId } })
    const orderNumber = `ORD-${String(count + 1).padStart(6, '0')}`

    // Create order with items
    const order = await db.order.create({
      data: {
        orderNumber,
        status: validated.status,
        customerName: validated.customerName,
        customerEmail: validated.customerEmail,
        customerPhone: validated.customerPhone,
        subtotal: validated.subtotal,
        tax: validated.tax,
        total: validated.total,
        currency: validated.currency,
        shippingAddress: validated.shippingAddress,
        billingAddress: validated.billingAddress,
        notes: validated.notes,
        metadata: validated.metadata,
        tenantId: membership.tenantId,
        items: {
          create: validated.items.map((item) => ({
            sku: item.sku,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            metadata: item.metadata,
          })),
        },
      },
      include: {
        items: true,
      },
    })

    // Create audit log
    await createAuditLog({
      action: 'order.created',
      entityType: 'order',
      entityId: order.id,
      userId: session.user.id,
      tenantId: membership.tenantId,
      orderId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        total: order.total,
      },
    })

    return NextResponse.json({
      success: true,
      data: order,
    })
  } catch (error) {
    console.error('Create order error:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
