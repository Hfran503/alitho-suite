import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/auth/validate-session - Check if current user's session is still valid
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ valid: false, reason: 'No session' }, { status: 401 })
    }

    // Check if user has any active session in database
    const dbSession = await db.session.findFirst({
      where: {
        userId: session.user.id,
        expires: {
          gt: new Date(), // Not expired
        },
      },
    })

    if (!dbSession) {
      // Session was deleted by admin - user should be signed out
      return NextResponse.json({
        valid: false,
        reason: 'Session revoked by administrator'
      }, { status: 401 })
    }

    // Session is valid
    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error('Error validating session:', error)
    return NextResponse.json({ valid: false, reason: 'Error' }, { status: 500 })
  }
}
