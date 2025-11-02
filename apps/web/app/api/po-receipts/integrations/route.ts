import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

/**
 * GET /api/po-receipts/integrations
 * List all PO Receipt integrations for the current tenant
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      select: { tenantId: true },
    })

    if (!membership?.tenantId) {
      return NextResponse.json({ error: 'User has no tenant' }, { status: 400 })
    }

    // Fetch all PO Receipt integrations for this tenant
    const poReceipts = await db.poReceiptIntegration.findMany({
      where: {
        tenantId: membership.tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      data: poReceipts,
    })
  } catch (error: any) {
    console.error('Error fetching PO Receipt integrations:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch PO Receipt integrations' },
      { status: 500 }
    )
  }
}
