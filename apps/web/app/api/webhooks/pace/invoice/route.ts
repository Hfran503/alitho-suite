import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/database'

/**
 * PACE Invoice Webhook Handler
 *
 * This endpoint receives invoice data from PACE and stores it for later
 * processing and forwarding to NetSuite.
 *
 * Webhook URL to configure in PACE:
 * https://calithosuite.com/api/webhooks/pace/invoice
 *
 * Set PACE_WEBHOOK_USERNAME and PACE_WEBHOOK_PASSWORD in your .env file
 */

interface SalesDistribution {
  id: number
  invoice: string
  amount: number
  salesCategory: string
  chargeBackAccount: string
  amountAdjustment: number
  jobPartReference: string
  jobProductReference: number
  glLocation: number | null
  ioID: string
  sourceOrganizationCompany: string
  posted: boolean
  taxBase: number
  commBase: number
  adjustedTotal: number
}

interface PACEInvoice {
  id: number
  invoiceNum: string
  invoiceAmount: number
  customer: string
  posted: boolean
  invoiceDate: string
}

interface PACEInvoiceWebhookPayload {
  invoice: PACEInvoice
  salesDistributions: SalesDistribution[]
  metadata: {
    totalSalesDistLines: number
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

    console.log('🔐 Auth Debug:', {
      hasAuthHeader: !!authHeader,
      hasExpectedUsername: !!expectedUsername,
      hasExpectedPassword: !!expectedPassword,
      authHeaderPreview: authHeader ? authHeader.substring(0, 20) + '...' : 'none'
    })

    if (expectedUsername && expectedPassword) {
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        console.warn('PACE Invoice webhook received without Basic Auth')
        return NextResponse.json(
          { status: 'error', error: 'Unauthorized - Missing Auth Header' },
          { status: 401 }
        )
      }

      const base64Credentials = authHeader.split(' ')[1]
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
      const [username, password] = credentials.split(':')

      console.log('🔑 Credentials received:', { username, passwordLength: password?.length })

      if (username !== expectedUsername || password !== expectedPassword) {
        console.warn('PACE Invoice webhook received with invalid credentials')
        console.log('Expected:', { username: expectedUsername, passwordLength: expectedPassword?.length })
        return NextResponse.json(
          { status: 'error', error: 'Unauthorized - Invalid Credentials' },
          { status: 401 }
        )
      }
    }

    // Parse the webhook payload
    const payload: PACEInvoiceWebhookPayload = await request.json()

    // Extract invoice number from the nested structure
    const invoiceNumber = payload.invoice?.invoiceNum

    console.log('📄 Received PACE invoice webhook:', {
      invoiceNumber,
      invoiceAmount: payload.invoice?.invoiceAmount,
      customer: payload.invoice?.customer,
      salesDistLines: payload.salesDistributions?.length || 0,
    })

    // Validate invoice number exists
    if (!invoiceNumber) {
      console.error('Invoice webhook missing invoice.invoiceNum')
      return NextResponse.json(
        { status: 'error', error: 'invoice.invoiceNum is required' },
        { status: 400 }
      )
    }

    // Check if invoice already exists
    const existingInvoice = await db.invoiceIntegration.findUnique({
      where: {
        invoiceNumber: invoiceNumber,
      },
    })

    if (existingInvoice) {
      console.warn(`Invoice ${invoiceNumber} already exists, updating...`)

      // Update existing invoice
      const updated = await db.invoiceIntegration.update({
        where: {
          invoiceNumber: invoiceNumber,
        },
        data: {
          payload: payload as any, // Cast to any for JSON field
          status: 'pending', // Reset status to pending if re-sent
          retryCount: 0, // Reset retry count
          updatedAt: new Date(),
        },
      })

      console.log('✅ Updated invoice integration record:', {
        id: updated.id,
        invoiceNumber: updated.invoiceNumber,
        status: updated.status,
      })

      return NextResponse.json({
        status: 'success',
        message: `Invoice ${invoiceNumber} updated with ${payload.salesDistributions?.length || 0} lines`,
        invoiceNumber: updated.invoiceNumber,
        salesDistLines: payload.salesDistributions?.length || 0,
      })
    }

    // Create new invoice integration record
    const invoiceIntegration = await db.invoiceIntegration.create({
      data: {
        invoiceNumber: invoiceNumber,
        status: 'pending',
        payload: payload as any, // Cast to any for JSON field
        retryCount: 0,
        maxRetries: 3,
      },
    })

    console.log('✅ Created invoice integration record:', {
      id: invoiceIntegration.id,
      invoiceNumber: invoiceIntegration.invoiceNumber,
      invoiceAmount: payload.invoice?.invoiceAmount,
      customer: payload.invoice?.customer,
      salesDistLines: payload.salesDistributions?.length || 0,
      status: invoiceIntegration.status,
    })

    // Return success response matching your Python test format
    return NextResponse.json({
      status: 'success',
      message: `Invoice ${invoiceNumber} received with ${payload.salesDistributions?.length || 0} lines`,
      received_at: new Date().toISOString(),
      invoiceNumber: invoiceNumber,
      salesDistLines: payload.salesDistributions?.length || 0,
    })

  } catch (error) {
    console.error('Error processing PACE invoice webhook:', error)

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
    message: 'PACE Invoice Webhook Endpoint',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    instructions: 'This endpoint receives POST requests from PACE with invoice data.',
    webhook_url: '/api/webhooks/pace/invoice',
    expected_payload: {
      invoice: {
        id: 'number',
        invoiceNum: 'string (required)',
        invoiceAmount: 'number',
        customer: 'string',
        posted: 'boolean',
        invoiceDate: 'string'
      },
      salesDistributions: 'array',
      metadata: 'object'
    },
  })
}
