import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import bcrypt from 'bcryptjs'

// POST /api/admin/users/[userId]/reset-password - Reset user password
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await params

    // TODO: Add role check to ensure only admins can access this
    // For now, we'll allow any authenticated user
    // In production, you should check if user has admin or owner role

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
