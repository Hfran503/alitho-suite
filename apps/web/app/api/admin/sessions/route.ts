import { NextResponse } from 'next/server'
import { db } from '@repo/database'
import { requireAdmin } from '@/lib/authorization'

// GET /api/admin/sessions - Get all active sessions
export async function GET() {
  try {
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.error
    }

    const session = authResult.session
    const currentUserId = session.user.id

    // Get all active sessions (not expired)
    const sessions = await db.session.findMany({
      where: {
        expires: {
          gt: new Date(), // Only active sessions
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: {
        expires: 'desc',
      },
    })

    // Find the current user's most recent session (there should only be one now)
    const currentSessionToken = sessions.find((s: any) => s.userId === currentUserId)?.sessionToken

    return NextResponse.json({
      sessions,
      currentUserId,
      currentSessionToken,
    })
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
