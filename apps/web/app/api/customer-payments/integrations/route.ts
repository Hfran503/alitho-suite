import { NextResponse } from 'next/server'
import { db } from '@repo/database'

/**
 * GET /api/customer-payments/integrations
 * Fetch all customer payment integration records
 */
export async function GET() {
  try {
    const customerPayments = await db.customerPaymentIntegration.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      data: customerPayments,
    })
  } catch (error) {
    console.error('Error fetching customer payment integrations:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
