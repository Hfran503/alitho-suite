import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db as prisma } from '@repo/database'

// DELETE - Delete a menu configuration
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ menuKey: string }> }
) {
  const { menuKey } = await params
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

    // Only full_admin and admin can modify menu
    if (membership.role !== 'full_admin' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.menuConfiguration.delete({
      where: {
        tenantId_menuKey: {
          tenantId,
          menuKey
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting menu configuration:', error)
    return NextResponse.json(
      { error: 'Failed to delete menu configuration' },
      { status: 500 }
    )
  }
}

// PATCH - Update a single menu configuration
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ menuKey: string }> }
) {
  const { menuKey } = await params
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

    // Only full_admin and admin can modify menu
    if (membership.role !== 'full_admin' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()

    const menuConfig = await prisma.menuConfiguration.update({
      where: {
        tenantId_menuKey: {
          tenantId,
          menuKey
        }
      },
      data: {
        ...body
      }
    })

    return NextResponse.json({ menuConfig })
  } catch (error) {
    console.error('Error updating menu configuration:', error)
    return NextResponse.json(
      { error: 'Failed to update menu configuration' },
      { status: 500 }
    )
  }
}
