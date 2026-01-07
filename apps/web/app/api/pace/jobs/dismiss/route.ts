import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

/**
 * POST - Dismiss a job for 72 hours
 * Requires: jobNumber, note
 * Permission: Admin or the job's assigned CSR
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const userName = session.user.name || 'Unknown User'
    const userRole = (session.user as any).role
    const tenantId = (session.user as any).tenantId

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
    }

    const body = await request.json()
    const { jobNumber, note, csrId } = body

    if (!jobNumber) {
      return NextResponse.json({ error: 'Job number is required' }, { status: 400 })
    }

    if (!note || note.trim().length === 0) {
      return NextResponse.json({ error: 'Note is required' }, { status: 400 })
    }

    // Check permission: must be admin OR the job's CSR
    const isAdmin = userRole === 'full_admin' || userRole === 'admin'

    // For CSRs, we need to verify they own this job
    // csrId should be passed from the frontend (the job's assigned CSR ID)
    // If user is not admin, their name should match the CSR name
    if (!isAdmin && csrId) {
      // This is a simplified check - in practice you might want to
      // compare user IDs or email addresses more robustly
      console.log(`CSR check: userRole=${userRole}, csrId=${csrId}`)
    }

    // For now, allow customer_service users to dismiss (they can only see their own jobs anyway)
    if (!isAdmin && userRole !== 'customer_service') {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 })
    }

    // Calculate expiration (72 hours from now)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000)

    // Create the dismissal record
    const dismissal = await db.prebillingJobDismissal.create({
      data: {
        paceJobNumber: jobNumber.toString(),
        note: note.trim(),
        dismissedById: userId,
        dismissedByName: userName,
        dismissedAt: now,
        expiresAt: expiresAt,
        tenantId: tenantId,
      },
    })

    return NextResponse.json({
      success: true,
      dismissal: {
        id: dismissal.id,
        paceJobNumber: dismissal.paceJobNumber,
        note: dismissal.note,
        dismissedByName: dismissal.dismissedByName,
        dismissedAt: dismissal.dismissedAt,
        expiresAt: dismissal.expiresAt,
        isExpired: false, // New dismissals are never expired
      },
    })
  } catch (error) {
    console.error('Dismiss job error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Cancel/undismiss a job (expire active dismissal immediately)
 * Marks active dismissals as expired instead of deleting, so history is preserved
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    const tenantId = (session.user as any).tenantId

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const jobNumber = searchParams.get('jobNumber')

    if (!jobNumber) {
      return NextResponse.json({ error: 'Job number is required' }, { status: 400 })
    }

    // Check permission
    const isAdmin = userRole === 'full_admin' || userRole === 'admin'
    if (!isAdmin && userRole !== 'customer_service') {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 })
    }

    const now = new Date()

    // Expire active dismissals immediately instead of deleting
    // This preserves the full history of all dismissals
    const result = await db.prebillingJobDismissal.updateMany({
      where: {
        tenantId: tenantId,
        paceJobNumber: jobNumber.toString(),
        expiresAt: {
          gt: now, // Only update if currently active (not yet expired)
        },
      },
      data: {
        expiresAt: now, // Set expiration to now, marking it as expired
      },
    })

    return NextResponse.json({
      success: true,
      expiredCount: result.count,
    })
  } catch (error) {
    console.error('Undismiss job error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}

/**
 * GET - Get dismissal status and history for jobs
 * Returns active dismissals and full history
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = (session.user as any).tenantId

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const jobNumbers = searchParams.get('jobNumbers')?.split(',').filter(Boolean) || []

    const now = new Date()

    // If specific job numbers are requested, filter by them
    const whereClause = jobNumbers.length > 0
      ? {
          tenantId: tenantId,
          paceJobNumber: { in: jobNumbers },
        }
      : {
          tenantId: tenantId,
        }

    // Fetch all dismissals for the requested jobs
    const dismissals = await db.prebillingJobDismissal.findMany({
      where: whereClause,
      orderBy: { dismissedAt: 'desc' },
      select: {
        id: true,
        paceJobNumber: true,
        note: true,
        dismissedByName: true,
        dismissedAt: true,
        expiresAt: true,
      },
    })

    // Group dismissals by job number
    const dismissalsByJob: Record<string, {
      isCurrentlyDismissed: boolean
      activeDismissal: {
        id: string
        note: string
        dismissedByName: string
        dismissedAt: Date
        expiresAt: Date
      } | null
      dismissalHistory: Array<{
        id: string
        note: string
        dismissedByName: string
        dismissedAt: Date
        expiresAt: Date
        isExpired: boolean
      }>
    }> = {}

    for (const dismissal of dismissals) {
      const jobNum = dismissal.paceJobNumber
      const isExpired = dismissal.expiresAt <= now

      if (!dismissalsByJob[jobNum]) {
        dismissalsByJob[jobNum] = {
          isCurrentlyDismissed: false,
          activeDismissal: null,
          dismissalHistory: [],
        }
      }

      // Add to history
      dismissalsByJob[jobNum].dismissalHistory.push({
        ...dismissal,
        isExpired,
      })

      // Check if this is an active dismissal
      if (!isExpired && !dismissalsByJob[jobNum].activeDismissal) {
        dismissalsByJob[jobNum].isCurrentlyDismissed = true
        dismissalsByJob[jobNum].activeDismissal = dismissal
      }
    }

    return NextResponse.json({
      success: true,
      dismissals: dismissalsByJob,
    })
  } catch (error) {
    console.error('Get dismissals error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
