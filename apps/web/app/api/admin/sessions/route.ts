import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/admin/sessions - Get all active sessions
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: Add role check to ensure only admins can access this
    // For now, we'll allow any authenticated user

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
    const currentSessionToken = sessions.find(s => s.userId === currentUserId)?.sessionToken

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
