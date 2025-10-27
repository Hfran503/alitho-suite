import { NextResponse } from 'next/server'
import { db } from '@repo/database'
import { requireAdmin } from '@/lib/authorization'
import bcrypt from 'bcryptjs'

// GET handler for build compatibility
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

// POST /api/admin/users/[userId]/reset-password - Reset user password
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.error
    }

    const session = authResult.session
    const { userId } = await params

    // Prevent user from resetting their own password via admin endpoint
    if (session.user.id === userId) {
      return NextResponse.json(
        { error: 'Cannot reset your own password. Use the change password feature instead.' },
        { status: 400 }
      )
    }
    const body = await request.json()
    const { newPassword } = body

    // Validate password
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update user password
    await db.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    // TODO: Send email notification to user about password reset
    // TODO: Optionally invalidate all existing sessions for this user

    return NextResponse.json({ message: 'Password reset successfully' })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
