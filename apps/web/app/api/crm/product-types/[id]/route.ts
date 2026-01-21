import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's membership
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const productType = await db.productType.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!productType) {
      return NextResponse.json({ error: 'Product type not found' }, { status: 404 })
    }

    return NextResponse.json({ data: productType })
  } catch (error) {
    console.error('Error fetching product type:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product type' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's membership
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const productType = await db.productType.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!productType) {
      return NextResponse.json({ error: 'Product type not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, description, slug, isActive, sortOrder, attributes, imageUrl } = body

    // If slug is being changed, check if it already exists
    if (slug && slug !== productType.slug) {
      const existing = await db.productType.findUnique({
        where: {
          tenantId_slug: {
            tenantId: membership.tenantId,
            slug,
          },
        },
      })

      if (existing) {
        return NextResponse.json(
          { error: 'Product type with this slug already exists' },
          { status: 400 }
        )
      }
    }

    const updated = await db.productType.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(slug !== undefined && { slug }),
        ...(attributes !== undefined && { attributes }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    })

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('Error updating product type:', error)
    return NextResponse.json(
      { error: 'Failed to update product type' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's membership
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const productType = await db.productType.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
    })

    if (!productType) {
      return NextResponse.json({ error: 'Product type not found' }, { status: 404 })
    }

    await db.productType.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Product type deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting product type:', error)
    return NextResponse.json(
      { error: 'Failed to delete product type' },
      { status: 500 }
    )
  }
}
