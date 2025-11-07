#!/usr/bin/env node

/**
 * Test script to simulate PACE sending multiple concurrent webhook requests
 * for the same invoice number to test race condition handling.
 *
 * This simulates the real-world scenario where PACE sends 5 separate webhook
 * calls within milliseconds for invoice parts that share the same invoice number.
 *
 * Usage:
 *   node test-invoice-race-condition.js [webhook-url] [username] [password]
 *
 * Example:
 *   node test-invoice-race-condition.js http://localhost:3000/api/webhooks/pace/invoice
 *   node test-invoice-race-condition.js https://calithosuite.com/api/webhooks/pace/invoice pace_user pace_pass
 *
 * Or use environment variables:
 *   WEBHOOK_URL=https://... WEBHOOK_USER=user WEBHOOK_PASS=pass node test-invoice-race-condition.js
 */

const WEBHOOK_URL = process.argv[2] || process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks/pace/invoice'
const WEBHOOK_USER = process.argv[3] || process.env.WEBHOOK_USER || process.env.PACE_WEBHOOK_USERNAME
const WEBHOOK_PASS = process.argv[4] || process.env.WEBHOOK_PASS || process.env.PACE_WEBHOOK_PASSWORD

// Test invoice data - single invoice #145045070 (real data from invoice 56904)
const invoiceParts = [
  {
    invoice: {
      id: 11813,
      invoiceId: "1",
      jobNum: "113062",
      invoiceNum: "145045070",
      invoiceAmount: 1359.880000,
      taxAmount: 0,
      customerId: "COL163",
      customerName: "COLLECTIVE HEALTH, INC.",
      invoiceDate: "2025-10-29",
      poNumber: ""
    },
    salesDistributions: [
      {
        id: 49986,
        invoice: "Invoice (145045070) Job 113062 Part 01",
        amount: 284.380000,
        quantity: 1,
        salesCategoryId: 5022,
        salesCategoryName: "Digital"
      },
      {
        id: 49987,
        invoice: "Invoice (145045070) Job 113062 Part 01",
        amount: 297.810000,
        quantity: 1,
        salesCategoryId: 7010,
        salesCategoryName: "IL: Print - General"
      },
      {
        id: 49988,
        invoice: "Invoice (145045070) Job 113062 Part 01",
        amount: 95.470000,
        quantity: 1,
        salesCategoryId: 5025,
        salesCategoryName: "Finishing"
      },
      {
        id: 49989,
        invoice: "Invoice (145045070) Job 113062 Part 01",
        amount: 392.530000,
        quantity: 1,
        salesCategoryId: 5031,
        salesCategoryName: "Mailing"
      },
      {
        id: 49990,
        invoice: "Invoice (145045070) Job 113062 Part 01",
        amount: 75.520000,
        quantity: 1,
        salesCategoryId: 5023,
        salesCategoryName: "Offset"
      },
      {
        id: 49991,
        invoice: "Invoice (145045070) Job 113062 Part 01",
        amount: 216.290000,
        quantity: 1,
        salesCategoryId: 5021,
        salesCategoryName: "Prepress"
      }
    ],
    invoiceExtras: [
      {
        id: 12761,
        lineNum: 1,
        price: -2.120000,
        quantity: 1,
        invoiceExtraTypeId: 5,
        invoiceExtraTypeName: "Postage Due"
      }
    ],
    metadata: {
      totalSalesDistLines: 6,
      totalInvoiceExtras: 1,
      objectType: "Invoice",
      exportedAt: "2025-10-30 14:36:09"
    }
  }
]

// Expected totals: $1,362.00 (sales) - $2.12 (postage due) = $1,359.88
const EXPECTED_SALES_DIST = 6
const EXPECTED_INVOICE_EXTRAS = 1
const EXPECTED_TOTAL_AMOUNT = 1359.88

console.log('🧪 Testing Single Invoice Submission')
console.log('==========================================')
console.log(`Webhook URL: ${WEBHOOK_URL}`)
console.log(`Invoice Number: 145045070`)
console.log(`Parts to send: ${invoiceParts.length}`)
console.log(`Authentication: ${WEBHOOK_USER && WEBHOOK_PASS ? `Basic Auth (user: ${WEBHOOK_USER})` : 'None'}`)
console.log('')
console.log('Expected final result:')
console.log(`  - Sales distributions: ${EXPECTED_SALES_DIST}`)
console.log(`  - Invoice extras: ${EXPECTED_INVOICE_EXTRAS}`)
console.log(`  - Total amount: $${EXPECTED_TOTAL_AMOUNT.toFixed(2)}`)
console.log('')

