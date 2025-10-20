import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

/**
 * POST /api/labels - Create a new shipping label record
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const body = await req.json()
    const {
      paceShipmentId,
      paceCartonId,
      provider,
      providerShipmentId,
      providerLabelId,
      trackingNumber,
      labelUrl,
      carrier,
      service,
      shipFrom,
      shipTo,
      weight,
      length,
      width,
      height,
      cost,
      currency,
      status,
      isReturnLabel,
      outboundLabelId,
      rmaNumber,
      metadata,
    } = body

    // Create label record
    const label = await db.shippingLabel.create({
      data: {
        tenantId: membership.tenantId,
        paceShipmentId,
        paceCartonId: paceCartonId || null,
        provider,
        providerShipmentId: providerShipmentId || null,
        providerLabelId: providerLabelId || null,
        trackingNumber,
        labelUrl,
        carrier,
        service,
        shipFrom,
        shipTo,
        weight: weight || null,
        length: length || null,
        width: width || null,
        height: height || null,
        cost,
        currency: currency || 'USD',
        status: status || 'active',
        isReturnLabel: isReturnLabel || false,
        outboundLabelId: outboundLabelId || null,
        rmaNumber: rmaNumber || null,
        metadata: metadata || null,
      },
    })

    return NextResponse.json({
      success: true,
      data: { label },
    })
  } catch (error: any) {
    console.error('Create label error:', error)
    return NextResponse.json(
      { error: 'Failed to create label', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/labels - Get all shipping labels for the current tenant
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const provider = searchParams.get('provider')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {
      tenantId: membership.tenantId,
    }

    if (status) {
      where.status = status
    }

    if (provider) {
      where.provider = provider
    }

    // Fetch labels from database
    const [labels, total] = await Promise.all([
      db.shippingLabel.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      db.shippingLabel.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        labels,
        total,
        limit,
        offset,
      },
    })
  } catch (error: any) {
    console.error('Get labels error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch labels', details: error.message },
      { status: 500 }
    )
  }
}
