import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/database'
import { queueNetsuitePOReceipt } from '@/lib/queue/netsuite-po-receipt-queue'

/**
 * PACE Purchase Order Receipt Webhook Handler
 *
 * This endpoint receives PO Receipt data from PACE and stores it for future
 * processing and potential forwarding to NetSuite.
 *
 * Webhook URL to configure in PACE:
 * https://calithosuite.com/api/webhooks/pace/po-receipt
 *
 * Set PACE_WEBHOOK_USERNAME and PACE_WEBHOOK_PASSWORD in your .env file
 */

interface PACEPOReceiptWebhookPayload {
  poNumber: string
  lineId: number
  qtyReceived: number
  metadata: {
    objectType: string
    exportedAt: string
    sourceLineLink?: string
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
        console.warn('PACE PO Receipt webhook received without Basic Auth')
        return NextResponse.json(
          { status: 'error', error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const base64Credentials = authHeader.split(' ')[1]
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
      const [username, password] = credentials.split(':')

      if (username !== expectedUsername || password !== expectedPassword) {
        console.warn('PACE PO Receipt webhook received with invalid credentials')
        return NextResponse.json(
          { status: 'error', error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    // Get the tenant (for single-tenant deployments, get the first/only tenant)
    const tenant = await db.tenant.findFirst()
    if (!tenant) {
      console.error('No tenant found - cannot process PO Receipt')
      return NextResponse.json(
        { status: 'error', error: 'No tenant configured' },
        { status: 500 }
      )
    }

    // Parse the webhook payload
    // Read as text first to handle JSON parsing errors gracefully
    let rawBody = await request.text()

    // PACE sometimes sends unescaped control characters (newlines, tabs, etc.) in JSON strings
    // We need to escape them before parsing
    rawBody = rawBody.replace(
      /"([^"\\]*(\\.[^"\\]*)*)"/g,
      (match) => {
        return match
          .replace(/\n/g, '\\n')   // Replace literal newlines with \n
          .replace(/\r/g, '\\r')   // Replace carriage returns with \r
          .replace(/\t/g, '\\t')   // Replace tabs with \t
      }
    )

    let payload: PACEPOReceiptWebhookPayload
    try {
      payload = JSON.parse(rawBody)
    } catch (parseError) {
      console.error('Failed to parse JSON payload:', parseError)
      console.error('Raw body (first 500 chars):', rawBody.substring(0, 500))
      return NextResponse.json(
        {
          status: 'error',
          error: 'Invalid JSON payload - contains invalid control characters or malformed JSON',
          details: parseError instanceof Error ? parseError.message : String(parseError)
        },
        { status: 400 }
      )
    }

    // Extract PO Line ID and PO Number
    const poLineId = payload.lineId
    const poNumber = payload.poNumber
    const qtyReceived = payload.qtyReceived

    console.log('📦 Received PACE PO Receipt webhook:', {
      poLineId,
      poNumber,
      qtyReceived,
    })

    // Validate required fields
    if (!poLineId) {
      console.error('PO Receipt webhook missing lineId')
      return NextResponse.json(
        { status: 'error', error: 'lineId is required' },
        { status: 400 }
      )
    }

    if (!poNumber) {
      console.error('PO Receipt webhook missing poNumber')
      return NextResponse.json(
        { status: 'error', error: 'poNumber is required' },
        { status: 400 }
      )
    }

    if (qtyReceived === undefined || qtyReceived === null) {
      console.error('PO Receipt webhook missing qtyReceived')
      return NextResponse.json(
        { status: 'error', error: 'qtyReceived is required' },
        { status: 400 }
      )
    }

    // Create unique identifier using PO Number, Line ID, and timestamp
    // Format: poNumber-poLineId-timestamp (e.g., "86014-156626-1736938200000")
    const timestamp = Date.now()
    const uniqueId = `${poNumber}-${poLineId}-${timestamp}`

    // Always create a new PO Receipt integration record (full history tracking)
    const poReceiptIntegration = await db.poReceiptIntegration.create({
      data: {
        tenantId: tenant.id,
        uniqueId: uniqueId,
        poNumber: poNumber,
        poLineId: poLineId,
        qtyReceived: qtyReceived,
        status: 'pending',
        payload: payload as any,
      },
    })

    console.log('✅ Created PO Receipt integration record:', {
      id: poReceiptIntegration.id,
      uniqueId: poReceiptIntegration.uniqueId,
      poNumber: poReceiptIntegration.poNumber,
      poLineId: poReceiptIntegration.poLineId,
      qtyReceived: poReceiptIntegration.qtyReceived,
      status: poReceiptIntegration.status,
    })

    // Queue for sending to NetSuite
    await queueNetsuitePOReceipt(poReceiptIntegration.id, uniqueId, 0)
    console.log(`📤 PO Receipt ${uniqueId} queued for NetSuite`)

    // Return success response
    return NextResponse.json({
      status: 'success',
      message: `PO Receipt ${poNumber}-${poLineId} received`,
      received_at: new Date().toISOString(),
      uniqueId: uniqueId,
      poNumber: poNumber,
      poLineId: poLineId,
      qtyReceived: qtyReceived,
      timestamp: timestamp,
    })

  } catch (error) {
    console.error('Error processing PACE PO Receipt webhook:', error)

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
    message: 'PACE Purchase Order Receipt Webhook Endpoint',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    instructions: 'This endpoint receives POST requests from PACE with PO Receipt data.',
    webhook_url: '/api/webhooks/pace/po-receipt',
    expected_payload: {
      poNumber: 'string (required)',
      lineId: 'number (required)',
      qtyReceived: 'number (required)',
      metadata: {
        objectType: 'string',
        exportedAt: 'string',
        sourceLineLink: 'string'
      }
    },
  })
}
