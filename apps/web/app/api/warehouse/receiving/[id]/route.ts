import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'
import { getReceivingRecord } from '@/lib/services/receiving'

const updateReceivingSchema = z.object({
  notes: z.string().optional(),
})

// GET /api/warehouse/receiving/[id] - Get single receiving record
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

    const receivingRecord = await getReceivingRecord(id, membership.tenantId)

    if (!receivingRecord) {
      return NextResponse.json({ error: 'Receiving record not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: receivingRecord })
  } catch (error) {
    console.error('Error fetching receiving record:', error)
    return NextResponse.json(
      { error: 'Failed to fetch receiving record' },
      { status: 500 }
    )
  }
}

// PATCH /api/warehouse/receiving/[id] - Update receiving record
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

    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Check if record exists and belongs to tenant
    const existing = await db.receivingRecord.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Receiving record not found' }, { status: 404 })
    }

    if (existing.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Cannot update completed receiving record' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validation = updateReceivingSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const updated = await db.receivingRecord.update({
      where: { id },
      data: validation.data,
      include: {
        asn: { select: { id: true, asnNumber: true, vendorName: true } },
        warehouse: { select: { id: true, name: true } },
        receivedBy: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            putAwayLocation: { select: { id: true, barcode: true, name: true } },
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error updating receiving record:', error)
    return NextResponse.json(
      { error: 'Failed to update receiving record' },
      { status: 500 }
    )
  }
}

// DELETE /api/warehouse/receiving/[id] - Delete receiving record (only if in progress)
export async function DELETE(
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

    const allowedRoles = ['admin', 'full_admin', 'warehouse']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Check if record exists and belongs to tenant
    const existing = await db.receivingRecord.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Receiving record not found' }, { status: 404 })
    }

    if (existing.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Cannot delete completed receiving record' },
        { status: 400 }
      )
    }

    // If linked to ASN, revert ASN status
    if (existing.asnId) {
      await db.aSN.update({
        where: { id: existing.asnId },
        data: { status: 'ARRIVED' },
      })
    }

    await db.receivingRecord.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: 'Receiving record deleted' })
  } catch (error) {
    console.error('Error deleting receiving record:', error)
    return NextResponse.json(
      { error: 'Failed to delete receiving record' },
      { status: 500 }
    )
  }
}
