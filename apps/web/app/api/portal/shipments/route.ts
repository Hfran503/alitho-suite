import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { isCustomerRole } from '@/lib/roles'
import { fetchCustomerShipments, isPaceConfigured } from '@/lib/pace'

// GET /api/portal/shipments - Get customer's future shipments from PACE
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify customer role
    if (!isCustomerRole((session.user as any).role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if PACE API is configured
    const paceConfigured = await isPaceConfigured()
    if (!paceConfigured) {
      return NextResponse.json({
        error: 'PACE API not configured',
        message: 'Please contact your administrator to configure PACE integration',
      }, { status: 503 })
    }

    // Get user's PACE Customer ID
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { paceCustomerId: true },
    })

    if (!user?.paceCustomerId) {
      return NextResponse.json({
        error: 'PACE Customer ID not configured',
        message: 'Your account does not have a PACE Customer ID associated. Please contact your administrator.',
        shipments: [],
      }, { status: 200 })
    }

    // Fetch shipments from PACE API
    try {
      const shipments = await fetchCustomerShipments(user.paceCustomerId, true, 100)

      return NextResponse.json({
        shipments,
        customerID: user.paceCustomerId,
        count: shipments.length,
      })
    } catch (paceError) {
      console.error('PACE API Error:', paceError)

      return NextResponse.json({
        error: 'Failed to fetch shipments from PACE',
        message: paceError instanceof Error ? paceError.message : 'Unknown error',
        shipments: [],
      }, { status: 200 }) // Return 200 with empty array so UI doesn't break
    }
  } catch (error) {
    console.error('Error fetching customer shipments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shipments', shipments: [] },
      { status: 500 }
    )
  }
}
