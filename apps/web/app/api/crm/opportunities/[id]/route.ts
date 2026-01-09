import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

const updateOpportunitySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  amount: z.number().positive().optional(),
  stage: z.string().optional(),
  status: z.string().optional(),
  expectedCloseDate: z.string().optional().nullable().transform((str) => str ? new Date(str) : null),
  notes: z.string().optional().nullable(),
})

// GET /api/crm/opportunities/[id]
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

    const opportunity = await db.opportunity.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
      include: {
        contact: true,
        quotes: {
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        },
      },
    })

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: opportunity })
  } catch (error) {
    console.error('Error fetching opportunity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch opportunity' },
      { status: 500 }
    )
  }
}

// PATCH /api/crm/opportunities/[id]
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

    const { id } = await params

    const existing = await db.opportunity.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    const body = await request.json()
    const validation = updateOpportunitySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Auto-set closedAt when status changes to closed
    const updateData: any = { ...validation.data }
    if (validation.data.status === 'closed' && existing.status !== 'closed') {
      updateData.closedAt = new Date()
    }

    const opportunity = await db.opportunity.update({
      where: { id },
      data: updateData,
      include: { contact: true },
    })

    return NextResponse.json({ success: true, data: opportunity })
  } catch (error) {
    console.error('Error updating opportunity:', error)
    return NextResponse.json(
      { error: 'Failed to update opportunity' },
      { status: 500 }
    )
  }
}

// DELETE /api/crm/opportunities/[id]
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

    const { id } = await params

    const existing = await db.opportunity.findFirst({
      where: { id, tenantId: membership.tenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    await db.opportunity.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: 'Opportunity deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting opportunity:', error)
    return NextResponse.json(
      { error: 'Failed to delete opportunity' },
      { status: 500 }
    )
  }
}
