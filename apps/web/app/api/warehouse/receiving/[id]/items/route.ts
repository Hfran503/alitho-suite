import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'
import { recordItem } from '@/lib/services/receiving'

const addItemSchema = z.object({
  itemId: z.string().optional(),
  sku: z.string().min(1, 'SKU is required'),
  description: z.string().min(1, 'Description is required'),
  expectedQty: z.number().int().min(0).default(0),
  receivedQty: z.number().int().min(0),
  damagedQty: z.number().int().min(0).default(0),
  putAwayLocationId: z.string().optional(),
  lotNumber: z.string().optional(),
  expirationDate: z.string().optional(),
  notes: z.string().optional(),
})

// GET /api/warehouse/receiving/[id]/items - List items in receiving record
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

    // Verify receiving record exists and belongs to tenant
    const receivingRecord = await db.receivingRecord.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!receivingRecord) {
      return NextResponse.json({ error: 'Receiving record not found' }, { status: 404 })
    }

    const items = await db.receivingItem.findMany({
      where: { receivingRecordId: id },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        putAwayLocation: { select: { id: true, barcode: true, name: true } },
      },
      orderBy: { sku: 'asc' },
    })

    return NextResponse.json({ success: true, data: items })
  } catch (error) {
    console.error('Error fetching receiving items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch receiving items' },
      { status: 500 }
    )
  }
}

// POST /api/warehouse/receiving/[id]/items - Add item to receiving record
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

    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Verify receiving record exists and is in progress
    const receivingRecord = await db.receivingRecord.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!receivingRecord) {
      return NextResponse.json({ error: 'Receiving record not found' }, { status: 404 })
    }

    if (receivingRecord.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Cannot add items to completed receiving record' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validation = addItemSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    const item = await recordItem({
      receivingRecordId: id,
      itemId: data.itemId,
      sku: data.sku,
      description: data.description,
      expectedQty: data.expectedQty,
      receivedQty: data.receivedQty,
      damagedQty: data.damagedQty,
      putAwayLocationId: data.putAwayLocationId,
      lotNumber: data.lotNumber,
      expirationDate: data.expirationDate ? new Date(data.expirationDate) : undefined,
      notes: data.notes,
    })

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (error) {
    console.error('Error adding receiving item:', error)
    const message = error instanceof Error ? error.message : 'Failed to add item'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
