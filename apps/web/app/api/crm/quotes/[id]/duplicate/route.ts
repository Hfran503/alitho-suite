import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// POST /api/crm/quotes/[id]/duplicate - Create new version
export async function POST(
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

    const existing = await db.quote.findFirst({
      where: { id, tenantId: membership.tenantId },
      include: { items: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Find the highest version for this quote number
    const highestVersion = await db.quote.findFirst({
      where: {
        tenantId: membership.tenantId,
        quoteNumber: existing.quoteNumber,
      },
      orderBy: { version: 'desc' },
    })

    const nextVersion = (highestVersion?.version || 0) + 1

    // Create new version with copied data
    const newQuote = await db.quote.create({
      data: {
        quoteNumber: existing.quoteNumber,
        version: nextVersion,
        tenantId: existing.tenantId,
        contactId: existing.contactId,
        opportunityId: existing.opportunityId,
        title: existing.title,
        description: existing.description,
        subtotal: existing.subtotal,
        tax: existing.tax,
        total: existing.total,
        status: 'draft', // Reset to draft
        validUntil: existing.validUntil,
        notes: existing.notes,
        items: {
          create: existing.items.map((item: any) => ({
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: {
        contact: true,
        opportunity: true,
        items: true,
      },
    })

    return NextResponse.json({ success: true, data: newQuote }, { status: 201 })
  } catch (error) {
    console.error('Error duplicating quote:', error)
    return NextResponse.json(
      { error: 'Failed to duplicate quote' },
      { status: 500 }
    )
  }
}
