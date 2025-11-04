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
 * Group vendor bill rows by invoice number
 * Each invoice becomes one Bill with multiple BillLines
 */
function groupByInvoice(rows: VendorBillRow[]): Map<string, VendorBillRow[]> {
  const groups = new Map<string, VendorBillRow[]>()

  for (const row of rows) {
    const key = `${row.vendor}-${row.invoiceNumber}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(row)
  }

  return groups
}

/**
 * Create a Bill object in PACE
 */
async function createPaceBill(
  credentials: { url: string; username: string; password: string },
  billData: {
    billBatch: string
    billType: string
    dateDue: string
    vendor: string
    invoiceDate: string
    invoiceNumber: string
    voucherDate: string
  }
): Promise<{ success: boolean; billId?: string; error?: string }> {
  try {
    const authHeader = 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')

    const payload: any = {
      billBatch: billData.billBatch,
      billType: billData.billType,
      vendor: billData.vendor,
      invoiceNumber: billData.invoiceNumber,
    }

    // Add dates if provided (PACE expects ISO date format: YYYY-MM-DD)
    if (billData.dateDue) {
      payload.dateDue = convertToISODate(billData.dateDue)
    }
    if (billData.invoiceDate) {
      payload.invoiceDate = convertToISODate(billData.invoiceDate)
    }
    if (billData.voucherDate) {
      payload.voucherDate = convertToISODate(billData.voucherDate)
    }

    console.log(`[PACE] 📄 Creating Bill: Invoice ${billData.invoiceNumber}, Vendor ${billData.vendor}`)
    console.log(`[PACE] 📦 Bill payload:`, JSON.stringify(payload, null, 2))

    const response = await fetch(`${credentials.url}/CreateObject/createBill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(payload),
    })

    console.log(`[PACE] 📨 Bill response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[PACE] ❌ Bill creation error (${response.status}):`, errorText)
      return {
        success: false,
        error: `PACE Bill error: ${response.status} - ${errorText}`,
      }
    }

    const result = await response.json() as any
    console.log(`[PACE] 📨 Bill response:`, JSON.stringify(result, null, 2))

    const billId = result.id || result.ID
    console.log(`[PACE] ✅ Successfully created Bill - ID: ${billId}`)

    return {
      success: true,
      billId: billId?.toString(),
    }
  } catch (error) {
    console.error('[PACE] ❌ Exception creating Bill:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating Bill',
    }
  }
}

/**
 * Create a BillLine object in PACE
 */
