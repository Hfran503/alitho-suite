import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/database'

/**
 * PACE Invoice Webhook Handler
 *
 * This endpoint receives invoice data from PACE and stores it for later
 * processing and forwarding to NetSuite.
 *
 * Webhook URL to register in PACE (with Basic Auth):
 * https://username:password@yourdomain.com/api/webhooks/pace/invoice
 *
 * Set PACE_WEBHOOK_USERNAME and PACE_WEBHOOK_PASSWORD in your .env file
 */

interface PACEInvoiceWebhookPayload {
  invoiceNumber: string
  [key: string]: any // Accept any other invoice fields
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Basic Authentication
    const authHeader = request.headers.get('authorization')
    const expectedUsername = process.env.PACE_WEBHOOK_USERNAME
    const expectedPassword = process.env.PACE_WEBHOOK_PASSWORD

    if (expectedUsername && expectedPassword) {
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        console.warn('PACE Invoice webhook received without Basic Auth')
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const base64Credentials = authHeader.split(' ')[1]
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
      const [username, password] = credentials.split(':')

      if (username !== expectedUsername || password !== expectedPassword) {
        console.warn('PACE Invoice webhook received with invalid credentials')
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    // Parse the webhook payload
    const payload: PACEInvoiceWebhookPayload = await request.json()

    console.log('📄 Received PACE invoice webhook:', {
      invoiceNumber: payload.invoiceNumber,
    })

    // Validate invoice number exists
    if (!payload.invoiceNumber) {
      console.error('Invoice webhook missing invoiceNumber')
      return NextResponse.json(
        { success: false, error: 'invoiceNumber is required' },
        { status: 400 }
      )
    }

    // Check if invoice already exists
    const existingInvoice = await db.invoiceIntegration.findUnique({
      where: {
        invoiceNumber: payload.invoiceNumber,
      },
    })

    if (existingInvoice) {
      console.warn(`Invoice ${payload.invoiceNumber} already exists, updating...`)

      // Update existing invoice
      const updated = await db.invoiceIntegration.update({
        where: {
          invoiceNumber: payload.invoiceNumber,
        },
        data: {
          payload: payload,
          status: 'pending', // Reset status to pending if re-sent
          retryCount: 0, // Reset retry count
          updatedAt: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Invoice updated successfully',
        invoiceNumber: updated.invoiceNumber,
        id: updated.id,
        status: updated.status,
      })
    }

    // Create new invoice integration record
    const invoiceIntegration = await db.invoiceIntegration.create({
      data: {
        invoiceNumber: payload.invoiceNumber,
        status: 'pending',
        payload: payload,
        retryCount: 0,
        maxRetries: 3,
      },
    })

    console.log('✅ Created invoice integration record:', {
      id: invoiceIntegration.id,
      invoiceNumber: invoiceIntegration.invoiceNumber,
      status: invoiceIntegration.status,
    })

    // TODO: Add custom business logic here
    // Examples:
    // - Trigger background job to process invoice immediately
    // - Send notification to accounting team
    // - Validate invoice data before accepting
    // - Queue for NetSuite integration

    return NextResponse.json({
      success: true,
      message: 'Invoice received and queued for processing',
      invoiceNumber: invoiceIntegration.invoiceNumber,
      id: invoiceIntegration.id,
      status: invoiceIntegration.status,
    })

  } catch (error) {
    console.error('Error processing PACE invoice webhook:', error)

    // Return 500 on error so PACE can retry
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

// Handle GET requests for testing
export async function GET() {
  return NextResponse.json({
    message: 'PACE Invoice Webhook Endpoint',
    status: 'active',
    instructions: 'This endpoint receives POST requests from PACE with invoice data.',
    webhook_url: '/api/webhooks/pace/invoice',
    expected_payload: {
      invoiceNumber: 'INV-12345 (required)',
      // Add other expected fields as documentation
    },
  })
}
