import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { queueCustomerPayment } from '@/lib/queue/customer-payment-queue'

/**
 * POST /api/customer-payments/integrations/[id]/send
 * Manually queue a customer payment to be sent to PACE
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

    // Get the customer payment integration record
    const customerPaymentIntegration = await db.customerPaymentIntegration.findUnique({
      where: { id },
    })

    if (!customerPaymentIntegration) {
      return NextResponse.json({ error: 'Customer payment not found' }, { status: 404 })
    }

    // Check if already completed
    if (customerPaymentIntegration.status === 'completed') {
      return NextResponse.json({
        success: false,
        error: 'This customer payment has already been successfully sent to PACE',
      }, { status: 400 })
    }

    // Check if we've exceeded max retries (unless resetting)
    if (!shouldReset && customerPaymentIntegration.retryCount >= customerPaymentIntegration.maxRetries) {
      return NextResponse.json({
        success: false,
        error: `Maximum retry count (${customerPaymentIntegration.maxRetries}) exceeded. Please check the error message and fix the issue before retrying.`,
        needsReset: true,
      }, { status: 400 })
    }

    // Update status to pending and optionally reset retry count
    await db.customerPaymentIntegration.update({
      where: { id },
      data: {
        status: 'pending',
        errorMessage: null,
        ...(shouldReset && { retryCount: 0 }),
      },
    })

    // Queue for processing (no delay for manual send)
    await queueCustomerPayment(id, 0)

    console.log(`✅ Manually queued customer payment ${id} for PACE`)

    return NextResponse.json({
      success: true,
      message: 'Customer payment queued for processing. It will be sent to PACE shortly.',
      data: {
        id,
        status: 'pending',
      },
    })
  } catch (error) {
    console.error('Send customer payment to PACE error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
