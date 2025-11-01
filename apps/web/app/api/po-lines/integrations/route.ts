import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

/**
 * GET /api/po-lines/integrations
 * List all PO Line integrations for the current tenant
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

    // Fetch all PO Line integrations for this tenant
    const poLines = await db.poLineIntegration.findMany({
      where: {
        tenantId: membership.tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      data: poLines,
    })
  } catch (error: any) {
    console.error('Error fetching PO Line integrations:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch PO Line integrations' },
      { status: 500 }
    )
  }
}
