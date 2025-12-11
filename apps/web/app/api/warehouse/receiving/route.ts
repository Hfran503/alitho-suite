import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, ReceivingStatus } from '@repo/database'
import { z } from 'zod'
import { startReceiving, listReceivingRecords } from '@/lib/services/receiving'

const createReceivingSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse is required'),
  asnId: z.string().optional(),
  notes: z.string().optional(),
})

// GET /api/warehouse/receiving - List receiving records
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

    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get('warehouseId') || undefined
    const status = searchParams.get('status') as ReceivingStatus | null
    const hasAsn = searchParams.get('hasAsn')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const result = await listReceivingRecords(membership.tenantId, {
      warehouseId,
      status: status || undefined,
      hasAsn: hasAsn === 'true' ? true : hasAsn === 'false' ? false : undefined,
      limit,
      offset,
    })

    return NextResponse.json({
      success: true,
      data: result.records,
      pagination: {
        total: result.total,
        limit,
        offset,
      },
    })
  } catch (error) {
    console.error('Error listing receiving records:', error)
    return NextResponse.json(
      { error: 'Failed to list receiving records' },
      { status: 500 }
    )
  }
}

// POST /api/warehouse/receiving - Start new receiving session
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

    // Check role permissions
    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validation = createReceivingSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { warehouseId, asnId, notes } = validation.data

    const receivingRecord = await startReceiving({
      tenantId: membership.tenantId,
      warehouseId,
      userId: session.user.id,
      asnId,
      notes,
    })

    return NextResponse.json({ success: true, data: receivingRecord }, { status: 201 })
  } catch (error) {
    console.error('Error creating receiving record:', error)
    const message = error instanceof Error ? error.message : 'Failed to start receiving'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
