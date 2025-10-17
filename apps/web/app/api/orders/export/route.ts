import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { enqueueExport } from '@/lib/queue'

export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const { type = 'csv', filters = {} } = body

    // Enqueue export job
    const job = await enqueueExport({
      tenantId: membership.tenantId,
      userId: session.user.id,
      type,
      entityType: 'orders',
      filters,
    })

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        message: 'Export job queued. You will be notified when ready.',
      },
    })
  } catch (error) {
    console.error('Export orders error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
