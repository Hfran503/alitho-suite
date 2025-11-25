import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/database'
import { Prisma } from '@prisma/client'
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
  invoiceId?: string // Job-specific ID from PACE - used to distinguish different jobs with same invoice number
  jobNum?: string // Job number for reference
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
    // PACE sometimes sends malformed JSON with unescaped control characters (tabs, etc.)
    // We need to sanitize the raw text before parsing
    const rawBody = await request.text()

    // Sanitize control characters INSIDE string values only
    // PACE sometimes sends unescaped tabs, etc. inside string fields
    // We can't blindly replace all control chars because newlines/tabs are valid JSON whitespace
    // Solution: Only sanitize control chars that appear inside quoted strings
    const sanitizedBody = rawBody.replace(/"([^"\\]|\\.)*"/g, (match) => {
      // Inside each string, replace problematic control characters
      return match.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ') // Replace most control chars with space
                  .replace(/\t/g, ' ') // Replace tabs with spaces
                  .replace(/\r/g, '')  // Remove carriage returns
    })

    let payload: PACEInvoiceWebhookPayload
    try {
      payload = JSON.parse(sanitizedBody)
    } catch (parseError) {
      console.error('Failed to parse PACE invoice JSON:', parseError)
      console.error('Raw body (first 500 chars):', rawBody.substring(0, 500))
      return NextResponse.json(
        { status: 'error', error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Trim whitespace from string fields that PACE sometimes pads
    if (payload.invoice?.poNumber) {
      payload.invoice.poNumber = payload.invoice.poNumber.trim()
    }

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
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
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

        // Accumulate sales distributions (combine arrays, remove duplicates)
        // Use composite key (invoiceId-lineItemId) to handle cases where PACE reuses line item IDs across jobs
        const existingSalesDistributions = existingPayload.salesDistributions || []
        const newSalesDistributions = payload.salesDistributions || []

        const salesDistMap = new Map()
        existingSalesDistributions.forEach(dist => {
          // Use composite key: (invoiceId OR jobNum) + line item ID to distinguish items from different jobs
          // invoiceId = unique per job, jobNum = also unique per job
          const jobKey = existingPayload.invoice.invoiceId || existingPayload.invoice.jobNum || existingPayload.invoice.id
          const key = `${jobKey}-${dist.id}`
          salesDistMap.set(key, dist)
        })
        newSalesDistributions.forEach(dist => {
          const jobKey = payload.invoice.invoiceId || payload.invoice.jobNum || payload.invoice.id
          const key = `${jobKey}-${dist.id}`
          salesDistMap.set(key, dist)
        })
        const combinedSalesDistributions = Array.from(salesDistMap.values())

        // Accumulate invoice extras (combine arrays, remove duplicates)
        // Use composite key (invoiceId-extraId) to handle cases where PACE reuses extra IDs across jobs
        const existingInvoiceExtras = existingPayload.invoiceExtras || []
        const newInvoiceExtras = payload.invoiceExtras || []

        const extrasMap = new Map()
        existingInvoiceExtras.forEach(extra => {
          const jobKey = existingPayload.invoice.invoiceId || existingPayload.invoice.jobNum || existingPayload.invoice.id
          const key = `${jobKey}-${extra.id}`
          extrasMap.set(key, extra)
        })
        newInvoiceExtras.forEach(extra => {
          const jobKey = payload.invoice.invoiceId || payload.invoice.jobNum || payload.invoice.id
          const key = `${jobKey}-${extra.id}`
          extrasMap.set(key, extra)
        })
        const combinedInvoiceExtras = Array.from(extrasMap.values())

        // Calculate combined totals
        const combinedInvoiceAmount = combinedSalesDistributions.reduce((sum, dist) => sum + dist.amount, 0)
        const combinedExtrasAmount = combinedInvoiceExtras.reduce((sum, extra) => sum + extra.price, 0)

        // Accumulate tax amounts (don't overwrite!)
        const existingTaxAmount = existingPayload.invoice.taxAmount || 0
        const newTaxAmount = payload.invoice.taxAmount || 0
        const combinedTaxAmount = existingTaxAmount + newTaxAmount

        const totalAmount = combinedInvoiceAmount + combinedExtrasAmount + combinedTaxAmount

        // Create combined payload
        const combinedPayload: PACEInvoiceWebhookPayload = {
          invoice: {
            ...payload.invoice,
            invoiceAmount: totalAmount,
            taxAmount: combinedTaxAmount,
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
          previousTax: existingTaxAmount.toFixed(2),
          newTax: newTaxAmount.toFixed(2),
          combinedTax: combinedTaxAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          status: updated.status,
        })

        return { type: 'accumulated' as const, invoice: updated, combinedSalesDistributions, combinedInvoiceExtras, totalAmount }
      }

      // No existing invoice found, return null to signal creation needed
      return { type: 'create' as const }
    }, {
      // Use default isolation level (ReadCommitted) - FOR UPDATE provides the locking we need
      // Serializable is too strict and causes serialization failures with concurrent requests
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

        const retryResult = await db.$transaction(async (tx: Prisma.TransactionClient) => {
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

          // Perform accumulation using composite keys
          const existingSalesDist = existingPayload.salesDistributions || []
          const newSalesDist = payload.salesDistributions || []
          const salesDistMap = new Map()
          existingSalesDist.forEach(dist => {
            const key = `${existingPayload.invoice.invoiceId || existingPayload.invoice.id}-${dist.id}`
            salesDistMap.set(key, dist)
          })
          newSalesDist.forEach(dist => {
            const key = `${payload.invoice.invoiceId || payload.invoice.id}-${dist.id}`
            salesDistMap.set(key, dist)
          })
          const combinedSalesDist = Array.from(salesDistMap.values())

          const existingExtras = existingPayload.invoiceExtras || []
          const newExtras = payload.invoiceExtras || []
          const extrasMap = new Map()
          existingExtras.forEach(extra => {
            const key = `${existingPayload.invoice.invoiceId || existingPayload.invoice.id}-${extra.id}`
            extrasMap.set(key, extra)
          })
          newExtras.forEach(extra => {
            const key = `${payload.invoice.invoiceId || payload.invoice.id}-${extra.id}`
            extrasMap.set(key, extra)
          })
          const combinedExtras = Array.from(extrasMap.values())

          // Accumulate tax amounts
          const existingTax = existingPayload.invoice.taxAmount || 0
          const newTax = payload.invoice.taxAmount || 0
          const combinedTax = existingTax + newTax

          const combinedAmount = combinedSalesDist.reduce((sum, dist) => sum + dist.amount, 0) +
                                 combinedExtras.reduce((sum, extra) => sum + extra.price, 0) +
                                 combinedTax

          const combinedPayload: PACEInvoiceWebhookPayload = {
            invoice: {
              ...payload.invoice,
              invoiceAmount: combinedAmount,
              taxAmount: combinedTax,
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
          // Use default isolation level (ReadCommitted) - FOR UPDATE provides the locking we need
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
