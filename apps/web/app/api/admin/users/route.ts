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
            updatedAt: 'desc',
          },
          take: 1,
          select: {
            updatedAt: true,
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

      // Use the session's updatedAt timestamp as last activity
      // Sessions are updated whenever the track-session endpoint is called (on each page visit)
      if (user.sessions[0]?.updatedAt) {
        lastActivity = user.sessions[0].updatedAt.toISOString()
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        paceCustomerId: user.paceCustomerId,
        createdAt: user.createdAt,
        memberships: user.memberships,
        lastActivity,
      }
    })

    return NextResponse.json({ users: usersWithActivity })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
