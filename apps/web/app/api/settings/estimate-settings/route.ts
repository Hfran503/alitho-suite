import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db as prisma } from '@repo/database'

// GET - Fetch estimate settings for tenant
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

    // Get estimate settings for tenant
    const estimateSettings = await prisma.estimateSettings.findUnique({
      where: { tenantId }
    })

    return NextResponse.json(
      { estimateSettings },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching estimate settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch estimate settings' },
      { status: 500 }
    )
  }
}

// PUT - Update or create estimate settings
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
    const { allowedJobProductTypes } = body

    // Validate required fields
    if (!Array.isArray(allowedJobProductTypes)) {
      return NextResponse.json(
        { error: 'allowedJobProductTypes must be an array' },
        { status: 400 }
      )
    }

    // Extract IDs for backward compatibility
    const allowedJobProductTypeIds = allowedJobProductTypes.map((jpt: any) => jpt.jobProductTypeId)

    // Upsert estimate settings (create if doesn't exist, update if exists)
    const estimateSettings = await prisma.estimateSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        allowedJobProductTypeIds,
        allowedJobProductTypes: allowedJobProductTypes as any
      },
      update: {
        allowedJobProductTypeIds,
        allowedJobProductTypes: allowedJobProductTypes as any
      }
    })

    return NextResponse.json({ estimateSettings })
  } catch (error) {
    console.error('Error updating estimate settings:', error)
    return NextResponse.json(
      { error: 'Failed to update estimate settings' },
      { status: 500 }
    )
  }
}
