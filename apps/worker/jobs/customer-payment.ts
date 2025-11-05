import { Worker, Job } from 'bullmq'
import type { Redis } from 'ioredis'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@repo/shared'

/**
 * Customer Payment Worker
 *
 * This worker processes jobs from the customer-payment queue.
 * It parses CSV data from NetSuite and prepares it for PACE.
 */

export interface CustomerPaymentJobData {
  customerPaymentIntegrationId: string
  attempt: number
}

interface CustomerPaymentRow {
  glAccount: string // GL Account (e.g., "2")
  autoApply: string // Auto Apply (e.g., "false")
  depositType: string // Deposit Type (e.g., "3")
  paymentId: string // Payment ID from NetSuite
  paymentDate: string // Payment Date (MM/DD/YYYY)
  customerExternalId: string // Customer External ID
  invoiceNumber: string // Invoice Number
  invoiceId: string // Invoice ID (receivable) from custbody1
  paymentApplied: string // Payment Applied amount
}

export function customerPaymentWorker(connection: Redis) {
  const worker = new Worker<CustomerPaymentJobData>(
    'customer-payment',
    async (job: Job<CustomerPaymentJobData>) => {
      const { customerPaymentIntegrationId, attempt } = job.data

      console.log(`🔄 [Job ${job.id}] Processing customer payment ${customerPaymentIntegrationId} (attempt ${attempt})`)

      try {
        // Get the customer payment integration record
        const customerPaymentIntegration = await db.customerPaymentIntegration.findUnique({
          where: { id: customerPaymentIntegrationId },
        })

        if (!customerPaymentIntegration) {
          throw new Error(`Customer payment integration record not found: ${customerPaymentIntegrationId}`)
        }

        // Check if already completed
        if (customerPaymentIntegration.status === 'completed') {
          console.log(`✅ [Job ${job.id}] Customer payment ${customerPaymentIntegrationId} already completed, skipping`)
          return {
            success: true,
            message: 'Customer payment already completed',
            customerPaymentIntegrationId,
          }
        }

        // Update status to processing
        await db.customerPaymentIntegration.update({
          where: { id: customerPaymentIntegrationId },
          data: {
            status: 'processing',
            lastAttemptAt: new Date(),
          },
        })

        console.log(`📤 [Job ${job.id}] Processing customer payment from ${customerPaymentIntegration.processDate}...`)

        // Parse CSV data
        const csvData = customerPaymentIntegration.csvData
        const rows = parseCSV(csvData)

        console.log(`📊 [Job ${job.id}] Parsed ${rows.length} customer payment rows`)

        // Store parsed data
        await db.customerPaymentIntegration.update({
          where: { id: customerPaymentIntegrationId },
          data: {
            processedData: rows as any,
          },
        })

        // Send to PACE
        const result = await sendToPace(customerPaymentIntegration, rows)

        if (result.success) {
          // Update as completed
          await db.customerPaymentIntegration.update({
            where: { id: customerPaymentIntegrationId },
            data: {
              status: 'completed',
              paceResponse: result.response as any,
              errorMessage: null,
              sentToPaceAt: new Date(),
            },
          })

          console.log(`✅ [Job ${job.id}] Customer payment ${customerPaymentIntegrationId} sent successfully to PACE!`)

          return {
            success: true,
            message: 'Customer payment sent to PACE successfully',
            customerPaymentIntegrationId,
            recordCount: rows.length,
          }
        } else {
          // Update as failed
          const errorMessage = typeof result.error === 'string'
            ? result.error
            : JSON.stringify(result.error)

          await db.customerPaymentIntegration.update({
            where: { id: customerPaymentIntegrationId },
            data: {
              status: 'failed',
              errorMessage,
              paceResponse: result.response as any,
              retryCount: customerPaymentIntegration.retryCount + 1,
            },
          })

          throw new Error(errorMessage || 'Failed to send customer payment to PACE')
        }
      } catch (error) {
        console.error(`❌ [Job ${job.id}] Error processing customer payment ${customerPaymentIntegrationId}:`, error)

        // Update retry count
        await db.customerPaymentIntegration.update({
          where: { id: customerPaymentIntegrationId },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : String(error),
            retryCount: { increment: 1 },
          },
        })

        throw error // Re-throw to trigger BullMQ retry
      }
    },
    {
      connection,
      concurrency: 1, // Process one customer payment batch at a time
      limiter: {
        max: 10, // Max 10 jobs
        duration: 60000, // Per 60 seconds (rate limiting)
      },
    }
  )

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`✅ Customer Payment Job ${job.id} completed successfully`)
  })

  worker.on('failed', (job, err) => {
    console.error(`❌ Customer Payment Job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('❌ Customer Payment Worker error:', err)
  })

  console.log('🚀 Customer Payment Worker started')
  console.log('⏳ Waiting for customer payment jobs...')

  return worker
}

/**
 * Parse CSV data into structured rows
 */
function parseCSV(csvContent: string): CustomerPaymentRow[] {
  const lines = csvContent.split('\n').filter(line => line.trim() !== '')

  if (lines.length < 2) {
    throw new Error('CSV data must contain at least a header row and one data row')
  }

  // Skip header row (first line)
  const dataLines = lines.slice(1)

  const rows: CustomerPaymentRow[] = []

  for (const line of dataLines) {
    // Parse CSV line with proper handling of quoted values
    const values = parseCSVLine(line)

    if (values.length < 9) {
      console.warn(`Skipping invalid CSV row with ${values.length} columns (expected 9)`)
      continue
    }

    rows.push({
      glAccount: values[0] || '',
      autoApply: values[1] || '',
      depositType: values[2] || '',
      paymentId: values[3] || '',
      paymentDate: values[4] || '',
      customerExternalId: values[5] || '',
      invoiceNumber: values[6] || '',
      invoiceId: values[7] || '',
      paymentApplied: values[8] || '',
    })
  }

  return rows
}

/**
 * Parse a single CSV line, handling quoted values with commas
 * Also handles Excel formula format like ="00001456"
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let currentValue = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      // Clean up Excel formula format: ="value" -> value
      let cleanValue = currentValue.trim()
      if (cleanValue.startsWith('="') && cleanValue.endsWith('"')) {
        cleanValue = cleanValue.substring(2, cleanValue.length - 1)
      }
      values.push(cleanValue)
      currentValue = ''
    } else {
      currentValue += char
    }
  }

  // Add the last value
  let cleanValue = currentValue.trim()
  if (cleanValue.startsWith('="') && cleanValue.endsWith('"')) {
    cleanValue = cleanValue.substring(2, cleanValue.length - 1)
  }
  values.push(cleanValue)

  return values
}

/**
 * Group customer payment rows by payment ID
 * Each payment may have multiple applied invoices
 */
function groupByPayment(rows: CustomerPaymentRow[]): Map<string, CustomerPaymentRow[]> {
  const groups = new Map<string, CustomerPaymentRow[]>()

  for (const row of rows) {
    const key = row.paymentId
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(row)
  }

  return groups
}


/**
 * Send customer payment data to PACE API
 *
 * NOTE: PACE API endpoints for customer payments need to be configured.
 * For now, this function stores the parsed data and marks as completed.
 * TODO: Implement PACE API integration once endpoints are available.
 */
async function sendToPace(_customerPaymentIntegration: any, rows: CustomerPaymentRow[]) {
  try {
    // Get PACE credentials (for future use)
    const _credentials = await getPaceApiCredentials()

    console.log(`[PACE] 🚀 Processing ${rows.length} customer payment rows...`)

    // Group rows by payment ID
    const paymentGroups = groupByPayment(rows)
    console.log(`[PACE] 📊 Grouped into ${paymentGroups.size} payments`)

    // TODO: Implement PACE API calls for customer payments
    // For now, we'll just log and return success to store the parsed data
    console.log(`[PACE] ℹ️  Customer Payment PACE integration pending - data parsed and stored`)

    const results: Array<{
      paymentId: string
      appliedInvoices: number
      success: boolean
      error?: string
    }> = []

    // Process each payment group
    for (const [paymentId, paymentRows] of paymentGroups) {
      const firstRow = paymentRows[0]

      console.log(`\n[PACE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`[PACE] 💳 Payment ID: ${paymentId}`)
      console.log(`[PACE] 📅 Payment Date: ${firstRow.paymentDate}`)
      console.log(`[PACE] 👤 Customer: ${firstRow.customerExternalId}`)
      console.log(`[PACE] 📋 Applied to ${paymentRows.length} invoice(s)`)

      // Log each applied invoice
      paymentRows.forEach((row, idx) => {
        console.log(`[PACE]    ${idx + 1}. Invoice ${row.invoiceNumber} (ID: ${row.invoiceId}): $${row.paymentApplied}`)
      })

      // TODO: Call PACE API to create payment records
      // For now, mark as successful
      results.push({
        paymentId,
        appliedInvoices: paymentRows.length,
        success: true,
      })
    }

    console.log(`\n[PACE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`[PACE] ✅ Processing complete!`)
    console.log(`[PACE] 📊 Summary:`)
    console.log(`[PACE]    - Total Payments: ${results.length}`)
    console.log(`[PACE]    - Total Applied Invoices: ${rows.length}`)
    console.log(`[PACE]    - Status: Data parsed and stored (PACE integration pending)`)

    return {
      success: true,
      response: {
        message: 'Customer payment data parsed and stored successfully. PACE integration pending.',
        totalPayments: results.length,
        totalAppliedInvoices: rows.length,
        details: results,
        note: 'PACE API integration for customer payments to be implemented',
      },
    }
  } catch (error) {
    console.error('[PACE] ❌ Error processing customer payments:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      response: null,
    }
  }
}
