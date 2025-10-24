import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/database'

/**
 * GET /api/invoices/integrations
 * Fetch all invoice integration records
 */
export async function GET(request: NextRequest) {
  try {
    const invoices = await db.invoiceIntegration.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      data: invoices,
    })
  } catch (error) {
    console.error('Error fetching invoice integrations:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
