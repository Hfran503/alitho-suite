import { Worker, Job } from 'bullmq'
import type { Redis } from 'ioredis'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@repo/shared'

/**
 * Vendor Bill Worker
 *
 * This worker processes jobs from the vendor-bill queue.
 * It parses CSV data from NetSuite and sends vendor bills to PACE.
 */

export interface VendorBillJobData {
  vendorBillIntegrationId: string
  attempt: number
}

interface VendorBillRow {
  action: string
  billBatch: string
  billType: string
  dateDue: string
  vendor: string
  invoiceDate: string
  invoiceNumber: string
  voucherDate: string
  bill: string
  discountApplicable: string
  glAccount: string
  poQuantity: string
  poUnitPrice: string
  poUom: string
  purchaseOrderReceipt: string
  invoiceAmount: string
}

export function vendorBillWorker(connection: Redis) {
  const worker = new Worker<VendorBillJobData>(
    'vendor-bill',
    async (job: Job<VendorBillJobData>) => {
      const { vendorBillIntegrationId, attempt } = job.data

      console.log(`🔄 [Job ${job.id}] Processing vendor bill ${vendorBillIntegrationId} (attempt ${attempt})`)

      try {
        // Get the vendor bill integration record
        const vendorBillIntegration = await db.vendorBillIntegration.findUnique({
          where: { id: vendorBillIntegrationId },
        })

        if (!vendorBillIntegration) {
          throw new Error(`Vendor bill integration record not found: ${vendorBillIntegrationId}`)
        }

        // Check if already completed
        if (vendorBillIntegration.status === 'completed') {
          console.log(`✅ [Job ${job.id}] Vendor bill ${vendorBillIntegrationId} already completed, skipping`)
          return {
            success: true,
            message: 'Vendor bill already completed',
            vendorBillIntegrationId,
          }
        }

        // Update status to processing
        await db.vendorBillIntegration.update({
          where: { id: vendorBillIntegrationId },
          data: {
            status: 'processing',
            lastAttemptAt: new Date(),
          },
        })

        console.log(`📤 [Job ${job.id}] Processing vendor bill from ${vendorBillIntegration.processDate}...`)

        // Parse CSV data
        const csvData = vendorBillIntegration.csvData
        const rows = parseCSV(csvData)

        console.log(`📊 [Job ${job.id}] Parsed ${rows.length} vendor bill rows`)

        // Store parsed data
        await db.vendorBillIntegration.update({
          where: { id: vendorBillIntegrationId },
          data: {
            processedData: rows as any,
          },
        })

        // Send to PACE
        const result = await sendToPace(vendorBillIntegration, rows)

        if (result.success) {
          // Update as completed
          await db.vendorBillIntegration.update({
            where: { id: vendorBillIntegrationId },
            data: {
              status: 'completed',
              paceResponse: result.response as any,
              errorMessage: null,
              sentToPaceAt: new Date(),
            },
          })

          console.log(`✅ [Job ${job.id}] Vendor bill ${vendorBillIntegrationId} sent successfully to PACE!`)

          return {
            success: true,
            message: 'Vendor bill sent to PACE successfully',
            vendorBillIntegrationId,
            recordCount: rows.length,
          }
        } else {
          // Update as failed
          const errorMessage = typeof result.error === 'string'
            ? result.error
            : JSON.stringify(result.error)

          await db.vendorBillIntegration.update({
            where: { id: vendorBillIntegrationId },
            data: {
              status: 'failed',
              errorMessage,
              paceResponse: result.response as any,
              retryCount: vendorBillIntegration.retryCount + 1,
            },
          })

          throw new Error(errorMessage || 'Failed to send vendor bill to PACE')
        }
      } catch (error) {
        console.error(`❌ [Job ${job.id}] Error processing vendor bill ${vendorBillIntegrationId}:`, error)

        // Update retry count
        await db.vendorBillIntegration.update({
          where: { id: vendorBillIntegrationId },
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
      concurrency: 1, // Process one vendor bill batch at a time
      limiter: {
        max: 10, // Max 10 jobs
        duration: 60000, // Per 60 seconds (rate limiting)
      },
    }
  )

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`✅ Vendor Bill Job ${job.id} completed successfully`)
  })

  worker.on('failed', (job, err) => {
    console.error(`❌ Vendor Bill Job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('❌ Vendor Bill Worker error:', err)
  })

  console.log('🚀 Vendor Bill Worker started')
  console.log('⏳ Waiting for vendor bill jobs...')

  return worker
}

/**
 * Parse CSV data into structured rows
 */
function parseCSV(csvContent: string): VendorBillRow[] {
  const lines = csvContent.split('\n').filter(line => line.trim() !== '')

  if (lines.length < 2) {
    throw new Error('CSV data must contain at least a header row and one data row')
  }

  // Skip header row (first line)
  const dataLines = lines.slice(1)

  const rows: VendorBillRow[] = []

  for (const line of dataLines) {
    // Parse CSV line with proper handling of quoted values
    const values = parseCSVLine(line)

    if (values.length < 16) {
      console.warn(`Skipping invalid CSV row with ${values.length} columns (expected 16)`)
      continue
    }

    rows.push({
      action: values[0] || '',
      billBatch: values[1] || '',
      billType: values[2] || '',
      dateDue: values[3] || '',
      vendor: values[4] || '',
      invoiceDate: values[5] || '',
      invoiceNumber: values[6] || '',
      voucherDate: values[7] || '',
      bill: values[8] || '',
      discountApplicable: values[9] || '',
      glAccount: values[10] || '',
      poQuantity: values[11] || '',
      poUnitPrice: values[12] || '',
      poUom: values[13] || '',
      purchaseOrderReceipt: values[14] || '',
      invoiceAmount: values[15] || '',
    })
  }

  return rows
}

/**
 * Parse a single CSV line, handling quoted values with commas
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
      values.push(currentValue.trim())
      currentValue = ''
    } else {
      currentValue += char
    }
  }

  // Add the last value
  values.push(currentValue.trim())

  return values
}

/**
 * Send vendor bill data to PACE API
 *
 * TODO: Update this function with the actual PACE API endpoint for vendor bills
 */
async function sendToPace(vendorBillIntegration: any, rows: VendorBillRow[]) {
  try {
    // Get PACE credentials
    const credentials = await getPaceApiCredentials()

    // TODO: Replace this placeholder with actual PACE API call
    // For now, we'll log what would be sent and return success
    console.log('📤 Would send to PACE:', {
      url: credentials.url,
      recordCount: rows.length,
      processDate: vendorBillIntegration.processDate,
      sample: rows[0], // First row as sample
    })

    // Placeholder response
    // In production, this should make an actual API call to PACE
    // Example:
    // const response = await fetch(`${credentials.url}/VendorBills/import`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ rows }),
    // })
    //
    // if (!response.ok) {
    //   throw new Error(`PACE API error: ${response.status} ${response.statusText}`)
    // }
    //
    // const result = await response.json()

    return {
      success: true,
      response: {
        message: 'Vendor bills processed (placeholder)',
        recordCount: rows.length,
        processDate: vendorBillIntegration.processDate,
      },
    }
  } catch (error) {
    console.error('Error sending to PACE:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      response: null,
    }
  }
}
