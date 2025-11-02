import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getNetSuiteCredentials } from '@repo/shared'
import crypto from 'crypto'

/**
 * GET /api/po-receipts/integrations/[id]/send-to-netsuite
 * Get information about the PO Receipt NetSuite integration endpoint
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  return NextResponse.json({
    success: true,
    message: 'PO Receipt to NetSuite Integration Endpoint',
    version: '1.0',
    timestamp: new Date().toISOString(),
    endpoint: `/api/po-receipts/integrations/${id}/send-to-netsuite`,
    description: 'Send a single PO Receipt integration to NetSuite',
    methods: ['GET', 'POST'],
    restletUrl: process.env.NETSUITE_PO_RECEIPT_RESTLET_URL || 'Not configured',
    configured: !!process.env.NETSUITE_PO_RECEIPT_RESTLET_URL,
  })
}

/**
 * POST /api/po-receipts/integrations/[id]/send-to-netsuite
 * Send a single PO Receipt integration to NetSuite
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      select: { tenantId: true },
    })

    if (!membership?.tenantId) {
      return NextResponse.json({ error: 'User has no tenant' }, { status: 400 })
    }

    // Get the PO Receipt integration
    const poReceiptIntegration = await db.poReceiptIntegration.findUnique({
      where: { id },
    })

    if (!poReceiptIntegration) {
      return NextResponse.json({ error: 'PO Receipt not found' }, { status: 404 })
    }

    // Verify it belongs to the user's tenant
    if (poReceiptIntegration.tenantId !== membership.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if already completed
    if (poReceiptIntegration.status === 'completed') {
      return NextResponse.json({
        success: true,
        message: 'PO Receipt already sent to NetSuite',
        alreadyCompleted: true,
      })
    }

    // Update status to processing
    await db.poReceiptIntegration.update({
      where: { id },
      data: {
        status: 'processing',
        lastAttemptAt: new Date(),
      },
    })

    console.log(`📤 Sending PO Receipt ${poReceiptIntegration.uniqueId} to NetSuite...`)

    // Send to NetSuite
    const result = await sendPOReceiptToNetSuite(poReceiptIntegration, membership.tenantId)

    if (result.success) {
      // Update as completed
      await db.poReceiptIntegration.update({
        where: { id },
        data: {
          status: 'completed',
          netsuiteResponse: result.response,
          netsuiteRecordId: result.receiptId ? String(result.receiptId) : null,
          errorMessage: null,
          sentToNetsuiteAt: new Date(),
        },
      })

      console.log(`✅ PO Receipt ${poReceiptIntegration.uniqueId} sent successfully! NetSuite Receipt ID: ${result.receiptId}`)

      return NextResponse.json({
        success: true,
        message: 'PO Receipt sent to NetSuite successfully',
        uniqueId: poReceiptIntegration.uniqueId,
        receiptId: result.receiptId,
      })
    } else {
      // Update as failed
      const newRetryCount = poReceiptIntegration.retryCount + 1
      await db.poReceiptIntegration.update({
        where: { id },
        data: {
          status: 'failed',
          errorMessage: result.error,
          netsuiteResponse: result.response,
          retryCount: newRetryCount,
        },
      })

      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to send PO Receipt to NetSuite',
        response: result.response,
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Error sending PO Receipt to NetSuite:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send PO Receipt to NetSuite' },
      { status: 500 }
    )
  }
}

/**
 * Send PO Receipt to NetSuite RESTlet
 */
