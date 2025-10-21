import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredSessions } from '@/lib/session'

/**
 * Cron job endpoint to clean up expired sessions
 * Can be called by a cron service (e.g., Vercel Cron, GitHub Actions, or external cron)
 *
 * For security, you should:
 * 1. Use Vercel Cron (free) - add to vercel.json
 * 2. Or use an API key/secret to protect this endpoint
 * 3. Or call it from a server-side scheduled job
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Add authorization check
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const count = await cleanupExpiredSessions()

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${count} expired sessions`,
      count,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error cleaning up sessions:', error)
    return NextResponse.json(
      {
        error: 'Failed to clean up sessions',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
