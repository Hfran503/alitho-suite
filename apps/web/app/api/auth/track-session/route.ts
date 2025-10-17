import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// POST /api/auth/track-session - Update or create session record for current user
export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30) // 30 days from now

    // Check if session exists for this user
    const existingSession = await db.session.findFirst({
      where: {
        userId: session.user.id,
        expires: {
          gt: new Date(), // Not expired
        },
      },
    })

    if (existingSession) {
      // Update existing session
      await db.session.update({
        where: { id: existingSession.id },
        data: { expires: expiresAt },
      })
    } else {
      // Create new session record
      await db.session.create({
        data: {
          userId: session.user.id,
          expires: expiresAt,
          sessionToken: `jwt-${session.user.id}-${Date.now()}`,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error tracking session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
