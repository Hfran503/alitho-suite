import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'
import { updateReceivingItem, deleteReceivingItem } from '@/lib/services/receiving'

const updateItemSchema = z.object({
  receivedQty: z.number().int().min(0).optional(),
  damagedQty: z.number().int().min(0).optional(),
  putAwayLocationId: z.string().nullable().optional(),
  notes: z.string().optional(),
})

// PATCH /api/warehouse/receiving/[id]/items/[itemId] - Update receiving item
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

    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id, itemId } = await params

    // Verify receiving record exists, is in progress, and belongs to tenant
    const receivingRecord = await db.receivingRecord.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!receivingRecord) {
      return NextResponse.json({ error: 'Receiving record not found' }, { status: 404 })
    }

    if (receivingRecord.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Cannot update items in completed receiving record' },
        { status: 400 }
      )
    }

    // Verify item belongs to this receiving record
    const existingItem = await db.receivingItem.findFirst({
      where: { id: itemId, receivingRecordId: id },
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

    const updated = await updateReceivingItem(itemId, validation.data)

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error updating receiving item:', error)
    return NextResponse.json(
      { error: 'Failed to update receiving item' },
      { status: 500 }
    )
  }
}

// DELETE /api/warehouse/receiving/[id]/items/[itemId] - Delete receiving item
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

    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id, itemId } = await params

    // Verify receiving record exists, is in progress, and belongs to tenant
    const receivingRecord = await db.receivingRecord.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!receivingRecord) {
      return NextResponse.json({ error: 'Receiving record not found' }, { status: 404 })
    }

    if (receivingRecord.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Cannot delete items from completed receiving record' },
        { status: 400 }
      )
    }

    // Verify item belongs to this receiving record
    const existingItem = await db.receivingItem.findFirst({
      where: { id: itemId, receivingRecordId: id },
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Don't allow deleting items pre-populated from ASN
    if (receivingRecord.asnId && existingItem.expectedQty > 0) {
      return NextResponse.json(
        { error: 'Cannot delete expected items from ASN-linked receiving' },
        { status: 400 }
      )
    }

    await deleteReceivingItem(itemId)

    return NextResponse.json({ success: true, message: 'Item deleted' })
  } catch (error) {
    console.error('Error deleting receiving item:', error)
    return NextResponse.json(
      { error: 'Failed to delete receiving item' },
      { status: 500 }
    )
  }
}