async function createPaceBillLine(
  credentials: { url: string; username: string; password: string },
  billId: string,
  lineData: {
    discountApplicable: string
    glAccount: string
    poQuantity: string
    poUnitPrice: string
    poUom: string
    purchaseOrderReceipt: string
    invoiceAmount: string
  }
): Promise<{ success: boolean; billLineId?: string; error?: string }> {
  try {
    const authHeader = 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')

    const payload: any = {
      bill: billId,
      glAccount: lineData.glAccount,
    }

    // Add numeric fields if provided
    if (lineData.poQuantity) {
      payload.poQuantity = parseFloat(lineData.poQuantity)
    }
    if (lineData.poUnitPrice) {
      payload.poUnitPrice = parseFloat(lineData.poUnitPrice)
    }
    if (lineData.invoiceAmount) {
      payload.invoiceAmount = parseFloat(lineData.invoiceAmount)
    }

    // Add text fields
    if (lineData.poUom) {
      payload.poUom = lineData.poUom
    }
    if (lineData.purchaseOrderReceipt) {
      payload.purchaseOrderReceipt = lineData.purchaseOrderReceipt
    }
    if (lineData.discountApplicable) {
      payload.discountApplicable = lineData.discountApplicable === 'true' || lineData.discountApplicable === '1'
    }

    console.log(`[PACE] 📋 Creating BillLine for Bill ${billId}`)
    console.log(`[PACE] 📦 BillLine payload:`, JSON.stringify(payload, null, 2))

    const response = await fetch(`${credentials.url}/CreateObject/createBillLine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(payload),
    })

    console.log(`[PACE] 📨 BillLine response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[PACE] ❌ BillLine creation error (${response.status}):`, errorText)
      return {
        success: false,
        error: `PACE BillLine error: ${response.status} - ${errorText}`,
      }
    }

    const result = await response.json() as any
    const billLineId = result.id || result.ID
    console.log(`[PACE] ✅ Successfully created BillLine - ID: ${billLineId}`)

    return {
      success: true,
      billLineId: billLineId?.toString(),
    }
  } catch (error) {
    console.error('[PACE] ❌ Exception creating BillLine:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating BillLine',
    }
  }
}

/**
 * Convert date string to ISO format (YYYY-MM-DD)
 * Handles formats like MM/DD/YYYY or YYYY-MM-DD
 */
function convertToISODate(dateStr: string): string {
  if (!dateStr) return ''

  // If already in ISO format (YYYY-MM-DD), return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }

  // Try to parse MM/DD/YYYY format
  const mmddyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mmddyyyyMatch) {
    const [, month, day, year] = mmddyyyyMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  // Try to parse as Date and convert
  const date = new Date(dateStr)
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Return as-is if we can't parse
  console.warn(`[PACE] ⚠️  Could not parse date: ${dateStr}`)
  return dateStr
}

/**
 * Send vendor bill data to PACE API
 *
 * Creates Bill and BillLine objects in PACE based on the CSV data
 */
async function sendToPace(_vendorBillIntegration: any, rows: VendorBillRow[]) {
  try {
    // Get PACE credentials
    const credentials = await getPaceApiCredentials()

    console.log(`[PACE] 🚀 Sending ${rows.length} vendor bill rows to PACE...`)

    // Group rows by invoice (each invoice = 1 Bill with multiple BillLines)
    const invoiceGroups = groupByInvoice(rows)
    console.log(`[PACE] 📊 Grouped into ${invoiceGroups.size} bills`)

    const results: Array<{
      invoiceNumber: string
      billId?: string
      billLineIds: string[]
      success: boolean
      error?: string
    }> = []

    // Process each bill
    for (const [_groupKey, billRows] of invoiceGroups) {
      const firstRow = billRows[0]
      const invoiceNumber = firstRow.invoiceNumber

      console.log(`\n[PACE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`[PACE] 📄 Processing Invoice: ${invoiceNumber}`)
      console.log(`[PACE] 📋 Vendor: ${firstRow.vendor}`)
      console.log(`[PACE] 📋 Bill Lines: ${billRows.length}`)

      // Step 1: Create Bill object
      const billResult = await createPaceBill(credentials, {
        billBatch: firstRow.billBatch,
        billType: firstRow.billType,
        dateDue: firstRow.dateDue,
        vendor: firstRow.vendor,
        invoiceDate: firstRow.invoiceDate,
        invoiceNumber: firstRow.invoiceNumber,
        voucherDate: firstRow.voucherDate,
      })

      if (!billResult.success || !billResult.billId) {
        console.error(`[PACE] ❌ Failed to create Bill for invoice ${invoiceNumber}: ${billResult.error}`)
        results.push({
          invoiceNumber,
          billLineIds: [],
          success: false,
          error: billResult.error,
        })
        continue
      }

      const billId = billResult.billId
      console.log(`[PACE] ✅ Bill created with ID: ${billId}`)

      // Step 2: Create BillLine objects for each row
      const billLineIds: string[] = []
      let lineNumber = 0
      let lineErrors: string[] = []

      for (const row of billRows) {
        lineNumber++
        console.log(`[PACE] 📋 Creating BillLine ${lineNumber}/${billRows.length}...`)

        const lineResult = await createPaceBillLine(credentials, billId, {
          discountApplicable: row.discountApplicable,
          glAccount: row.glAccount,
          poQuantity: row.poQuantity,
          poUnitPrice: row.poUnitPrice,
          poUom: row.poUom,
          purchaseOrderReceipt: row.purchaseOrderReceipt,
          invoiceAmount: row.invoiceAmount,
        })

        if (lineResult.success && lineResult.billLineId) {
          billLineIds.push(lineResult.billLineId)
          console.log(`[PACE]    ✅ BillLine ${lineNumber} created: ${lineResult.billLineId}`)
        } else {
          console.error(`[PACE]    ❌ BillLine ${lineNumber} failed: ${lineResult.error}`)
          lineErrors.push(`Line ${lineNumber}: ${lineResult.error}`)
        }
      }

      console.log(`[PACE] ✅ Created ${billLineIds.length}/${billRows.length} BillLines for invoice ${invoiceNumber}`)

      results.push({
        invoiceNumber,
        billId,
        billLineIds,
        success: lineErrors.length === 0,
        error: lineErrors.length > 0 ? lineErrors.join('; ') : undefined,
      })
    }

    console.log(`\n[PACE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`[PACE] ✅ Processing complete!`)
    console.log(`[PACE] 📊 Summary:`)
    console.log(`[PACE]    - Total Bills: ${results.length}`)
    console.log(`[PACE]    - Successful: ${results.filter(r => r.success).length}`)
    console.log(`[PACE]    - Failed: ${results.filter(r => !r.success).length}`)

    // Check if all bills were processed successfully
    const allSuccess = results.every(r => r.success)

    return {
      success: allSuccess,
      response: {
        message: allSuccess
          ? 'All vendor bills sent to PACE successfully'
          : 'Some vendor bills failed to process',
        totalBills: results.length,
        successfulBills: results.filter(r => r.success).length,
        failedBills: results.filter(r => !r.success).length,
        details: results,
      },
      error: allSuccess ? undefined : results.filter(r => !r.success).map(r => r.error).join('; '),
    }
  } catch (error) {
    console.error('[PACE] ❌ Error sending to PACE:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      response: null,
    }
  }
}
