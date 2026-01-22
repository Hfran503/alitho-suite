import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db as prisma } from '@repo/database'

// GET - Fetch CRM settings for tenant
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user and membership
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        memberships: {
          include: { tenant: true }
        }
      }
    })

    if (!user || !user.memberships[0]) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const tenantId = user.memberships[0].tenantId

    // Get CRM settings for tenant
    const crmSettings = await prisma.crmSettings.findUnique({
      where: { tenantId }
    })

    return NextResponse.json(
      { crmSettings },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching CRM settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch CRM settings' },
      { status: 500 }
    )
  }
}

// PUT - Update or create CRM settings
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user and membership
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        memberships: {
          include: { tenant: true }
        }
      }
    })

    if (!user || !user.memberships[0]) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const membership = user.memberships[0]
    const tenantId = membership.tenantId

    // Only full_admin and admin can modify settings
    if (membership.role !== 'full_admin' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { quoteRequestNotificationEmail, enableCustomerEmail, enableInternalEmail } = body

    // Validate email format if provided (supports multiple comma-separated emails)
    if (quoteRequestNotificationEmail && quoteRequestNotificationEmail.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const emails = quoteRequestNotificationEmail.split(',').map((e: string) => e.trim()).filter(Boolean)

      for (const email of emails) {
        if (!emailRegex.test(email)) {
          return NextResponse.json(
            { error: `Invalid email format: ${email}` },
            { status: 400 }
          )
        }
      }
    }

    // Upsert CRM settings (create if doesn't exist, update if exists)
    const crmSettings = await prisma.crmSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        quoteRequestNotificationEmail: quoteRequestNotificationEmail?.trim() || null,
        enableCustomerEmail: enableCustomerEmail ?? true,
        enableInternalEmail: enableInternalEmail ?? true,
      },
      update: {
        quoteRequestNotificationEmail: quoteRequestNotificationEmail?.trim() || null,
        enableCustomerEmail: enableCustomerEmail ?? true,
        enableInternalEmail: enableInternalEmail ?? true,
      }
    })

    return NextResponse.json({ crmSettings })
  } catch (error) {
    console.error('Error updating CRM settings:', error)
    return NextResponse.json(
      { error: 'Failed to update CRM settings' },
      { status: 500 }
    )
  }
}
