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
 * Convert date string to ISO format (YYYY-MM-DD)
 * Handles formats like MM/DD/YYYY or YYYY-MM-DD
 * IMPORTANT: Uses string parsing to avoid timezone issues
 */
function convertToISODate(dateStr: string): string {
  if (!dateStr) return ''

  // Clean up the string - remove any whitespace and quotes
  const cleanStr = dateStr.trim().replace(/^["']|["']$/g, '')

  console.log(`[PACE] 📅 Converting date: "${dateStr}" → cleaned: "${cleanStr}"`)

  // If already in ISO format (YYYY-MM-DD), return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
    console.log(`[PACE] 📅 Already ISO format: ${cleanStr}`)
    return cleanStr
  }

  // Try to parse MM/DD/YYYY format (US format from NetSuite)
  const mmddyyyyMatch = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mmddyyyyMatch) {
    const [, month, day, year] = mmddyyyyMatch
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    console.log(`[PACE] 📅 Parsed MM/DD/YYYY → ${isoDate}`)
    return isoDate
  }

  // Try to parse M/D/YYYY format (without leading zeros)
  const mdyyyyMatch = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (mdyyyyMatch) {
    const [, month, day, yearPart] = mdyyyyMatch
    const year = yearPart.length === 2 ? `20${yearPart}` : yearPart
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    console.log(`[PACE] 📅 Parsed M/D/YYYY → ${isoDate}`)
    return isoDate
  }

  // AVOID using new Date() for parsing as it causes timezone issues
  // Instead, log a warning and return the cleaned string
  console.warn(`[PACE] ⚠️  Could not parse date format: "${cleanStr}" - returning as-is`)
  return cleanStr
}

/**
 * Create a PaymentBatch object in PACE
 */
async function createPacePaymentBatch(
  credentials: { url: string; username: string; password: string },
  batchName: string
): Promise<{ success: boolean; paymentBatchId?: string; error?: string }> {
  try {
    const authHeader = 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')

    const payload: any = {
      name: batchName,
    }

    console.log(`[PACE] 📦 Creating PaymentBatch: ${batchName}`)
    console.log(`[PACE] 📦 PaymentBatch payload:`, JSON.stringify(payload, null, 2))

    const response = await fetch(`${credentials.url}/CreateObject/createPaymentBatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(payload),
    })

    console.log(`[PACE] 📨 PaymentBatch response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[PACE] ❌ PaymentBatch creation error (${response.status}):`, errorText)
      return {
        success: false,
        error: `PACE PaymentBatch error: ${response.status} - ${errorText}`,
      }
    }

    const result = await response.json() as any
    console.log(`[PACE] 📨 PaymentBatch response:`, JSON.stringify(result, null, 2))

    const paymentBatchId = result.id || result.ID
    console.log(`[PACE] ✅ Successfully created PaymentBatch - ID: ${paymentBatchId}`)

    return {
      success: true,
      paymentBatchId: paymentBatchId?.toString(),
    }
  } catch (error) {
    console.error('[PACE] ❌ Exception creating PaymentBatch:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating PaymentBatch',
    }
  }
}

/**
 * Create a Payment object in PACE
 */
async function createPacePayment(
  credentials: { url: string; username: string; password: string },
  paymentData: {
    paymentBatch: string
    paymentDate: string
    customer: string
    amount: number
    autoApply: string
    depositType: string
    payment: string // Company tree (static "[Entire Tree]")
  }
): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  try {
    const authHeader = 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')

    const payload: any = {
      paymentBatch: paymentData.paymentBatch,
      customer: paymentData.customer,
      amount: paymentData.amount,
      payment: paymentData.payment,
    }

    // Add date if provided (PACE expects ISO date format: YYYY-MM-DD)
    if (paymentData.paymentDate) {
      payload.paymentDate = convertToISODate(paymentData.paymentDate)
    }

    // Add autoApply (convert to boolean)
    if (paymentData.autoApply) {
      payload.autoApply = paymentData.autoApply === 'true' || paymentData.autoApply === '1'
    }

    // Add depositType
    if (paymentData.depositType) {
      payload.depositType = paymentData.depositType
    }

    console.log(`[PACE] 💳 Creating Payment: Customer ${paymentData.customer}, Amount $${paymentData.amount}`)
    console.log(`[PACE] 📦 Payment payload:`, JSON.stringify(payload, null, 2))

    const response = await fetch(`${credentials.url}/CreateObject/createPayment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(payload),
    })

    console.log(`[PACE] 📨 Payment response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[PACE] ❌ Payment creation error (${response.status}):`, errorText)
      return {
        success: false,
        error: `PACE Payment error: ${response.status} - ${errorText}`,
      }
    }

    const result = await response.json() as any
    console.log(`[PACE] 📨 Payment response:`, JSON.stringify(result, null, 2))

    const paymentId = result.id || result.ID
    console.log(`[PACE] ✅ Successfully created Payment - ID: ${paymentId}`)

    return {
      success: true,
      paymentId: paymentId?.toString(),
    }
  } catch (error) {
    console.error('[PACE] ❌ Exception creating Payment:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating Payment',
    }
  }
}

