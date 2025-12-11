import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

const addItemSchema = z.object({
  itemId: z.string().optional().nullable(),
  sku: z.string().min(1),
  description: z.string().min(1),
  expectedQty: z.number().int().positive(),
  lotNumber: z.string().optional().nullable(),
  expirationDate: z.string().optional().nullable().transform((str) => str ? new Date(str) : null),
})

const updateItemSchema = z.object({
  itemId: z.string().optional().nullable(),
  sku: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  expectedQty: z.number().int().positive().optional(),
  receivedQty: z.number().int().min(0).optional(),
  lotNumber: z.string().optional().nullable(),
  expirationDate: z.string().optional().nullable().transform((str) => str ? new Date(str) : null),
})

// GET /api/warehouse/asn/[id]/items - List ASN items
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const { id } = await params

    // Verify ASN exists and belongs to tenant
    const asn = await db.aSN.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!asn) {
      return NextResponse.json({ error: 'ASN not found' }, { status: 404 })
    }

    const items = await db.aSNItem.findMany({
      where: { asnId: id },
      include: {
        item: { select: { id: true, sku: true, name: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: items,
    })
  } catch (error) {
    console.error('Error fetching ASN items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ASN items' },
      { status: 500 }
    )
  }
}

// POST /api/warehouse/asn/[id]/items - Add item to ASN
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Verify ASN exists and belongs to tenant
    const asn = await db.aSN.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!asn) {
      return NextResponse.json({ error: 'ASN not found' }, { status: 404 })
    }

    // Only allow adding items to DRAFT or PENDING ASNs
    if (!['DRAFT', 'PENDING'].includes(asn.status)) {
      return NextResponse.json(
        { error: 'Cannot add items to ASN that is not in DRAFT or PENDING status' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = addItemSchema.parse(body)

    const item = await db.aSNItem.create({
      data: {
        asnId: id,
        ...validatedData,
      },
      include: {
        item: { select: { id: true, sku: true, name: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: item,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error adding ASN item:', error)
    return NextResponse.json(
      { error: 'Failed to add ASN item' },
      { status: 500 }
    )
  }
}

// PATCH /api/warehouse/asn/[id]/items - Bulk update items (for receiving)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Verify ASN exists and belongs to tenant
    const asn = await db.aSN.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!asn) {
      return NextResponse.json({ error: 'ASN not found' }, { status: 404 })
    }

    const body = await request.json()
    const { items } = z.object({
      items: z.array(z.object({
        id: z.string(),
        ...updateItemSchema.shape,
      })),
    }).parse(body)

    // Update each item
    const updatedItems = await Promise.all(
      items.map(async ({ id: itemId, ...data }) => {
        return db.aSNItem.update({
          where: { id: itemId },
          data,
          include: {
            item: { select: { id: true, sku: true, name: true } },
          },
        })
      })
    )

    return NextResponse.json({
      success: true,
      data: updatedItems,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating ASN items:', error)
    return NextResponse.json(
      { error: 'Failed to update ASN items' },
      { status: 500 }
    )
  }
}

// DELETE /api/warehouse/asn/[id]/items - Delete item from ASN (via query param itemId)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const allowedRoles = ['admin', 'full_admin', 'warehouse', 'logistics']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 })
    }

    // Verify ASN exists and belongs to tenant
    const asn = await db.aSN.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!asn) {
      return NextResponse.json({ error: 'ASN not found' }, { status: 404 })
    }

    // Only allow deleting items from DRAFT or PENDING ASNs
    if (!['DRAFT', 'PENDING'].includes(asn.status)) {
      return NextResponse.json(
        { error: 'Cannot delete items from ASN that is not in DRAFT or PENDING status' },
        { status: 400 }
      )
    }

    // Verify item belongs to this ASN
    const item = await db.aSNItem.findFirst({
      where: { id: itemId, asnId: id },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    await db.aSNItem.delete({ where: { id: itemId } })

    return NextResponse.json({
      success: true,
      message: 'Item deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting ASN item:', error)
    return NextResponse.json(
      { error: 'Failed to delete ASN item' },
      { status: 500 }
    )
  }
}
