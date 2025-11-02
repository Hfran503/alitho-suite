import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

/**
 * GET /api/po-receipts/integrations/send-all-to-netsuite
 * Get information about the batch send endpoint
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Batch PO Receipt to NetSuite Integration Endpoint',
    version: '1.0',
    timestamp: new Date().toISOString(),
    endpoint: '/api/po-receipts/integrations/send-all-to-netsuite',
    description: 'Send all pending PO Receipt integrations to NetSuite in batch',
    methods: ['GET', 'POST'],
    restletUrl: process.env.NETSUITE_PO_RECEIPT_RESTLET_URL || 'Not configured',
    configured: !!process.env.NETSUITE_PO_RECEIPT_RESTLET_URL,
    note: 'This endpoint processes PO Receipts sequentially with 1 second delay between each',
  })
}

/**
 * POST /api/po-receipts/integrations/send-all-to-netsuite
 * Send all pending PO Receipt integrations to NetSuite
 */
export async function POST(req: NextRequest) {
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

    // Get all pending PO Receipts for this tenant
    const pendingPOReceipts = await db.poReceiptIntegration.findMany({
      where: {
        tenantId: membership.tenantId,
        status: 'pending',
      },
      orderBy: {
        createdAt: 'asc', // Process oldest first
      },
    })

    if (pendingPOReceipts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending PO Receipts to send',
        totalProcessed: 0,
        successful: 0,
        failed: 0,
      })
    }

    console.log(`📤 Sending ${pendingPOReceipts.length} pending PO Receipts to NetSuite...`)

    let successful = 0
    let failed = 0
    const results = []

    // Process each PO Receipt sequentially to avoid overwhelming NetSuite
    for (const poReceipt of pendingPOReceipts) {
      try {
        // Call the single send endpoint
        const response = await fetch(
          `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/po-receipts/integrations/${poReceipt.id}/send-to-netsuite`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: req.headers.get('cookie') || '',
            },
          }
        )

        const result = await response.json()

        if (result.success) {
          successful++
          results.push({
            uniqueId: poReceipt.uniqueId,
            success: true,
            receiptId: result.receiptId,
          })
          console.log(`✅ PO Receipt ${poReceipt.uniqueId} sent successfully`)
        } else {
          failed++
          results.push({
            uniqueId: poReceipt.uniqueId,
            success: false,
            error: result.error,
          })
          console.error(`❌ PO Receipt ${poReceipt.uniqueId} failed:`, result.error)
        }

        // Add a small delay between requests to be respectful to NetSuite
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error: any) {
        failed++
        results.push({
          uniqueId: poReceipt.uniqueId,
          success: false,
          error: error.message,
        })
        console.error(`❌ PO Receipt ${poReceipt.uniqueId} exception:`, error.message)
      }
    }

    console.log(`🏁 Batch send complete: ${successful} successful, ${failed} failed out of ${pendingPOReceipts.length} total`)

    return NextResponse.json({
      success: true,
      message: `Processed ${pendingPOReceipts.length} PO Receipts: ${successful} successful, ${failed} failed`,
      totalProcessed: pendingPOReceipts.length,
      successful,
      failed,
      results: results.filter((r) => !r.success), // Only return failures for debugging
    })
  } catch (error: any) {
    console.error('Error in batch send to NetSuite:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send PO Receipts to NetSuite' },
      { status: 500 }
    )
  }
}
