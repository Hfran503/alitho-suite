import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

const quoteItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative'),
  sortOrder: z.number().int().optional().default(0),
})

const bulkUpdateSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      description: z.string().optional().nullable(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative(),
      sortOrder: z.number().int().optional().default(0),
    })
  ),
})

// GET /api/crm/quotes/[id]/items - List quote items
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

    // Verify quote belongs to tenant
    const quote = await db.quote.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const items = await db.quoteItem.findMany({
      where: { quoteId: id },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ success: true, data: items })
  } catch (error) {
    console.error('Error fetching quote items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quote items' },
      { status: 500 }
    )
  }
}

// POST /api/crm/quotes/[id]/items - Add quote item
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

    const { id } = await params

    const quote = await db.quote.findFirst({
      where: { id, tenantId: membership.tenantId },
      include: { items: true },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const body = await request.json()
    const validation = quoteItemSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const total = validation.data.quantity * validation.data.unitPrice

    const item = await db.quoteItem.create({
      data: {
        ...validation.data,
        total,
        quoteId: id,
      },
    })

    // Recalculate quote totals
    const allItems = await db.quoteItem.findMany({
      where: { quoteId: id },
    })

    const subtotal = allItems.reduce((sum, item) => sum + Number(item.total), 0)
    const tax = Number(quote.tax)
    const newTotal = subtotal + tax

    await db.quote.update({
      where: { id },
      data: {
        subtotal,
        total: newTotal,
      },
    })

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (error) {
    console.error('Error creating quote item:', error)
    return NextResponse.json(
      { error: 'Failed to create quote item' },
      { status: 500 }
    )
  }
}

// PATCH /api/crm/quotes/[id]/items - Bulk update items
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

    const { id } = await params

    const quote = await db.quote.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const body = await request.json()
    const validation = bulkUpdateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Delete existing items and create new ones
    await db.quoteItem.deleteMany({
      where: { quoteId: id },
    })

    const itemsWithTotals = validation.data.items.map((item) => ({
      ...item,
      total: item.quantity * item.unitPrice,
      quoteId: id,
    }))

    await db.quoteItem.createMany({
      data: itemsWithTotals,
    })

    // Recalculate quote totals
    const subtotal = itemsWithTotals.reduce(
      (sum, item) => sum + Number(item.total),
      0
    )
    const tax = Number(quote.tax)
    const newTotal = subtotal + tax

    const updatedQuote = await db.quote.update({
      where: { id },
      data: {
        subtotal,
        total: newTotal,
      },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        contact: true,
        opportunity: true,
      },
    })

    return NextResponse.json({ success: true, data: updatedQuote })
  } catch (error) {
    console.error('Error updating quote items:', error)
    return NextResponse.json(
      { error: 'Failed to update quote items' },
      { status: 500 }
    )
  }
}
