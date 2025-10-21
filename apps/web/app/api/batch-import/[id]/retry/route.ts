import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { queueBatchImport } from '@/lib/queue/batch-import-queue'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { rowId } = body

    if (!rowId) {
      return NextResponse.json({ error: 'Missing rowId' }, { status: 400 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      select: { tenantId: true },
    })

    if (!membership?.tenantId) {
      return NextResponse.json({ error: 'User has no tenant' }, { status: 400 })
    }

    // Verify batch belongs to user's tenant
    const batch = await db.batchImport.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Reset the row to PENDING status
    const row = await db.batchImportRow.findFirst({
      where: {
        id: rowId,
        batchImportId: id,
      },
    })

    if (!row) {
      return NextResponse.json({ error: 'Row not found' }, { status: 404 })
    }

    // Update row status
    await db.batchImportRow.update({
      where: { id: rowId },
      data: {
        status: 'PENDING',
        errorMessage: null,
        trackingNumber: null,
        labelUrl: null,
        shippingCost: null,
      },
    })

    // Update batch stats
    await db.batchImport.update({
      where: { id },
      data: {
        failedRows: { decrement: 1 },
        status: 'PROCESSING',
      },
    })

    // Re-queue the batch for processing
    await queueBatchImport(id, membership.tenantId)

    return NextResponse.json({
      success: true,
      message: 'Row queued for retry',
    })
  } catch (error: any) {
    console.error('[API] Batch retry error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to retry row' },
      { status: 500 }
    )
  }
}
