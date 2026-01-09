import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

const updateItemSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  quantity: z.number().int().positive().optional(),
  unitPrice: z.number().nonnegative().optional(),
  sortOrder: z.number().int().optional(),
})

// PATCH /api/crm/quotes/[id]/items/[itemId] - Update single item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
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

    const { id, itemId } = await params

    const quote = await db.quote.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const existingItem = await db.quoteItem.findFirst({
      where: { id: itemId, quoteId: id },
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const body = await request.json()
    const validation = updateItemSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Calculate new total if quantity or unitPrice changed
    const quantity = validation.data.quantity ?? existingItem.quantity
    const unitPrice = validation.data.unitPrice ?? Number(existingItem.unitPrice)
    const total = quantity * unitPrice

    const item = await db.quoteItem.update({
      where: { id: itemId },
      data: {
        ...validation.data,
        total,
      },
    })

    // Recalculate quote totals
    const allItems = await db.quoteItem.findMany({
      where: { quoteId: id },
    })

    const subtotal = allItems.reduce((sum: number, item) => sum + Number(item.total), 0)
    const tax = Number(quote.tax)
    const newTotal = subtotal + tax

    await db.quote.update({
      where: { id },
      data: {
        subtotal,
        total: newTotal,
      },
    })

    return NextResponse.json({ success: true, data: item })
  } catch (error) {
    console.error('Error updating quote item:', error)
    return NextResponse.json(
      { error: 'Failed to update quote item' },
      { status: 500 }
    )
  }
}

// DELETE /api/crm/quotes/[id]/items/[itemId] - Delete item
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
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

    const { id, itemId } = await params

    const quote = await db.quote.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const existingItem = await db.quoteItem.findFirst({
      where: { id: itemId, quoteId: id },
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    await db.quoteItem.delete({
      where: { id: itemId },
    })

    // Recalculate quote totals
    const allItems = await db.quoteItem.findMany({
      where: { quoteId: id },
    })

    const subtotal = allItems.reduce((sum: number, item) => sum + Number(item.total), 0)
    const tax = Number(quote.tax)
    const newTotal = subtotal + tax

    await db.quote.update({
      where: { id },
      data: {
        subtotal,
        total: newTotal,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Item deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting quote item:', error)
    return NextResponse.json(
      { error: 'Failed to delete quote item' },
      { status: 500 }
    )
  }
}
