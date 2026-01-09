import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/crm/quotes/generate-number - Generate next quote number
export async function GET(_request: NextRequest) {
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

    // Generate quote number
    const year = new Date().getFullYear()
    const lastQuote = await db.quote.findFirst({
      where: {
        tenantId: membership.tenantId,
        quoteNumber: { startsWith: `QT-${year}-` },
      },
      orderBy: { quoteNumber: 'desc' },
    })

    let nextNumber = 1
    if (lastQuote) {
      const match = lastQuote.quoteNumber.match(/QT-\d+-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }

    const quoteNumber = `QT-${year}-${nextNumber.toString().padStart(4, '0')}`

    return NextResponse.json({ success: true, data: { quoteNumber } })
  } catch (error) {
    console.error('Error generating quote number:', error)
    return NextResponse.json(
      { error: 'Failed to generate quote number' },
      { status: 500 }
    )
  }
}
