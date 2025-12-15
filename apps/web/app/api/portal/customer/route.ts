import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { isCustomerRole } from '@/lib/roles'

// GET /api/portal/customer - Get the WarehouseCustomer associated with the logged-in user's PACE Customer ID
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify customer role
    if (!isCustomerRole((session.user as any).role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get user's tenant and paceCustomerId
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        paceCustomerId: true,
        memberships: {
          select: { tenantId: true },
          take: 1,
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.paceCustomerId) {
      return NextResponse.json(
        { error: 'No PACE Customer ID associated with your account', code: 'NO_PACE_CUSTOMER_ID' },
        { status: 400 }
      )
    }

    const tenantId = user.memberships[0]?.tenantId
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Find the WarehouseCustomer by paceCustomerId
    const customer = await db.warehouseCustomer.findFirst({
      where: {
        tenantId,
        paceCustomerId: user.paceCustomerId,
        isActive: true,
      },
      select: {
        id: true,
        paceCustomerId: true,
        name: true,
        company: true,
        email: true,
        phone: true,
        shipToName: true,
        shipToAddress1: true,
        shipToAddress2: true,
        shipToCity: true,
        shipToState: true,
        shipToZip: true,
        shipToCountry: true,
        shipToPhone: true,
      },
    })

    if (!customer) {
      return NextResponse.json(
        {
          error: 'Customer not found in system. Please contact support.',
          code: 'CUSTOMER_NOT_FOUND',
          paceCustomerId: user.paceCustomerId,
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: customer,
    })
  } catch (error) {
    console.error('Error fetching portal customer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer information' },
      { status: 500 }
    )
  }
}
