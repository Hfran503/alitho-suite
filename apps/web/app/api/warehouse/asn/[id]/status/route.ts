import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

// Define statuses once in zod schema - single source of truth
const asnStatusEnum = z.enum([
  'DRAFT',
  'PENDING',
  'IN_TRANSIT',
  'ARRIVED',
  'RECEIVING',
  'RECEIVED',
  'PARTIALLY_RECEIVED',
  'CANCELLED',
])
type ASNStatusType = z.infer<typeof asnStatusEnum>

const updateStatusSchema = z.object({
  status: asnStatusEnum,
})

// Valid status transitions
const VALID_TRANSITIONS: Record<ASNStatusType, ASNStatusType[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['IN_TRANSIT', 'ARRIVED', 'CANCELLED'],
  IN_TRANSIT: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['RECEIVING', 'CANCELLED'],
  RECEIVING: ['RECEIVED', 'PARTIALLY_RECEIVED'],
  RECEIVED: [], // Terminal state
  PARTIALLY_RECEIVED: ['RECEIVING'], // Can continue receiving
  CANCELLED: [], // Terminal state
}

// PATCH /api/warehouse/asn/[id]/status - Update ASN status
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

    const existing = await db.aSN.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'ASN not found' }, { status: 404 })
    }

    const body = await request.json()
    const { status: newStatus } = updateStatusSchema.parse(body)

    // Validate status transition
    const currentStatus = existing.status as ASNStatusType
    const validNextStatuses = VALID_TRANSITIONS[currentStatus] || []

    if (!validNextStatuses.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
          validTransitions: validNextStatuses,
        },
        { status: 400 }
      )
    }

    // Build update data based on new status
    const updateData: {
      status: ASNStatusType
      arrivedAt?: Date
      receivedAt?: Date
    } = { status: newStatus }

    if (newStatus === 'ARRIVED' && !existing.arrivedAt) {
      updateData.arrivedAt = new Date()
    }

    if (newStatus === 'RECEIVED' && !existing.receivedAt) {
      updateData.receivedAt = new Date()
    }

    const asn = await db.aSN.update({
      where: { id },
      data: updateData,
      include: {
        warehouse: { select: { id: true, name: true } },
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
    console.error('Error updating ASN status:', error)
    return NextResponse.json(
      { error: 'Failed to update ASN status' },
      { status: 500 }
    )
  }
}
