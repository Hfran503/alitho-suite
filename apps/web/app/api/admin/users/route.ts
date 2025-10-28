import { NextResponse } from 'next/server'
import { db } from '@repo/database'
import { requireAdmin } from '@/lib/authorization'

// GET /api/admin/users - Get all users
export async function GET() {
  try {
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.error
    }

    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        paceCustomerId: true,
        createdAt: true,
        memberships: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        sessions: {
          where: {
            expires: {
              gt: new Date(),
            },
          },
          orderBy: {
            expires: 'desc',
          },
          take: 1,
          select: {
            expires: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Transform users to include lastActivity from sessions
    const usersWithActivity = users.map(user => {
      let lastActivity = null

      // If user has an active session, use current time as last activity
      // Since sessions are only updated when user is active, if they have an active session
      // it means they were recently active (session gets updated on each page visit)
      if (user.sessions[0]?.expires) {
        // The session was just updated when they visited, so their last activity is approximately now
        // More precisely: expires - 30 days = when the session was last updated (last activity)
        const sessionExpires = new Date(user.sessions[0].expires)
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000
        lastActivity = new Date(sessionExpires.getTime() - thirtyDaysInMs)
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        paceCustomerId: user.paceCustomerId,
        createdAt: user.createdAt,
        memberships: user.memberships,
        lastActivity: lastActivity ? lastActivity.toISOString() : null,
      }
    })

    return NextResponse.json({ users: usersWithActivity })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
