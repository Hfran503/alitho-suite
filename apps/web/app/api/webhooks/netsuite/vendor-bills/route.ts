import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/database'
import { queueVendorBill } from '@/lib/queue/vendor-bill-queue'
import { getNetSuiteCredentials } from '@repo/shared'

/**
 * NetSuite Vendor Bill Webhook Handler
 *
 * This endpoint receives vendor bill data from NetSuite scheduled script
 * and stores it for future processing and forwarding to PACE.
 *
 * Webhook URL to configure in NetSuite:
 * https://calithosuite.com/api/webhooks/netsuite/vendor-bills
 *
 * Authentication: Bearer token stored in AWS Secrets Manager
 * Configure the token in NetSuite Integration settings
 */

interface NetSuiteVendorBillPayload {
  source: string // 'NetSuite'
  type: string // 'vendor_bills_transformed'
  processDate: string // Date string (MM/DD/YYYY)
  timestamp: string // ISO timestamp
  recordCount: number
  vendorBillCount: number
  itemReceiptCount: number
  filename: string
  data: string // CSV content
}

export async function POST(request: NextRequest) {
  try {
    // 1. Get the tenant (for single-tenant deployments, get the first/only tenant)
    const tenant = await db.tenant.findFirst()
    if (!tenant) {
      console.error('No tenant found - cannot process vendor bills')
      return NextResponse.json(
        { status: 'error', error: 'No tenant configured' },
        { status: 500 }
      )
    }

    // 2. Verify Bearer Token Authentication from AWS Secrets Manager
    const authHeader = request.headers.get('authorization')

    try {
      const credentials = await getNetSuiteCredentials(tenant.id)
      const expectedToken = credentials.webhookToken

      if (expectedToken) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          console.warn('NetSuite vendor bill webhook received without Bearer token')
          return NextResponse.json(
            { status: 'error', error: 'Unauthorized - Bearer token required' },
            { status: 401 }
          )
        }

        const token = authHeader.split(' ')[1]

        if (token !== expectedToken) {
          console.warn('NetSuite vendor bill webhook received with invalid token')
          return NextResponse.json(
            { status: 'error', error: 'Unauthorized - Invalid token' },
            { status: 401 }
          )
        }
      } else {
        console.warn('NetSuite webhook token not configured - skipping authentication')
      }
    } catch (error) {
      // If credentials are not found, allow the request (backward compatibility)
      console.warn('NetSuite credentials not found in AWS Secrets Manager - skipping authentication')
    }

    // 3. Parse the webhook payload
    let payload: NetSuiteVendorBillPayload
    try {
      payload = await request.json()
    } catch (parseError) {
      console.error('Failed to parse JSON payload:', parseError)
      return NextResponse.json(
        {
          status: 'error',
          error: 'Invalid JSON payload',
          details: parseError instanceof Error ? parseError.message : String(parseError),
        },
        { status: 400 }
      )
    }

    // 4. Validate required fields
    if (!payload.data) {
      console.error('Vendor bill webhook missing data field')
      return NextResponse.json(
        { status: 'error', error: 'data field (CSV content) is required' },
        { status: 400 }
      )
    }

    if (!payload.processDate) {
      console.error('Vendor bill webhook missing processDate field')
      return NextResponse.json(
        { status: 'error', error: 'processDate is required' },
        { status: 400 }
      )
    }

    if (!payload.filename) {
      console.error('Vendor bill webhook missing filename field')
      return NextResponse.json(
        { status: 'error', error: 'filename is required' },
        { status: 400 }
      )
    }

    console.log('📦 Received NetSuite vendor bill webhook:', {
      processDate: payload.processDate,
      recordCount: payload.recordCount,
      vendorBillCount: payload.vendorBillCount,
      itemReceiptCount: payload.itemReceiptCount,
      filename: payload.filename,
      csvLength: payload.data.length,
    })

    // 5. Create vendor bill integration record
    const vendorBillIntegration = await db.vendorBillIntegration.create({
      data: {
        tenantId: tenant.id,
        processDate: payload.processDate,
        filename: payload.filename,
        status: 'pending',
        recordCount: payload.recordCount || 0,
        vendorBillCount: payload.vendorBillCount || 0,
        itemReceiptCount: payload.itemReceiptCount || 0,
        csvData: payload.data,
        payload: payload as any,
      },
    })

    console.log('✅ Created vendor bill integration record:', {
      id: vendorBillIntegration.id,
      processDate: vendorBillIntegration.processDate,
      filename: vendorBillIntegration.filename,
      recordCount: vendorBillIntegration.recordCount,
      status: vendorBillIntegration.status,
    })

    // 6. Queue for processing and sending to PACE
    await queueVendorBill(vendorBillIntegration.id, 0)
    console.log(`📤 Queued vendor bill ${vendorBillIntegration.id} for PACE`)

    // 7. Return success response
    return NextResponse.json({
      status: 'success',
      message: `Vendor bills from ${payload.processDate} received and queued for processing`,
      received_at: new Date().toISOString(),
      integrationId: vendorBillIntegration.id,
      recordCount: payload.recordCount,
      filename: payload.filename,
    })

  } catch (error) {
    console.error('Error processing NetSuite vendor bill webhook:', error)

    // Return 500 on error so NetSuite can retry
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

// Handle GET requests for testing
export async function GET() {
  return NextResponse.json({
    message: 'NetSuite Vendor Bill Webhook Endpoint',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    instructions: 'This endpoint receives POST requests from NetSuite with vendor bill data.',
    webhook_url: '/api/webhooks/netsuite/vendor-bills',
    authentication: 'Bearer token (NETSUITE_WEBHOOK_TOKEN)',
    expected_payload: {
      source: 'string (e.g., "NetSuite")',
      type: 'string (e.g., "vendor_bills_transformed")',
      processDate: 'string (MM/DD/YYYY format)',
      timestamp: 'string (ISO 8601 format)',
      recordCount: 'number',
      vendorBillCount: 'number',
      itemReceiptCount: 'number',
      filename: 'string',
      data: 'string (CSV content with headers)'
    },
  })
}
