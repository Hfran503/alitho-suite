import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

const updateASNSchema = z.object({
  vendorName: z.string().min(1).optional(),
  vendorEmail: z.string().email().optional().nullable(),
  expectedDate: z.string().transform((str) => new Date(str)).optional(),
  carrier: z.string().optional().nullable(),
  trackingNumber: z.string().optional().nullable(),
  poNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

// GET /api/warehouse/asn/[id] - Get single ASN
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

    const asn = await db.aSN.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
      include: {
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
          },
        },
        receivingRecord: {
          select: { id: true, status: true },
        },
      },
    })

    if (!asn) {
      return NextResponse.json({ error: 'ASN not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: asn,
    })
  } catch (error) {
    console.error('Error fetching ASN:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ASN' },
      { status: 500 }
    )
  }
}

// PATCH /api/warehouse/asn/[id] - Update ASN
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
    const existing = await db.aSN.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'ASN not found' }, { status: 404 })
    }

    // Only allow editing DRAFT or PENDING ASNs
    if (!['DRAFT', 'PENDING'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'Cannot edit ASN that is not in DRAFT or PENDING status' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = updateASNSchema.parse(body)

    const asn = await db.aSN.update({
      where: { id },
      data: validatedData,
      include: {
        warehouse: { select: { id: true, name: true } },
        items: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: asn,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating ASN:', error)
    return NextResponse.json(
      { error: 'Failed to update ASN' },
      { status: 500 }
    )
  }
}

// DELETE /api/warehouse/asn/[id] - Delete ASN
export async function DELETE(
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

    const allowedRoles = ['admin', 'full_admin']
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const existing = await db.aSN.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'ASN not found' }, { status: 404 })
    }

    // Only allow deleting DRAFT or CANCELLED ASNs
    if (!['DRAFT', 'CANCELLED'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'Cannot delete ASN that is not in DRAFT or CANCELLED status' },
        { status: 400 }
      )
    }

    await db.aSN.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: 'ASN deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting ASN:', error)
    return NextResponse.json(
      { error: 'Failed to delete ASN' },
      { status: 500 }
    )
  }
}
