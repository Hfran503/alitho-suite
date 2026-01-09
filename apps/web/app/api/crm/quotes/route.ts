import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { z } from 'zod'

const createQuoteSchema = z.object({
  contactId: z.string().min(1, 'Contact is required'),
  opportunityId: z.string().optional().nullable(),
  title: z.string().optional(),
  description: z.string().optional(),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative().default(0),
  total: z.number().positive(),
  validUntil: z.string().optional().transform((str) => str ? new Date(str) : undefined),
  notes: z.string().optional(),
  items: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
    total: z.number().nonnegative(),
    sortOrder: z.number().int().default(0),
  })).optional().default([]),
})

// GET /api/crm/quotes
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
    const status = searchParams.get('status') || ''
    const opportunityId = searchParams.get('opportunityId') || ''
    const contactId = searchParams.get('contactId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where = {
      tenantId: membership.tenantId,
      ...(search && {
        quoteNumber: { contains: search, mode: 'insensitive' as const },
      }),
      ...(status && { status }),
      ...(opportunityId && { opportunityId }),
      ...(contactId && { contactId }),
    }

    const [quotes, total] = await Promise.all([
      db.quote.findMany({
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
          opportunity: {
            select: {
              id: true,
              opportunityNumber: true,
              title: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
        orderBy: [{ quoteNumber: 'desc' }, { version: 'desc' }],
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.quote.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: quotes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching quotes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quotes' },
      { status: 500 }
    )
  }
}

// POST /api/crm/quotes
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
    const validation = createQuoteSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
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

    const { items, ...quoteData } = validation.data

    const quote = await db.quote.create({
      data: {
        ...quoteData,
        quoteNumber,
        version: 1,
        tenantId: membership.tenantId,
        items: {
          create: items,
        },
      },
      include: {
        contact: true,
        opportunity: true,
        items: true,
      },
    })

    return NextResponse.json({ success: true, data: quote }, { status: 201 })
  } catch (error) {
    console.error('Error creating quote:', error)
    return NextResponse.json(
      { error: 'Failed to create quote' },
      { status: 500 }
    )
  }
}
