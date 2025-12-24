import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'
import { completeReceiving } from '@/lib/services/receiving'

const completeReceivingSchema = z.object({
  discrepancyNotes: z.string().optional(),
})

// POST /api/warehouse/receiving/[id]/complete - Complete receiving and update inventory
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

    // Verify receiving record exists and belongs to tenant
    const receivingRecord = await db.receivingRecord.findFirst({
      where: { id, tenantId: membership.tenantId },
      include: { items: true },
    })

    if (!receivingRecord) {
      return NextResponse.json({ error: 'Receiving record not found' }, { status: 404 })
    }

    if (receivingRecord.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: `Cannot complete receiving in status: ${receivingRecord.status}` },
        { status: 400 }
      )
    }

    // Check that all items have put-away locations
    const itemsWithoutLocation = receivingRecord.items.filter(
      (item: (typeof receivingRecord.items)[number]) => item.receivedQty > 0 && !item.putAwayLocationId
    )

    if (itemsWithoutLocation.length > 0) {
      return NextResponse.json(
        {
          error: 'All received items must have a put-away location',
          itemsWithoutLocation: itemsWithoutLocation.map((i: (typeof itemsWithoutLocation)[number]) => i.sku),
        },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const validation = completeReceivingSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const result = await completeReceiving({
      receivingRecordId: id,
      tenantId: membership.tenantId,
      userId: session.user.id,
      discrepancyNotes: validation.data.discrepancyNotes,
    })

    return NextResponse.json({
      success: true,
      data: result.receivingRecord,
      summary: result.summary,
    })
  } catch (error) {
    console.error('Error completing receiving:', error)
    const message = error instanceof Error ? error.message : 'Failed to complete receiving'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
