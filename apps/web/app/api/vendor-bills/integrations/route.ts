import { NextResponse } from 'next/server'
import { db } from '@repo/database'

/**
 * GET /api/vendor-bills/integrations
 * Fetch all vendor bill integration records
 */
export async function GET() {
  try {
    const vendorBills = await db.vendorBillIntegration.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      data: vendorBills,
    })
  } catch (error) {
    console.error('Error fetching vendor bill integrations:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
