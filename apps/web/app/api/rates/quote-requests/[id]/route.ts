import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/rates/quote-requests/[id] - Get a single quote request
export async function GET(
  _req: NextRequest,
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

    const quoteRequest = await db.shippingQuoteRequest.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
      },
    })

    if (!quoteRequest) {
      return NextResponse.json({ error: 'Quote request not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: quoteRequest })
  } catch (error: any) {
    console.error('Error fetching quote request:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch quote request' },
      { status: 500 }
    )
  }
}