/**
 * Create a PaymentLine object in PACE
 */
async function createPacePaymentLine(
  credentials: { url: string; username: string; password: string },
  paymentId: string,
  lineData: {
    amount: string
    receivable: string // Invoice ID
    glAccount: string
  }
): Promise<{ success: boolean; paymentLineId?: string; error?: string }> {
  try {
    const authHeader = 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')

    const payload: any = {
      payment: paymentId,
      receivable: lineData.receivable,
      glAccount: lineData.glAccount,
    }

    // Add amount if provided
    if (lineData.amount) {
      payload.amount = parseFloat(lineData.amount)
    }

    console.log(`[PACE] 📋 Creating PaymentLine for Payment ${paymentId}`)
    console.log(`[PACE] 📦 PaymentLine payload:`, JSON.stringify(payload, null, 2))

    const response = await fetch(`${credentials.url}/CreateObject/createPaymentLine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(payload),
    })

    console.log(`[PACE] 📨 PaymentLine response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[PACE] ❌ PaymentLine creation error (${response.status}):`, errorText)
      return {
        success: false,
        error: `PACE PaymentLine error: ${response.status} - ${errorText}`,
      }
    }

    const result = await response.json() as any
    const paymentLineId = result.id || result.ID
    console.log(`[PACE] ✅ Successfully created PaymentLine - ID: ${paymentLineId}`)

    return {
      success: true,
      paymentLineId: paymentLineId?.toString(),
    }
  } catch (error) {
    console.error('[PACE] ❌ Exception creating PaymentLine:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating PaymentLine',
    }
  }
}

/**
 * Send customer payment data to PACE API
 *
 * Creates PaymentBatch, Payment, and PaymentLine objects in PACE
 */
async function sendToPace(customerPaymentIntegration: any, rows: CustomerPaymentRow[]) {
  try {
    // Get PACE credentials
    const credentials = await getPaceApiCredentials()

    console.log(`[PACE] 🚀 Sending ${rows.length} customer payment rows to PACE...`)

    // Step 1: Create PaymentBatch for this import batch
    const batchName = `NetSuite Customer Payments - ${customerPaymentIntegration.processDate} - ${customerPaymentIntegration.filename}`
    console.log(`[PACE] 📦 Creating PaymentBatch: ${batchName}`)

    const paymentBatchResult = await createPacePaymentBatch(credentials, batchName)

    if (!paymentBatchResult.success || !paymentBatchResult.paymentBatchId) {
      const error = `Failed to create PaymentBatch: ${paymentBatchResult.error}`
      console.error(`[PACE] ❌ ${error}`)
      return {
        success: false,
        error,
        response: null,
      }
    }

    const paymentBatchId = paymentBatchResult.paymentBatchId
    console.log(`[PACE] ✅ PaymentBatch created with ID: ${paymentBatchId}`)

    // Step 2: Group rows by payment ID (each payment = 1 Payment with multiple PaymentLines)
    const paymentGroups = groupByPayment(rows)
    console.log(`[PACE] 📊 Grouped into ${paymentGroups.size} payments`)

    const results: Array<{
      paymentId: string
      pacePaymentId?: string
      paymentLineIds: string[]
      success: boolean
      error?: string
    }> = []

    // Step 3: Process each payment
    for (const [netsuitePaymentId, paymentRows] of paymentGroups) {
      const firstRow = paymentRows[0]

      console.log(`\n[PACE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`[PACE] 💳 Processing Payment: ${netsuitePaymentId}`)
      console.log(`[PACE] 👤 Customer: ${firstRow.customerExternalId}`)
      console.log(`[PACE] 📋 Payment Lines: ${paymentRows.length}`)

      // Calculate total payment amount (sum of all applied amounts)
      const totalAmount = paymentRows.reduce((sum, row) => sum + parseFloat(row.paymentApplied || '0'), 0)

      // Create Payment object with the PaymentBatch ID
      const paymentResult = await createPacePayment(credentials, {
        paymentBatch: paymentBatchId, // Use the PaymentBatch ID we created
        paymentDate: firstRow.paymentDate,
        customer: firstRow.customerExternalId,
        amount: totalAmount,
        autoApply: firstRow.autoApply,
        depositType: firstRow.depositType,
        payment: '[Entire Tree]', // Company tree reference
      })

      if (!paymentResult.success || !paymentResult.paymentId) {
        console.error(`[PACE] ❌ Failed to create Payment for ${netsuitePaymentId}: ${paymentResult.error}`)
        results.push({
          paymentId: netsuitePaymentId,
          paymentLineIds: [],
          success: false,
          error: paymentResult.error,
        })
        continue
      }

      const pacePaymentId = paymentResult.paymentId
      console.log(`[PACE] ✅ Payment created with ID: ${pacePaymentId}`)

      // Create PaymentLine objects for each invoice application
      const paymentLineIds: string[] = []
      let lineNumber = 0
      let lineErrors: string[] = []

      for (const row of paymentRows) {
        lineNumber++
        console.log(`[PACE] 📋 Creating PaymentLine ${lineNumber}/${paymentRows.length}...`)
        console.log(`[PACE]    Invoice: ${row.invoiceNumber}, Amount: $${row.paymentApplied}`)

        const lineResult = await createPacePaymentLine(credentials, pacePaymentId, {
          amount: row.paymentApplied,
          receivable: row.invoiceId, // Invoice ID from custbody1
          glAccount: row.glAccount,
        })

        if (lineResult.success && lineResult.paymentLineId) {
          paymentLineIds.push(lineResult.paymentLineId)
          console.log(`[PACE]    ✅ PaymentLine ${lineNumber} created: ${lineResult.paymentLineId}`)
        } else {
          console.error(`[PACE]    ❌ PaymentLine ${lineNumber} failed: ${lineResult.error}`)
          lineErrors.push(`Line ${lineNumber}: ${lineResult.error}`)
        }
      }

      console.log(`[PACE] ✅ Created ${paymentLineIds.length}/${paymentRows.length} PaymentLines for payment ${netsuitePaymentId}`)

      results.push({
        paymentId: netsuitePaymentId,
        pacePaymentId,
        paymentLineIds,
        success: lineErrors.length === 0,
        error: lineErrors.length > 0 ? lineErrors.join('; ') : undefined,
      })
    }

    console.log(`\n[PACE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`[PACE] ✅ Processing complete!`)
    console.log(`[PACE] 📊 Summary:`)
    console.log(`[PACE]    - Total Payments: ${results.length}`)
    console.log(`[PACE]    - Successful: ${results.filter(r => r.success).length}`)
    console.log(`[PACE]    - Failed: ${results.filter(r => !r.success).length}`)

    // Check if all payments were processed successfully
    const allSuccess = results.every(r => r.success)

    return {
      success: allSuccess,
      response: {
        message: allSuccess
          ? 'All customer payments sent to PACE successfully'
          : 'Some customer payments failed to process',
        paymentBatchId,
        totalPayments: results.length,
        successfulPayments: results.filter(r => r.success).length,
        failedPayments: results.filter(r => !r.success).length,
        details: results,
      },
      error: allSuccess ? undefined : results.filter(r => !r.success).map(r => r.error).join('; '),
    }
  } catch (error) {
    console.error('[PACE] ❌ Error sending customer payments to PACE:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      response: null,
    }
  }
}
