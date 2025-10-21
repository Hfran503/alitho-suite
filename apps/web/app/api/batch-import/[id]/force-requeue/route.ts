import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { batchImportQueue } from '@/lib/queue/batch-import-queue'

export async function POST(
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

    console.log(`[FORCE-REQUEUE] Attempting to force requeue batch ${id}`)

    // Try to get and remove the old stuck job
    const oldJobId = `batch-${id}`
    try {
      const oldJob = await batchImportQueue.getJob(oldJobId)
      if (oldJob) {
        console.log(`[FORCE-REQUEUE] Found old job ${oldJobId}, removing it`)
        await oldJob.remove()
        console.log(`[FORCE-REQUEUE] Old job removed successfully`)
      } else {
        console.log(`[FORCE-REQUEUE] No old job found with ID ${oldJobId}`)
      }
    } catch (err: any) {
      console.log(`[FORCE-REQUEUE] Could not remove old job: ${err.message}`)
    }

    // Wait a bit for Redis to clear
    await new Promise(resolve => setTimeout(resolve, 500))

    // Now add a new job with a unique ID (using timestamp to ensure uniqueness)
    const uniqueJobId = `batch-${id}-${Date.now()}`
    console.log(`[FORCE-REQUEUE] Adding new job with ID ${uniqueJobId}`)

    await batchImportQueue.add(
      'process-batch',
      {
        batchId: id,
        tenantId: membership.tenantId,
      },
      {
        jobId: uniqueJobId,
      }
    )

    console.log(`[FORCE-REQUEUE] Successfully queued new job`)

    return NextResponse.json({
      success: true,
      message: 'Batch force-requeued successfully',
      jobId: uniqueJobId,
    })
  } catch (error: any) {
    console.error('[FORCE-REQUEUE] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to force requeue batch' },
      { status: 500 }
    )
  }
}
