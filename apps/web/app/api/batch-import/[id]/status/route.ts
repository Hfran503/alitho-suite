import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getBatchJobStatus } from '@/lib/queue/batch-import-queue'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      select: { tenantId: true },
    })

    if (!membership?.tenantId) {
      return NextResponse.json({ error: 'User has no tenant' }, { status: 400 })
    }

    // Fetch batch with rows
    const batch = await db.batchImport.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
      include: {
        rows: {
          orderBy: { rowNumber: 'asc' },
        },
      },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Get job status from BullMQ queue (for progress)
    let queueStatus
    try {
      queueStatus = await getBatchJobStatus(id)
    } catch (err) {
      // If job not in queue, calculate from database
      queueStatus = null
    }

    // Calculate progress
    const processedRows = batch.successfulRows + batch.failedRows
    const progress = batch.totalRows > 0
      ? Math.round((processedRows / batch.totalRows) * 100)
      : 0

    // Format response
    const response = {
      id: batch.id,
      status: batch.status,
      totalRows: batch.totalRows,
      successfulRows: batch.successfulRows,
      failedRows: batch.failedRows,
      progress: queueStatus?.progress ?? progress,
      rows: batch.rows.map((row: any) => ({
        id: row.id,
        rowNumber: row.rowNumber,
        jobNumber: row.jobNumber,
        shipToName: row.shipToName || row.shipToCompany || '',
        shipToCity: row.shipToCity || '',
        shipToState: row.shipToState || '',
        packageNumber: row.packageNumber,
        totalPackages: row.totalPackages,
        status: row.status,
        trackingNumber: row.trackingNumber,
        labelUrl: row.labelUrl,
        errorMessage: row.errorMessage,
        jobShipmentId: row.paceJobShipmentId,
        cartonId: row.paceCartonId,
      })),
    }

    return NextResponse.json({ success: true, data: response })
  } catch (error: any) {
    console.error('[API] Batch status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch batch status' },
      { status: 500 }
    )
  }
}
