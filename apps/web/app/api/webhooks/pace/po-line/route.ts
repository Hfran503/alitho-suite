import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/database'

/**
 * PACE Purchase Order Line Webhook Handler
 *
 * This endpoint receives PO Line data from PACE and stores it for future
 * processing and potential forwarding to NetSuite.
 *
 * Webhook URL to configure in PACE:
 * https://calithosuite.com/api/webhooks/pace/po-line
 *
 * Set PACE_WEBHOOK_USERNAME and PACE_WEBHOOK_PASSWORD in your .env file
 */

interface PurchaseOrder {
  poNumber: string
  vendor: string
}

interface PurchaseOrderLine {
  id: number
  lineLink: string
  description: string
  item: string
  rate: number
  qtyOrdered: number
  qtyReceived: number
}

interface PACEPOLineWebhookPayload {
  purchaseOrder: PurchaseOrder
  purchaseOrderLine: PurchaseOrderLine
  metadata: {
    objectType: string
    exportedAt: string
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Basic Authentication
    const authHeader = request.headers.get('authorization')
    const expectedUsername = process.env.PACE_WEBHOOK_USERNAME
    const expectedPassword = process.env.PACE_WEBHOOK_PASSWORD

    if (expectedUsername && expectedPassword) {
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        console.warn('PACE PO Line webhook received without Basic Auth')
        return NextResponse.json(
          { status: 'error', error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const base64Credentials = authHeader.split(' ')[1]
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
      const [username, password] = credentials.split(':')

      if (username !== expectedUsername || password !== expectedPassword) {
        console.warn('PACE PO Line webhook received with invalid credentials')
        return NextResponse.json(
          { status: 'error', error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    // Get the tenant (for single-tenant deployments, get the first/only tenant)
    const tenant = await db.tenant.findFirst()
    if (!tenant) {
      console.error('No tenant found - cannot process PO Line')
      return NextResponse.json(
        { status: 'error', error: 'No tenant configured' },
        { status: 500 }
      )
    }

    // Parse the webhook payload
    const payload: PACEPOLineWebhookPayload = await request.json()

    // Extract PO Line ID and PO Number
    const poLineId = payload.purchaseOrderLine?.id
    const poNumber = payload.purchaseOrder?.poNumber

    console.log('📦 Received PACE PO Line webhook:', {
      poLineId,
      poNumber,
      vendor: payload.purchaseOrder?.vendor,
      item: payload.purchaseOrderLine?.item,
      description: payload.purchaseOrderLine?.description,
      qtyOrdered: payload.purchaseOrderLine?.qtyOrdered,
      qtyReceived: payload.purchaseOrderLine?.qtyReceived,
      rate: payload.purchaseOrderLine?.rate,
    })

    // Validate required fields
    if (!poLineId) {
      console.error('PO Line webhook missing purchaseOrderLine.id')
      return NextResponse.json(
        { status: 'error', error: 'purchaseOrderLine.id is required' },
        { status: 400 }
      )
    }

    if (!poNumber) {
      console.error('PO Line webhook missing purchaseOrder.poNumber')
      return NextResponse.json(
        { status: 'error', error: 'purchaseOrder.poNumber is required' },
        { status: 400 }
      )
    }

    // Create unique identifier using PO Number and Line ID
    const uniqueId = `${poNumber}-${poLineId}`

    // Check if PO Line already exists
    const existingPOLine = await db.poLineIntegration.findUnique({
      where: {
        uniqueId: uniqueId,
      },
    })

    if (existingPOLine) {
      console.log(`📋 PO Line ${uniqueId} already exists, updating...`)

      // Update existing PO Line with latest data
      const updated = await db.poLineIntegration.update({
        where: {
          uniqueId: uniqueId,
        },
        data: {
          payload: payload as any,
          status: 'pending', // Reset status to pending
          updatedAt: new Date(),
        },
      })

      console.log('✅ Updated PO Line integration record:', {
        id: updated.id,
        uniqueId: updated.uniqueId,
        poNumber,
        poLineId,
        status: updated.status,
      })

      return NextResponse.json({
        status: 'success',
        message: `PO Line ${uniqueId} updated`,
        uniqueId: updated.uniqueId,
        updated: true,
      })
    }

    // Create new PO Line integration record
    const poLineIntegration = await db.poLineIntegration.create({
      data: {
        tenantId: tenant.id,
        uniqueId: uniqueId,
        poNumber: poNumber,
        poLineId: poLineId,
        status: 'pending',
        payload: payload as any,
      },
    })

    console.log('✅ Created PO Line integration record:', {
      id: poLineIntegration.id,
      uniqueId: poLineIntegration.uniqueId,
      poNumber: poLineIntegration.poNumber,
      poLineId: poLineIntegration.poLineId,
      vendor: payload.purchaseOrder?.vendor,
      item: payload.purchaseOrderLine?.item,
      qtyOrdered: payload.purchaseOrderLine?.qtyOrdered,
      status: poLineIntegration.status,
    })

    // Return success response
    return NextResponse.json({
      status: 'success',
      message: `PO Line ${uniqueId} received`,
      received_at: new Date().toISOString(),
      uniqueId: uniqueId,
      poNumber: poNumber,
      poLineId: poLineId,
    })

  } catch (error) {
    console.error('Error processing PACE PO Line webhook:', error)

    // Return 500 on error so PACE can retry
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

// Handle GET requests for testing
export async function GET() {
  return NextResponse.json({
    message: 'PACE Purchase Order Line Webhook Endpoint',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    instructions: 'This endpoint receives POST requests from PACE with PO Line data.',
    webhook_url: '/api/webhooks/pace/po-line',
    expected_payload: {
      purchaseOrder: {
        poNumber: 'string (required)',
        vendor: 'string'
      },
      purchaseOrderLine: {
        id: 'number (required)',
        lineLink: 'string',
        description: 'string',
        item: 'string',
        rate: 'number',
        qtyOrdered: 'number',
        qtyReceived: 'number'
      },
      metadata: {
        objectType: 'string',
        exportedAt: 'string'
      }
    },
  })
}