async function sendPOReceiptToNetSuite(poReceiptIntegration: any, tenantId: string) {
  try {
    // Get NetSuite integration config
    const netsuiteIntegration = await db.netSuiteIntegration.findUnique({
      where: { tenantId },
    })

    if (!netsuiteIntegration) {
      throw new Error('NetSuite integration not configured')
    }

    // Check if the current mode is enabled
    const isEnabled =
      netsuiteIntegration.currentMode === 'sandbox'
        ? netsuiteIntegration.sandboxEnabled
        : netsuiteIntegration.productionEnabled

    if (!isEnabled) {
      throw new Error(`NetSuite ${netsuiteIntegration.currentMode} mode is not enabled`)
    }

    // Get credentials from AWS Secrets Manager
    const credentials = await getNetSuiteCredentials(tenantId)

    // Determine which credentials to use based on current mode
    const rawAccountId =
      netsuiteIntegration.currentMode === 'sandbox'
        ? credentials.sandboxAccountId
        : credentials.productionAccountId
    const consumerKey =
      netsuiteIntegration.currentMode === 'sandbox'
        ? credentials.sandboxConsumerKey
        : credentials.productionConsumerKey
    const consumerSecret =
      netsuiteIntegration.currentMode === 'sandbox'
        ? credentials.sandboxConsumerSecret
        : credentials.productionConsumerSecret
    const tokenId =
      netsuiteIntegration.currentMode === 'sandbox'
        ? credentials.sandboxTokenId
        : credentials.productionTokenId
    const tokenSecret =
      netsuiteIntegration.currentMode === 'sandbox'
        ? credentials.sandboxTokenSecret
        : credentials.productionTokenSecret

    // Normalize account ID format
    const accountId = rawAccountId?.toUpperCase().replace(/-/g, '_')

    // Validate credentials
    if (!accountId || !consumerKey || !consumerSecret || !tokenId || !tokenSecret) {
      throw new Error(`Missing credentials for ${netsuiteIntegration.currentMode} mode`)
    }

    // Get RESTlet URL for PO Receipts
    const restletUrl = process.env.NETSUITE_PO_RECEIPT_RESTLET_URL
    if (!restletUrl) {
      throw new Error('NETSUITE_PO_RECEIPT_RESTLET_URL not configured')
    }

    // Use the payload as-is (Item Receipt format)
    const payload = poReceiptIntegration.payload

    // Generate OAuth 1.0 signature
    const oauthParams = generateOAuthSignature(
      restletUrl,
      'POST',
      accountId!,
      consumerKey!,
      consumerSecret!,
      tokenId!,
      tokenSecret!
    )

    console.log('📤 Sending to NetSuite:', {
      url: restletUrl,
      mode: netsuiteIntegration.currentMode,
      uniqueId: poReceiptIntegration.uniqueId,
      poNumber: poReceiptIntegration.poNumber,
      poLineId: poReceiptIntegration.poLineId,
      qtyReceived: poReceiptIntegration.qtyReceived,
    })

    // Send to NetSuite RESTlet
    const netsuiteResponse = await fetch(restletUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: oauthParams,
      },
      body: JSON.stringify(payload),
    })

    let responseData
    try {
      responseData = await netsuiteResponse.json()
    } catch (parseError) {
      const responseText = await netsuiteResponse.text()
      throw new Error(`NetSuite returned invalid JSON: ${responseText.substring(0, 200)}`)
    }

    console.log('📥 NetSuite response:', {
      status: netsuiteResponse.status,
      success: responseData.success,
      error: responseData.error,
      receiptId: responseData.receiptId,
    })

    if (responseData.success) {
      return {
        success: true,
        response: responseData,
        receiptId: responseData.receiptId || null,
      }
    } else {
      return {
        success: false,
        error: responseData.error?.message || responseData.error || 'Unknown error from NetSuite',
        response: responseData,
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      response: null,
    }
  }
}

/**
 * Generate OAuth 1.0 signature for NetSuite TBA
 */
function generateOAuthSignature(
  url: string,
  method: string,
  accountId: string,
  consumerKey: string,
  consumerSecret: string,
  tokenId: string,
  tokenSecret: string
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomBytes(16).toString('hex')

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_token: tokenId,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: timestamp,
    oauth_nonce: nonce,
    oauth_version: '1.0',
  }

  const urlObj = new URL(url)
  const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`

  const allParams: Record<string, string> = { ...oauthParams }
  urlObj.searchParams.forEach((value, key) => {
    allParams[key] = value
  })

  const paramString = Object.keys(allParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
    .join('&')

  const baseString = `${method.toUpperCase()}&${encodeURIComponent(baseUrl)}&${encodeURIComponent(paramString)}`
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`

  const signature = crypto.createHmac('sha256', signingKey).update(baseString).digest('base64')

  const realm = accountId.toUpperCase()
  const authParams = [
    `realm="${realm}"`,
    ...Object.entries({ ...oauthParams, oauth_signature: signature }).map(
      ([key, value]) => `${key}="${encodeURIComponent(value)}"`
    ),
  ]

  return `OAuth ${authParams.join(',')}`
}
