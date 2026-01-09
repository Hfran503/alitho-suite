import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/crm/opportunities/generate-number
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

    const year = new Date().getFullYear()
    const lastOpportunity = await db.opportunity.findFirst({
      where: {
        tenantId: membership.tenantId,
        opportunityNumber: { startsWith: `OPP-${year}-` },
      },
      orderBy: { opportunityNumber: 'desc' },
    })

    let nextNumber = 1
    if (lastOpportunity) {
      const match = lastOpportunity.opportunityNumber.match(/OPP-\d+-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }

    const opportunityNumber = `OPP-${year}-${nextNumber.toString().padStart(4, '0')}`

    return NextResponse.json({
      success: true,
      data: { opportunityNumber },
    })
  } catch (error) {
    console.error('Error generating opportunity number:', error)
    return NextResponse.json(
      { error: 'Failed to generate opportunity number' },
      { status: 500 }
    )
  }
}
