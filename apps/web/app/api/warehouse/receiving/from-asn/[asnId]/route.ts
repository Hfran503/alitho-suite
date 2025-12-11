import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'
import { startReceiving } from '@/lib/services/receiving'

const fromAsnSchema = z.object({
  notes: z.string().optional(),
})

// POST /api/warehouse/receiving/from-asn/[asnId] - Start receiving from an ASN
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ asnId: string }> }
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

    const { asnId } = await params

    // Verify ASN exists and belongs to tenant
    const asn = await db.aSN.findFirst({
      where: { id: asnId, tenantId: membership.tenantId },
      include: {
        receivingRecord: true,
        warehouse: { select: { id: true, name: true } },
      },
    })

    if (!asn) {
      return NextResponse.json({ error: 'ASN not found' }, { status: 404 })
    }

    // Check if already has a receiving record
    if (asn.receivingRecord) {
      return NextResponse.json(
        {
          error: 'ASN already has a receiving session',
          receivingRecordId: asn.receivingRecord.id,
        },
        { status: 400 }
      )
    }

    // Check ASN status
    if (!['ARRIVED', 'RECEIVING', 'PARTIALLY_RECEIVED'].includes(asn.status)) {
      return NextResponse.json(
        { error: `Cannot start receiving for ASN in status: ${asn.status}` },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const validation = fromAsnSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const receivingRecord = await startReceiving({
      tenantId: membership.tenantId,
      warehouseId: asn.warehouseId,
      userId: session.user.id,
      asnId,
      notes: validation.data.notes,
    })

    return NextResponse.json({ success: true, data: receivingRecord }, { status: 201 })
  } catch (error) {
    console.error('Error starting receiving from ASN:', error)
    const message = error instanceof Error ? error.message : 'Failed to start receiving'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
