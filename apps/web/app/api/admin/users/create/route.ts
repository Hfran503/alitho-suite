import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import bcrypt from 'bcryptjs'

// POST /api/admin/users/create - Create a new user
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: Add role check to ensure only admins can access this
    // For now, we'll allow any authenticated user

    const body = await request.json()
    const { name, email, password, role, sendInvite, isTemporaryPassword } = body

    // Validation
    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      )
    }

    if (!sendInvite && (!password || password.length < 8)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters if not sending invite' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      )
    }

    // Hash password if provided
    let hashedPassword: string | undefined
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10)
    }

    // Get the first tenant (or create logic for tenant selection)
    // TODO: Update this to use the current user's tenant or allow admin to select tenant
    const tenant = await db.tenant.findFirst({
      orderBy: { createdAt: 'asc' },
    })

    if (!tenant) {
      return NextResponse.json(
        { error: 'No tenant found. Please create a tenant first.' },
        { status: 400 }
      )
    }

    // Create user with membership
    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        passwordResetRequired: isTemporaryPassword || false, // Force password change if temporary
        memberships: {
          create: {
            role: role || 'customer_service',
            tenantId: tenant.id,
          },
        },
      },
      include: {
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
      },
    })

    // TODO: If sendInvite is true, send invitation email with password setup link
    if (sendInvite) {
      // Implement email sending logic here
      // Generate a token for password setup
      // Send email with setup link
      console.log(`TODO: Send invitation email to ${email}`)
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'user.created',
        entityType: 'user',
        entityId: user.id,
        userId: session.user.id,
        actorName: session.user.name || undefined,
        actorEmail: session.user.email || undefined,
        tenantId: tenant.id,
        metadata: {
          userName: user.name,
          userEmail: user.email,
          role,
          inviteSent: sendInvite,
          temporaryPassword: isTemporaryPassword,
        },
      },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
