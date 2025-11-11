import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/authorization'
import { db as prisma } from '@repo/database'

// PATCH - Update single portal page configuration (Admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pageKey: string }> }
) {
  const { pageKey } = await params
  try {
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.error
    }

    const session = authResult.session

    // Get user's tenant
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: {
        memberships: true,
      },
    })

    if (!user || !user.memberships[0]) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const tenantId = user.memberships[0].tenantId
    const body = await req.json()

    // Update portal page configuration
    const pageConfig = await prisma.portalPageConfiguration.update({
      where: {
        tenantId_pageKey: {
          tenantId,
          pageKey,
        },
      },
      data: {
        label: body.label,
        href: body.href,
        icon: body.icon,
        order: body.order,
        isActive: body.isActive,
        description: body.description,
        visibilityMode: body.visibilityMode,
        allowedPaceCustomerIds: body.allowedPaceCustomerIds,
        allowedUserIds: body.allowedUserIds,
        allowedUserEmails: body.allowedUserEmails,
      },
    })

    return NextResponse.json({ pageConfig })
  } catch (error) {
    console.error('Error updating portal page configuration:', error)
    return NextResponse.json(
      { error: 'Failed to update portal page configuration' },
      { status: 500 }
    )
  }
}

// DELETE - Delete portal page configuration (Admin only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ pageKey: string }> }
) {
  const { pageKey } = await params
  try {
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.error
    }

    const session = authResult.session

    // Get user's tenant
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: {
        memberships: true,
      },
    })

    if (!user || !user.memberships[0]) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const tenantId = user.memberships[0].tenantId

    // Delete portal page configuration
    await prisma.portalPageConfiguration.delete({
      where: {
        tenantId_pageKey: {
          tenantId,
          pageKey,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting portal page configuration:', error)
    return NextResponse.json(
      { error: 'Failed to delete portal page configuration' },
      { status: 500 }
    )
  }
}
