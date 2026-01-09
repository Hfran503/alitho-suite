import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

const createOpportunitySchema = z.object({
  contactId: z.string().min(1, 'Contact is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  stage: z.string().optional(),
  expectedCloseDate: z.string().optional().transform((str) => str ? new Date(str) : undefined),
  notes: z.string().optional(),
})

// GET /api/crm/opportunities
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const stage = searchParams.get('stage') || ''
    const status = searchParams.get('status') || ''
    const contactId = searchParams.get('contactId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where = {
      tenantId: membership.tenantId,
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { opportunityNumber: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(stage && { stage }),
      ...(status && { status }),
      ...(contactId && { contactId }),
    }

    const [opportunities, total] = await Promise.all([
      db.opportunity.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              company: true,
            },
          },
          _count: {
            select: { quotes: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.opportunity.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: opportunities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching opportunities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch opportunities' },
      { status: 500 }
    )
  }
}

// POST /api/crm/opportunities
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const validation = createOpportunitySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Generate opportunity number
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

    const opportunity = await db.opportunity.create({
      data: {
        ...validation.data,
        opportunityNumber,
        tenantId: membership.tenantId,
      },
      include: {
        contact: true,
      },
    })

    return NextResponse.json({ success: true, data: opportunity }, { status: 201 })
  } catch (error) {
    console.error('Error creating opportunity:', error)
    return NextResponse.json(
      { error: 'Failed to create opportunity' },
      { status: 500 }
    )
  }
}
