import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { queueBatchImport } from '@/lib/queue/batch-import-queue'

/**
 * POST /api/batch-import/[id]/retry-failed
 * Reset failed rows back to PENDING for retry
 * Optionally retry only transient errors or all failed rows
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      select: { tenantId: true },
    })

    if (!membership?.tenantId) {
      return NextResponse.json({ error: 'User has no tenant' }, { status: 400 })
    }

    const { id: batchId } = await params
    const body = await request.json().catch(() => ({}))
    const { onlyTransient = true, rowIds = [] } = body

    console.log(`[retry-failed] Retrying batch ${batchId}`, {
      onlyTransient,
      specificRows: rowIds.length > 0,
    })

    // Verify batch belongs to tenant
    const batch = await db.batchImport.findUnique({
      where: {
        id: batchId,
        tenantId: membership.tenantId,
      },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Build where clause for rows to retry
    const whereClause: any = {
      batchImportId: batchId,
      status: 'FAILED',
    }

    // If specific row IDs provided, only retry those
    if (rowIds.length > 0) {
      whereClause.id = { in: rowIds }
    }

    // If onlyTransient, only retry transient errors
    if (onlyTransient) {
      whereClause.isTransientError = true
    }

    // Also check retry count hasn't exceeded max
    whereClause.retryCount = { lt: 3 } // Max 3 retries

    // Count rows that will be retried
    const rowsToRetry = await db.batchImportRow.count({
      where: whereClause,
    })

    if (rowsToRetry === 0) {
      return NextResponse.json({
        error: 'No retryable rows found',
        message:
          onlyTransient
            ? 'No failed rows with transient errors found (or max retries exceeded)'
            : 'No failed rows found (or max retries exceeded)',
      }, { status: 400 })
    }

    console.log(`[retry-failed] Resetting ${rowsToRetry} rows to PENDING`)

    // Reset rows back to PENDING
    await db.batchImportRow.updateMany({
      where: whereClause,
      data: {
        status: 'PENDING',
        errorMessage: null,
        // Don't reset retryCount - we keep it for exponential backoff
        // Don't reset isTransientError - we keep it for tracking
      },
    })

    // Re-queue the batch for processing
    console.log(`[retry-failed] Re-queueing batch ${batchId}`)
    await queueBatchImport(batchId, membership.tenantId)

    return NextResponse.json({
      success: true,
      retriedRows: rowsToRetry,
      message: `Successfully reset ${rowsToRetry} failed rows for retry`,
    })
  } catch (error: any) {
    console.error('[retry-failed] Error:', error)
    return NextResponse.json(
      { error: 'Failed to retry batch', details: error.message },
      { status: 500 }
    )
  }
}
