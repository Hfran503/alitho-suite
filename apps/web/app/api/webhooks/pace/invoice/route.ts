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

    // Use a transaction with row-level locking to prevent race conditions
    // when multiple webhooks arrive simultaneously for the same invoice
    const result = await db.$transaction(async (tx) => {
      // Lock the row with SELECT ... FOR UPDATE to prevent concurrent modifications
      const existingInvoice = await tx.$queryRaw<Array<{ id: string, invoiceNumber: string, payload: any }>>`
        SELECT id, "invoiceNumber", payload
        FROM "InvoiceIntegration"
        WHERE "invoiceNumber" = ${invoiceNumber}
        FOR UPDATE
      `

      if (existingInvoice.length > 0) {
        const locked = existingInvoice[0]
        console.log(`📋 Invoice ${invoiceNumber} already exists (locked), accumulating line items...`)

        // Parse existing payload
        const existingPayload = locked.payload as unknown as PACEInvoiceWebhookPayload

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
        const updated = await tx.invoiceIntegration.update({
          where: {
            id: locked.id,
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

        return { type: 'accumulated' as const, invoice: updated, combinedSalesDistributions, combinedInvoiceExtras, totalAmount }
      }

      // No existing invoice found, return null to signal creation needed
      return { type: 'create' as const }
    }, {
      isolationLevel: 'Serializable', // Highest isolation level to prevent any concurrent conflicts
      maxWait: 5000, // Wait up to 5 seconds for lock
      timeout: 10000, // Transaction timeout
    })

    if (result.type === 'accumulated') {
      // Queue the invoice for automatic processing with a delay
      // This allows multiple parts to accumulate before sending to NetSuite
      // If already queued, the jobId will be replaced with the new delayed job
      const ACCUMULATION_DELAY_MS = 10000 // 10 seconds delay to allow parts to accumulate
      try {
        await queueNetsuiteInvoice(result.invoice.id, result.invoice.invoiceNumber, ACCUMULATION_DELAY_MS)
        console.log(`🔄 Queued accumulated invoice ${invoiceNumber} for NetSuite processing (${ACCUMULATION_DELAY_MS}ms delay)`)
      } catch (queueError) {
        console.error('Failed to queue invoice:', queueError)
        // Don't fail the webhook, just log the error
      }

      return NextResponse.json({
        status: 'success',
        message: `Invoice ${invoiceNumber} accumulated and queued for NetSuite`,
        invoiceNumber: result.invoice.invoiceNumber,
        salesDistLines: result.combinedSalesDistributions.length,
        invoiceExtras: result.combinedInvoiceExtras.length,
        totalAmount: result.totalAmount.toFixed(2),
        accumulated: true,
        queued: true,
      })
    }

    // Create new invoice integration record
    // This code is only reached if the transaction above determined no existing invoice exists
    let invoiceIntegration
    try {
      invoiceIntegration = await db.invoiceIntegration.create({
        data: {
          tenantId: tenant.id,
          invoiceNumber: invoiceNumber,
          status: 'pending',
          payload: payload as any,
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
    } catch (createError: any) {
      // Race condition: another request created it between the transaction check and now
      // Use the same transaction-based accumulation logic
      if (createError.code === 'P2002') {
        console.log(`⚠️  Race condition detected for invoice ${invoiceNumber}, re-trying with transaction...`)

        const retryResult = await db.$transaction(async (tx) => {
          // Lock the row that was just created by another request
          const existingInvoice = await tx.$queryRaw<Array<{ id: string, invoiceNumber: string, payload: any }>>`
            SELECT id, "invoiceNumber", payload
            FROM "InvoiceIntegration"
            WHERE "invoiceNumber" = ${invoiceNumber}
            FOR UPDATE
          `

          if (existingInvoice.length === 0) {
            throw new Error('Invoice disappeared after race condition')
          }

          const locked = existingInvoice[0]
          const existingPayload = locked.payload as unknown as PACEInvoiceWebhookPayload

          // Perform accumulation
          const existingSalesDist = existingPayload.salesDistributions || []
          const newSalesDist = payload.salesDistributions || []
          const salesDistMap = new Map()
          existingSalesDist.forEach(dist => salesDistMap.set(dist.id, dist))
          newSalesDist.forEach(dist => salesDistMap.set(dist.id, dist))
          const combinedSalesDist = Array.from(salesDistMap.values())

          const existingExtras = existingPayload.invoiceExtras || []
          const newExtras = payload.invoiceExtras || []
          const extrasMap = new Map()
          existingExtras.forEach(extra => extrasMap.set(extra.id, extra))
          newExtras.forEach(extra => extrasMap.set(extra.id, extra))
          const combinedExtras = Array.from(extrasMap.values())

          const combinedAmount = combinedSalesDist.reduce((sum, dist) => sum + dist.amount, 0) +
                                 combinedExtras.reduce((sum, extra) => sum + extra.price, 0)

          const combinedPayload: PACEInvoiceWebhookPayload = {
            invoice: {
              ...payload.invoice,
              invoiceAmount: combinedAmount,
              taxAmount: payload.invoice.taxAmount,
            },
            salesDistributions: combinedSalesDist,
            invoiceExtras: combinedExtras,
            metadata: {
              ...payload.metadata,
              totalSalesDistLines: combinedSalesDist.length,
              totalInvoiceExtras: combinedExtras.length,
              exportedAt: new Date().toISOString(),
              paceInvoiceIds: [
                ...(existingPayload.metadata?.paceInvoiceIds || [existingPayload.invoice.id]),
                payload.invoice.id
              ].filter((id, index, self) => self.indexOf(id) === index),
            },
          }

          return await tx.invoiceIntegration.update({
            where: { id: locked.id },
            data: {
              payload: combinedPayload as any,
              status: 'pending',
              retryCount: 0,
              updatedAt: new Date(),
            },
          })
        }, {
          isolationLevel: 'Serializable',
          maxWait: 5000,
          timeout: 10000,
        })

        invoiceIntegration = retryResult

        console.log('✅ Accumulated after race condition:', {
          invoiceNumber: retryResult.invoiceNumber,
          totalSalesDist: (retryResult.payload as any).salesDistributions?.length || 0,
          totalExtras: (retryResult.payload as any).invoiceExtras?.length || 0,
        })
      } else {
        // Different error, re-throw
        throw createError
      }
    }

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
