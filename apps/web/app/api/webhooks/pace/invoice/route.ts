import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/database'
import { queueNetsuiteInvoice } from '@/lib/queue/netsuite-invoice-queue'

/**
 * PACE Invoice Webhook Handler
 *
 * This endpoint receives invoice data from PACE, stores it, and automatically
 * queues it for processing and forwarding to NetSuite.
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
  quantity: number
  salesCategoryId: number | null
  salesCategoryName: string
}

interface InvoiceExtra {
  id: number
  lineNum: number | null
  price: number
  quantity: number
  invoiceExtraTypeId: number | null
  invoiceExtraTypeName: string
}

interface PACEInvoice {
  id: number
  invoiceNum: string
  invoiceAmount: number
  taxAmount: number
  customerId: string
  customerName: string
  invoiceDate: string
  poNumber: string
}

interface PACEInvoiceWebhookPayload {
  invoice: PACEInvoice
  salesDistributions: SalesDistribution[]
  invoiceExtras: InvoiceExtra[]
  metadata: {
    totalSalesDistLines: number
    totalInvoiceExtras: number
    objectType: string
    exportedAt: string
    paceInvoiceIds?: number[] // Track multiple PACE invoice IDs for same invoice number
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
        console.warn('PACE Invoice webhook received without Basic Auth')
        return NextResponse.json(
          { status: 'error', error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const base64Credentials = authHeader.split(' ')[1]
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
      const [username, password] = credentials.split(':')

      if (username !== expectedUsername || password !== expectedPassword) {
        console.warn('PACE Invoice webhook received with invalid credentials')
        return NextResponse.json(
          { status: 'error', error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    // Get the tenant (for single-tenant deployments, get the first/only tenant)
    const tenant = await db.tenant.findFirst()
    if (!tenant) {
      console.error('No tenant found - cannot process invoice')
      return NextResponse.json(
        { status: 'error', error: 'No tenant configured' },
        { status: 500 }
      )
    }

    // Parse the webhook payload
    const payload: PACEInvoiceWebhookPayload = await request.json()

    // Extract invoice number from the nested structure
    const invoiceNumber = payload.invoice?.invoiceNum

    console.log('📄 Received PACE invoice webhook:', {
      invoiceNumber,
      invoiceAmount: payload.invoice?.invoiceAmount,
      taxAmount: payload.invoice?.taxAmount,
      customerName: payload.invoice?.customerName,
      salesDistLines: payload.salesDistributions?.length || 0,
      invoiceExtras: payload.invoiceExtras?.length || 0,
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
      console.log(`📋 Invoice ${invoiceNumber} already exists, accumulating line items...`)

      // Parse existing payload
      const existingPayload = existingInvoice.payload as unknown as PACEInvoiceWebhookPayload

      // Accumulate sales distributions (combine arrays, remove duplicates by ID)
      const existingSalesDistributions = existingPayload.salesDistributions || []
      const newSalesDistributions = payload.salesDistributions || []

      // Create a map to track unique sales distributions by ID
      const salesDistMap = new Map()
      existingSalesDistributions.forEach(dist => salesDistMap.set(dist.id, dist))
      newSalesDistributions.forEach(dist => salesDistMap.set(dist.id, dist))
      const combinedSalesDistributions = Array.from(salesDistMap.values())

      // Accumulate invoice extras (combine arrays, remove duplicates by ID)
      const existingInvoiceExtras = existingPayload.invoiceExtras || []
      const newInvoiceExtras = payload.invoiceExtras || []

      const extrasMap = new Map()
      existingInvoiceExtras.forEach(extra => extrasMap.set(extra.id, extra))
      newInvoiceExtras.forEach(extra => extrasMap.set(extra.id, extra))
      const combinedInvoiceExtras = Array.from(extrasMap.values())

      // Calculate combined totals
      const combinedInvoiceAmount = combinedSalesDistributions.reduce((sum, dist) => sum + dist.amount, 0)
      const combinedExtrasAmount = combinedInvoiceExtras.reduce((sum, extra) => sum + extra.price, 0)
      const totalAmount = combinedInvoiceAmount + combinedExtrasAmount

      // Create combined payload
      const combinedPayload: PACEInvoiceWebhookPayload = {
        invoice: {
          ...payload.invoice,
          invoiceAmount: totalAmount,
          // Keep the latest tax amount (or accumulate if needed)
          taxAmount: payload.invoice.taxAmount,
        },
        salesDistributions: combinedSalesDistributions,
        invoiceExtras: combinedInvoiceExtras,
        metadata: {
          ...payload.metadata,
          totalSalesDistLines: combinedSalesDistributions.length,
          totalInvoiceExtras: combinedInvoiceExtras.length,
          exportedAt: new Date().toISOString(),
          paceInvoiceIds: [
            ...(existingPayload.metadata?.paceInvoiceIds || [existingPayload.invoice.id]),
            payload.invoice.id
          ].filter((id, index, self) => self.indexOf(id) === index), // Remove duplicates
        },
      }

      // Update existing invoice with combined data
      const updated = await db.invoiceIntegration.update({
        where: {
          invoiceNumber: invoiceNumber,
        },
        data: {
          payload: combinedPayload as any,
          status: 'pending', // Reset status to pending
          retryCount: 0, // Reset retry count
          updatedAt: new Date(),
        },
      })

      console.log('✅ Accumulated invoice data:', {
        id: updated.id,
        invoiceNumber: updated.invoiceNumber,
        previousSalesDistLines: existingSalesDistributions.length,
        newSalesDistLines: newSalesDistributions.length,
        combinedSalesDistLines: combinedSalesDistributions.length,
        previousExtras: existingInvoiceExtras.length,
        newExtras: newInvoiceExtras.length,
        combinedExtras: combinedInvoiceExtras.length,
        totalAmount: totalAmount.toFixed(2),
        status: updated.status,
      })

      // Queue the invoice for automatic processing with a delay
      // This allows multiple parts to accumulate before sending to NetSuite
      // If already queued, the jobId will be replaced with the new delayed job
      const ACCUMULATION_DELAY_MS = 10000 // 10 seconds delay to allow parts to accumulate
      try {
        await queueNetsuiteInvoice(updated.id, updated.invoiceNumber, ACCUMULATION_DELAY_MS)
        console.log(`🔄 Queued accumulated invoice ${invoiceNumber} for NetSuite processing (${ACCUMULATION_DELAY_MS}ms delay)`)
      } catch (queueError) {
        console.error('Failed to queue invoice:', queueError)
        // Don't fail the webhook, just log the error
      }

      return NextResponse.json({
        status: 'success',
        message: `Invoice ${invoiceNumber} accumulated and queued for NetSuite`,
        invoiceNumber: updated.invoiceNumber,
        salesDistLines: combinedSalesDistributions.length,
        invoiceExtras: combinedInvoiceExtras.length,
        totalAmount: totalAmount.toFixed(2),
        accumulated: true,
        queued: true,
      })
    }

    // Create new invoice integration record
    const invoiceIntegration = await db.invoiceIntegration.create({
      data: {
        tenantId: tenant.id,
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
      taxAmount: payload.invoice?.taxAmount,
      customerName: payload.invoice?.customerName,
      salesDistLines: payload.salesDistributions?.length || 0,
      invoiceExtras: payload.invoiceExtras?.length || 0,
      status: invoiceIntegration.status,
    })

    // Queue the invoice for automatic processing with a delay
    // This allows multiple parts to arrive before sending to NetSuite
    const ACCUMULATION_DELAY_MS = 10000 // 10 seconds delay to allow parts to accumulate
    try {
      await queueNetsuiteInvoice(invoiceIntegration.id, invoiceIntegration.invoiceNumber, ACCUMULATION_DELAY_MS)
      console.log(`🔄 Queued invoice ${invoiceNumber} for NetSuite processing (${ACCUMULATION_DELAY_MS}ms delay)`)
    } catch (queueError) {
      console.error('Failed to queue invoice:', queueError)
      // Don't fail the webhook, just log the error
    }

    // Return success response
    return NextResponse.json({
      status: 'success',
      message: `Invoice ${invoiceNumber} received and queued for NetSuite`,
      received_at: new Date().toISOString(),
      invoiceNumber: invoiceNumber,
      salesDistLines: payload.salesDistributions?.length || 0,
      queued: true,
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
