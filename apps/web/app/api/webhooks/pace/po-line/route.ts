import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/database'
import { queueNetsuitePOLine } from '@/lib/queue/netsuite-po-line-queue'

/**
 * PACE Purchase Order Line Webhook Handler
 *
 * This endpoint receives PO Line data from PACE and stores it for future
 * processing and potential forwarding to NetSuite.
 *
 * Webhook URL to configure in PACE:
 * https://calithosuite.com/api/webhooks/pace/po-line
 *
 * Set PACE_WEBHOOK_USERNAME and PACE_WEBHOOK_PASSWORD in your .env file
 */

interface PurchaseOrder {
  poNumber: string
  vendor: string
}

interface PurchaseOrderLine {
  id: number
  lineLink: string
  description: string
  item: string
  rate: number
  qtyOrdered: number
  qtyReceived: number
}

interface PACEPOLineWebhookPayload {
  purchaseOrder: PurchaseOrder
  purchaseOrderLine: PurchaseOrderLine
  metadata: {
    objectType: string
    exportedAt: string
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
        console.warn('PACE PO Line webhook received without Basic Auth')
        return NextResponse.json(
          { status: 'error', error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const base64Credentials = authHeader.split(' ')[1]
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
      const [username, password] = credentials.split(':')

      if (username !== expectedUsername || password !== expectedPassword) {
        console.warn('PACE PO Line webhook received with invalid credentials')
        return NextResponse.json(
          { status: 'error', error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    // Get the tenant (for single-tenant deployments, get the first/only tenant)
    const tenant = await db.tenant.findFirst()
    if (!tenant) {
      console.error('No tenant found - cannot process PO Line')
      return NextResponse.json(
        { status: 'error', error: 'No tenant configured' },
        { status: 500 }
      )
    }

    // Parse the webhook payload
    // Read as text first to handle JSON parsing errors gracefully
    const originalBody = await request.text()

    // PACE sometimes sends malformed JSON with:
    // 1. Unescaped control characters (newlines, tabs, etc.) in string values
    // 2. Unescaped quotes in string values (e.g., 48"x96")

    // Smart state machine that looks ahead to determine if a quote closes a string
    let rawBody = ''
    let inString = false
    let wasEscaped = false

    for (let i = 0; i < originalBody.length; i++) {
      const char = originalBody[i]

      if (wasEscaped) {
        // Previous char was backslash, just add this char as-is
        rawBody += char
        wasEscaped = false
        continue
      }

      if (char === '\\') {
        // Escape character - remember it and add it
        rawBody += char
        wasEscaped = true
        continue
      }

      if (char === '"') {
        if (inString) {
          // We're inside a string - is this quote closing it or is it unescaped?
          // Look ahead: if next non-whitespace/non-newline char is :,}] then it's closing
          // : indicates a property name, ,}] indicate end of value
          let j = i + 1
          while (j < originalBody.length && /[ \t\r\n]/.test(originalBody[j])) {
            j++
          }
          const nextChar = j < originalBody.length ? originalBody[j] : ''

          if (nextChar === ':' || nextChar === ',' || nextChar === '}' || nextChar === ']' || j >= originalBody.length) {
            // This quote closes the string (either property name or value)
            rawBody += char
            inString = false
          } else {
            // This is an unescaped quote inside the string - escape it!
            rawBody += '\\"'
          }
        } else {
          // Not in string, so this quote opens a new string
          rawBody += char
          inString = true
        }
        continue
      }

      // If we're inside a string value, escape control characters
      if (inString) {
        if (char === '\n') {
          rawBody += '\\n'
        } else if (char === '\r') {
          rawBody += '\\r'
        } else if (char === '\t') {
          rawBody += '\\t'
        } else {
          rawBody += char
        }
      } else {
        // Outside string, preserve as-is
        rawBody += char
      }
    }

    // Debug: Log the sanitized body
    console.log('=== PACE JSON Sanitization Debug ===')
    console.log('Original body length:', originalBody.length)
    console.log('Sanitized body length:', rawBody.length)
    console.log('Sanitized body:', rawBody)
    console.log('====================================')

    let payload: PACEPOLineWebhookPayload
    try {
      payload = JSON.parse(rawBody)
    } catch (parseError) {
      console.error('Failed to parse JSON payload:', parseError)
      console.error('Sanitized body:', rawBody)
      console.error('Original body:', originalBody)
      return NextResponse.json(
        {
          status: 'error',
          error: 'Invalid JSON payload - contains invalid control characters or malformed JSON',
          details: parseError instanceof Error ? parseError.message : String(parseError),
          hint: 'Check server logs for sanitized JSON body'
        },
        { status: 400 }
      )
    }

    // Extract PO Line ID and PO Number
    const poLineId = payload.purchaseOrderLine?.id
    const poNumber = payload.purchaseOrder?.poNumber

    console.log('📦 Received PACE PO Line webhook:', {
      poLineId,
      poNumber,
      vendor: payload.purchaseOrder?.vendor,
      item: payload.purchaseOrderLine?.item,
      description: payload.purchaseOrderLine?.description,
      qtyOrdered: payload.purchaseOrderLine?.qtyOrdered,
      qtyReceived: payload.purchaseOrderLine?.qtyReceived,
      rate: payload.purchaseOrderLine?.rate,
    })

    // Validate required fields
    if (!poLineId) {
      console.error('PO Line webhook missing purchaseOrderLine.id')
      return NextResponse.json(
        { status: 'error', error: 'purchaseOrderLine.id is required' },
        { status: 400 }
      )
    }

    if (!poNumber) {
      console.error('PO Line webhook missing purchaseOrder.poNumber')
      return NextResponse.json(
        { status: 'error', error: 'purchaseOrder.poNumber is required' },
        { status: 400 }
      )
    }

    // Create unique identifier using PO Number, Line ID, and timestamp
    // Format: poNumber-poLineId-timestamp (e.g., "86014-156626-1736938200000")
    const timestamp = Date.now()
    const uniqueId = `${poNumber}-${poLineId}-${timestamp}`

    // Always create a new PO Line integration record (full history tracking)
    const poLineIntegration = await db.poLineIntegration.create({
      data: {
        tenantId: tenant.id,
        uniqueId: uniqueId,
        poNumber: poNumber,
        poLineId: poLineId,
        status: 'pending',
        payload: payload as any,
      },
    })

    console.log('✅ Created PO Line integration record:', {
      id: poLineIntegration.id,
      uniqueId: poLineIntegration.uniqueId,
      poNumber: poLineIntegration.poNumber,
      poLineId: poLineIntegration.poLineId,
      vendor: payload.purchaseOrder?.vendor,
      item: payload.purchaseOrderLine?.item,
      qtyOrdered: payload.purchaseOrderLine?.qtyOrdered,
      status: poLineIntegration.status,
    })

    // Queue for sending to NetSuite
    await queueNetsuitePOLine(poLineIntegration.id, uniqueId, 0)
    console.log(`📤 Queued new PO Line ${uniqueId} for NetSuite`)

    // Return success response
    return NextResponse.json({
      status: 'success',
      message: `PO Line ${poNumber}-${poLineId} received and queued for NetSuite`,
      received_at: new Date().toISOString(),
      uniqueId: uniqueId,
      poNumber: poNumber,
      poLineId: poLineId,
      timestamp: timestamp,
    })

  } catch (error) {
    console.error('Error processing PACE PO Line webhook:', error)

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
    message: 'PACE Purchase Order Line Webhook Endpoint',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    instructions: 'This endpoint receives POST requests from PACE with PO Line data.',
    webhook_url: '/api/webhooks/pace/po-line',
    expected_payload: {
      purchaseOrder: {
        poNumber: 'string (required)',
        vendor: 'string'
      },
      purchaseOrderLine: {
        id: 'number (required)',
        lineLink: 'string',
        description: 'string',
        item: 'string',
        rate: 'number',
        qtyOrdered: 'number',
        qtyReceived: 'number'
      },
      metadata: {
        objectType: 'string',
        exportedAt: 'string'
      }
    },
  })
}
