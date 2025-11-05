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

// Test invoice data - 5 parts for invoice #15045040 (based on real invoice 56946)
const invoiceParts = [
  {
    invoice: {
      id: 91001,
      jobNum: "1002560",
      invoiceNum: "15045040",
      invoiceAmount: 114.53,
      taxAmount: 0,
      customerId: "00001094",
      customerName: "University of California Office of the President",
      invoiceDate: "2025-11-05",
      poNumber: "TEST-PO-001"
    },
    salesDistributions: [
      {
        id: 90001,
        invoice: "Invoice (15045040) Job 1002560 Part 01",
        amount: 92.00,
        quantity: 1,
        salesCategoryId: 7010,
        salesCategoryName: "IL: Print - General"
      }
    ],
    invoiceExtras: [
      {
        id: 90101,
        lineNum: null,
        price: 13.64,
        quantity: 1,
        invoiceExtraTypeId: 1,
        invoiceExtraTypeName: "Freight"
      },
      {
        id: 90102,
        lineNum: 1,
        price: 8.89,
        quantity: 1,
        invoiceExtraTypeId: 6,
        invoiceExtraTypeName: "Handling"
      }
    ],
    metadata: {
      totalSalesDistLines: 1,
      totalInvoiceExtras: 2,
      objectType: "Invoice",
      exportedAt: new Date().toISOString()
    }
  },
  {
    invoice: {
      id: 91002,
      jobNum: "113020",
      invoiceNum: "15045040",
      invoiceAmount: 1562.50,
      taxAmount: 0,
      customerId: "00001094",
      customerName: "University of California Office of the President",
      invoiceDate: "2025-11-05",
      poNumber: "TEST-PO-001"
    },
    salesDistributions: [
      {
        id: 90002,
        invoice: "Invoice (15045040) Job 113020 Part 01",
        amount: 1562.50,
        quantity: 1,
        salesCategoryId: 7038,
        salesCategoryName: "IL: Warehousing"
      }
    ],
    invoiceExtras: [],
    metadata: {
      totalSalesDistLines: 1,
      totalInvoiceExtras: 0,
      objectType: "Invoice",
      exportedAt: new Date().toISOString()
    }
  },
  {
    invoice: {
      id: 91003,
      jobNum: "1002556",
      invoiceNum: "15045040",
      invoiceAmount: 228.48,
      taxAmount: 0,
      customerId: "00001094",
      customerName: "University of California Office of the President",
      invoiceDate: "2025-11-05",
      poNumber: "TEST-PO-001"
    },
    salesDistributions: [
      {
        id: 90003,
        invoice: "Invoice (15045040) Job 1002556 Part 01",
        amount: 23.00,
        quantity: 1,
        salesCategoryId: 7010,
        salesCategoryName: "IL: Print - General"
      }
    ],
    invoiceExtras: [
      {
        id: 90103,
        lineNum: null,
        price: 196.59,
        quantity: 1,
        invoiceExtraTypeId: 1,
        invoiceExtraTypeName: "Freight"
      },
      {
        id: 90104,
        lineNum: 1,
        price: 8.89,
        quantity: 1,
        invoiceExtraTypeId: 6,
        invoiceExtraTypeName: "Handling"
      }
    ],
    metadata: {
      totalSalesDistLines: 1,
      totalInvoiceExtras: 2,
      objectType: "Invoice",
      exportedAt: new Date().toISOString()
    }
  },
  {
    invoice: {
      id: 91004,
      jobNum: "1002588",
      invoiceNum: "15045040",
      invoiceAmount: 206.52,
      taxAmount: 0,
      customerId: "00001094",
      customerName: "University of California Office of the President",
      invoiceDate: "2025-11-05",
      poNumber: "TEST-PO-001"
    },
    salesDistributions: [
      {
        id: 90004,
        invoice: "Invoice (15045040) Job 1002588 Part 01",
        amount: 20.70,
        quantity: 1,
        salesCategoryId: 7010,
        salesCategoryName: "IL: Print - General"
      }
    ],
    invoiceExtras: [
      {
        id: 90105,
        lineNum: null,
        price: 176.93,
        quantity: 1,
        invoiceExtraTypeId: 1,
        invoiceExtraTypeName: "Freight"
      },
      {
        id: 90106,
        lineNum: 1,
        price: 8.89,
        quantity: 1,
        invoiceExtraTypeId: 6,
        invoiceExtraTypeName: "Handling"
      }
    ],
    metadata: {
      totalSalesDistLines: 1,
      totalInvoiceExtras: 2,
      objectType: "Invoice",
      exportedAt: new Date().toISOString()
    }
  },
  {
    invoice: {
      id: 91005,
      jobNum: "1002636",
      invoiceNum: "15045040",
      invoiceAmount: 228.09,
      taxAmount: 0,
      customerId: "00001094",
      customerName: "University of California Office of the President",
      invoiceDate: "2025-11-05",
      poNumber: "TEST-PO-001"
    },
    salesDistributions: [
      {
        id: 90005,
        invoice: "Invoice (15045040) Job 1002636 Part 01",
        amount: 23.00,
        quantity: 1,
        salesCategoryId: 7010,
        salesCategoryName: "IL: Print - General"
      }
    ],
    invoiceExtras: [
      {
        id: 90107,
        lineNum: null,
        price: 196.20,
        quantity: 1,
        invoiceExtraTypeId: 1,
        invoiceExtraTypeName: "Freight"
      },
      {
        id: 90108,
        lineNum: 1,
        price: 8.89,
        quantity: 1,
        invoiceExtraTypeId: 6,
        invoiceExtraTypeName: "Handling"
      }
    ],
    metadata: {
      totalSalesDistLines: 1,
      totalInvoiceExtras: 2,
      objectType: "Invoice",
      exportedAt: new Date().toISOString()
    }
  }
]

// Expected totals
const EXPECTED_SALES_DIST = 5
const EXPECTED_INVOICE_EXTRAS = 8
const EXPECTED_TOTAL_AMOUNT = 2340.12

console.log('🧪 Testing Invoice Race Condition Handling')
console.log('==========================================')
console.log(`Webhook URL: ${WEBHOOK_URL}`)
console.log(`Invoice Number: 15045040`)
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
    console.log('   SELECT payload FROM "InvoiceIntegration" WHERE "invoiceNumber" = \'15045040\';')
  }
}

runTest().catch(error => {
  console.error('❌ Test failed with error:', error)
  process.exit(1)
})
