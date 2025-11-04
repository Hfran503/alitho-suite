import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { queueVendorBill } from '@/lib/queue/vendor-bill-queue'

/**
 * POST /api/vendor-bills/integrations/[id]/send
 * Manually queue a vendor bill to be sent to PACE
 * Query param: ?reset=true to reset retry count
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15
    const { id } = await params

    // Check for reset parameter
    const searchParams = req.nextUrl.searchParams
    const shouldReset = searchParams.get('reset') === 'true'

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

    // Get the vendor bill integration record
    const vendorBillIntegration = await db.vendorBillIntegration.findUnique({
      where: { id },
    })

    if (!vendorBillIntegration) {
      return NextResponse.json({ error: 'Vendor bill not found' }, { status: 404 })
    }

    // Check if already completed
    if (vendorBillIntegration.status === 'completed') {
      return NextResponse.json({
        success: false,
        error: 'This vendor bill has already been successfully sent to PACE',
      }, { status: 400 })
    }

    // Check if we've exceeded max retries (unless resetting)
    if (!shouldReset && vendorBillIntegration.retryCount >= vendorBillIntegration.maxRetries) {
      return NextResponse.json({
        success: false,
        error: `Maximum retry count (${vendorBillIntegration.maxRetries}) exceeded. Please check the error message and fix the issue before retrying.`,
        needsReset: true,
      }, { status: 400 })
    }

    // Update status to pending and optionally reset retry count
    await db.vendorBillIntegration.update({
      where: { id },
      data: {
        status: 'pending',
        errorMessage: null,
        ...(shouldReset && { retryCount: 0 }),
      },
    })

    // Queue for processing (no delay for manual send)
    await queueVendorBill(id, 0)

    console.log(`✅ Manually queued vendor bill ${id} for PACE`)

    return NextResponse.json({
      success: true,
      message: 'Vendor bill queued for processing. It will be sent to PACE shortly.',
      data: {
        id,
        status: 'pending',
      },
    })
  } catch (error) {
    console.error('Send vendor bill to PACE error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