if (!WEBHOOK_USER || !WEBHOOK_PASS) {
  console.log('⚠️  Warning: No credentials provided. If the webhook requires auth, requests will fail.')
  console.log('   Provide credentials as: node test-invoice-race-condition.js <url> <username> <password>')
  console.log('   Or set PACE_WEBHOOK_USERNAME and PACE_WEBHOOK_PASSWORD environment variables')
  console.log('')
}

async function sendWebhook(part, index) {
  const startTime = Date.now()

  try {
    const headers = {
      'Content-Type': 'application/json',
    }

    // Add Basic Auth if credentials are provided
    if (WEBHOOK_USER && WEBHOOK_PASS) {
      const credentials = Buffer.from(`${WEBHOOK_USER}:${WEBHOOK_PASS}`).toString('base64')
      headers['Authorization'] = `Basic ${credentials}`
    }

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(part)
    })

    const duration = Date.now() - startTime
    const data = await response.json()

    return {
      index: index + 1,
      jobNum: part.invoice.jobNum,
      status: response.status,
      duration,
      response: data
    }
  } catch (error) {
    const duration = Date.now() - startTime
    return {
      index: index + 1,
      jobNum: part.invoice.jobNum,
      status: 'ERROR',
      duration,
      error: error.message
    }
  }
}

async function runTest() {
  console.log('📤 Sending 5 concurrent webhook requests...\n')

  const startTime = Date.now()

  // Send all 5 requests concurrently (simulating PACE's behavior)
  const promises = invoiceParts.map((part, index) => sendWebhook(part, index))
  const results = await Promise.all(promises)

  const totalDuration = Date.now() - startTime

  console.log('📥 Responses received:\n')

  results.forEach(result => {
    console.log(`Part ${result.index} (Job ${result.jobNum}):`)
    console.log(`  Status: ${result.status}`)
    console.log(`  Duration: ${result.duration}ms`)

    if (result.error) {
      console.log(`  Error: ${result.error}`)
    } else if (result.status === 401) {
      console.log(`  ❌ Authentication failed! Check credentials.`)
      console.log(`  Response: ${JSON.stringify(result.response)}`)
    } else if (result.status !== 200) {
      console.log(`  ❌ Request failed!`)
      console.log(`  Response: ${JSON.stringify(result.response)}`)
    } else {
      console.log(`  Message: ${result.response.message}`)
      if (result.response.salesDistLines !== undefined) {
        console.log(`  Sales Dist Lines: ${result.response.salesDistLines}`)
      }
      if (result.response.invoiceExtras !== undefined) {
        console.log(`  Invoice Extras: ${result.response.invoiceExtras}`)
      }
      if (result.response.totalAmount !== undefined) {
        console.log(`  Total Amount: $${result.response.totalAmount}`)
      }
      if (result.response.accumulated !== undefined) {
        console.log(`  Accumulated: ${result.response.accumulated}`)
      }
    }
    console.log('')
  })

  console.log(`⏱️  Total test duration: ${totalDuration}ms`)
  console.log('')

  // Check the final result
  const lastResult = results[results.length - 1]

  if (lastResult.response && lastResult.response.accumulated) {
    const finalSalesDist = lastResult.response.salesDistLines
    const finalExtras = lastResult.response.invoiceExtras
    const finalTotal = parseFloat(lastResult.response.totalAmount)

    console.log('✅ Final accumulated result:')
    console.log(`  Sales distributions: ${finalSalesDist} (expected: ${EXPECTED_SALES_DIST})`)
    console.log(`  Invoice extras: ${finalExtras} (expected: ${EXPECTED_INVOICE_EXTRAS})`)
    console.log(`  Total amount: $${finalTotal.toFixed(2)} (expected: $${EXPECTED_TOTAL_AMOUNT.toFixed(2)})`)
    console.log('')

    const success =
      finalSalesDist === EXPECTED_SALES_DIST &&
      finalExtras === EXPECTED_INVOICE_EXTRAS &&
      Math.abs(finalTotal - EXPECTED_TOTAL_AMOUNT) < 0.01

    if (success) {
      console.log('🎉 TEST PASSED! All line items were correctly accumulated.')
    } else {
      console.log('❌ TEST FAILED! Some line items were lost due to race condition.')
      process.exit(1)
    }
  } else {
    console.log('⚠️  Unable to verify final result - check the database directly')
    console.log('   Run this query to check:')
    console.log('   SELECT payload FROM "InvoiceIntegration" WHERE "invoiceNumber" = \'145045070\';')
  }
}

runTest().catch(error => {
  console.error('❌ Test failed with error:', error)
  process.exit(1)
})
