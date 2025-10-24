import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getNetSuiteCredentials } from '@repo/shared'
import crypto from 'crypto'

/**
 * POST /api/invoices/integrations/[id]/send
 * Manually send an invoice to NetSuite RESTlet
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15
    const { id } = await params

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Get the invoice integration record
    const invoiceIntegration = await db.invoiceIntegration.findUnique({
      where: { id },
    })

    if (!invoiceIntegration) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Get NetSuite integration config
    const netsuiteIntegration = await db.netSuiteIntegration.findUnique({
      where: { tenantId: membership.tenantId },
    })

    if (!netsuiteIntegration) {
      return NextResponse.json(
        { error: 'NetSuite integration not configured' },
        { status: 400 }
      )
    }

    // Check if the current mode is enabled
    const isEnabled =
      netsuiteIntegration.currentMode === 'sandbox'
        ? netsuiteIntegration.sandboxEnabled
        : netsuiteIntegration.productionEnabled

    if (!isEnabled) {
      return NextResponse.json(
        {
          error: `NetSuite ${netsuiteIntegration.currentMode} mode is not enabled`,
        },
        { status: 400 }
      )
    }

    // Get credentials from AWS Secrets Manager
    let credentials
    try {
      credentials = await getNetSuiteCredentials(membership.tenantId)
    } catch (credError) {
      console.error('Failed to fetch NetSuite credentials:', credError)
      return NextResponse.json(
        {
          error: 'Failed to fetch NetSuite credentials from AWS Secrets Manager',
          details: credError instanceof Error ? credError.message : String(credError),
        },
        { status: 500 }
      )
    }

    // Determine which credentials to use based on current mode
    let accountId =
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

    // Normalize account ID format for NetSuite TBA
    // NetSuite expects uppercase with underscores: TSTDRV123456_SB1
    // But some users might enter it with hyphens or lowercase
    accountId = accountId.toUpperCase().replace(/-/g, '_')

    // Validate credentials
    if (!accountId || !consumerKey || !consumerSecret || !tokenId || !tokenSecret) {
      console.error('Missing NetSuite credentials:', {
        mode: netsuiteIntegration.currentMode,
        hasAccountId: !!accountId,
        hasConsumerKey: !!consumerKey,
        hasConsumerSecret: !!consumerSecret,
        hasTokenId: !!tokenId,
        hasTokenSecret: !!tokenSecret,
      })
      return NextResponse.json(
        {
          error: `Missing credentials for ${netsuiteIntegration.currentMode} mode. Please configure NetSuite integration in Settings.`,
        },
        { status: 400 }
      )
    }

    // Get RESTlet URL from environment
    const restletUrl = process.env.NETSUITE_RESTLET_URL

    if (!restletUrl) {
      return NextResponse.json(
        { error: 'NETSUITE_RESTLET_URL not configured in environment variables' },
        { status: 400 }
      )
    }

    // Update status to processing
    await db.invoiceIntegration.update({
      where: { id },
      data: {
        status: 'processing',
        lastAttemptAt: new Date(),
      },
    })

    // The invoice payload from PACE is already in the correct format for our RESTlet
    const invoicePayload = invoiceIntegration.payload

    // Generate OAuth 1.0 signature for NetSuite RESTlet
    const oauthParams = generateOAuthSignature(
      restletUrl,
      'POST',
      accountId,
      consumerKey,
      consumerSecret,
      tokenId,
      tokenSecret
    )

    console.log('Sending to NetSuite RESTlet:', {
      url: restletUrl,
      mode: netsuiteIntegration.currentMode,
      accountId,
      consumerKeyPrefix: consumerKey.substring(0, 10) + '...',
      tokenIdPrefix: tokenId.substring(0, 10) + '...',
      invoiceNumber: invoiceIntegration.invoiceNumber,
    })
    console.log('OAuth Header:', oauthParams)
    console.log('Invoice Payload:', JSON.stringify(invoicePayload, null, 2))

    // Send to NetSuite RESTlet
    try {
      const netsuiteResponse = await fetch(restletUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: oauthParams,
        },
        body: JSON.stringify(invoicePayload),
      })

      let responseData
      try {
        responseData = await netsuiteResponse.json()
      } catch (parseError) {
        const responseText = await netsuiteResponse.text()
        console.error('Failed to parse NetSuite response as JSON:', responseText)
        throw new Error(`NetSuite returned invalid JSON (HTTP ${netsuiteResponse.status}): ${responseText.substring(0, 200)}`)
      }

      console.log('NetSuite response:', {
        status: netsuiteResponse.status,
        statusText: netsuiteResponse.statusText,
        success: responseData.success,
        error: responseData.error,
        fullResponse: JSON.stringify(responseData).substring(0, 500),
      })

      // Check if RESTlet returned success
      if (responseData.success) {
        // RESTlet returns success flag and invoice details
        const netsuiteInvoiceId = responseData.invoiceId || responseData.invoiceNumber || null

        // Update invoice integration record with success
        await db.invoiceIntegration.update({
          where: { id },
          data: {
            status: 'completed',
            netsuiteResponse: responseData,
            netsuiteInvoiceId: netsuiteInvoiceId,
            errorMessage: null,
            sentToNetsuiteAt: new Date(),
          },
        })

        return NextResponse.json({
          success: true,
          message: 'Invoice sent to NetSuite successfully',
          data: {
            netsuiteInvoiceId,
            response: responseData,
          },
        })
      } else {
        // NetSuite returned an error - extract the error message properly
        const errorMessage =
          typeof responseData.error === 'string'
            ? responseData.error
            : responseData.error?.message || JSON.stringify(responseData.error) || 'Unknown error from NetSuite'

        await db.invoiceIntegration.update({
          where: { id },
          data: {
            status: 'failed',
            errorMessage,
            netsuiteResponse: responseData,
            retryCount: invoiceIntegration.retryCount + 1,
          },
        })

        return NextResponse.json(
          {
            success: false,
            error: errorMessage,
            details: responseData,
          },
          { status: 400 }
        )
      }
    } catch (netsuiteError) {
      // Network or other error when calling NetSuite
      const errorMessage =
        netsuiteError instanceof Error
          ? netsuiteError.message
          : 'Unknown error calling NetSuite'

      await db.invoiceIntegration.update({
        where: { id },
        data: {
          status: 'failed',
          errorMessage,
          retryCount: invoiceIntegration.retryCount + 1,
        },
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to connect to NetSuite',
          details: errorMessage,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Send invoice to NetSuite error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * Transform PACE invoice payload to NetSuite SuiteTalk invoice format
 */
function transformToSuiteTalkInvoice(payload: any): any {
  const invoice = payload.invoice
  const salesDistributions = payload.salesDistributions || []
  const invoiceExtras = payload.invoiceExtras || []

  // Build invoice payload for SuiteTalk REST API
  const suitetalkInvoice: any = {
    // Customer - using external ID
    entity: { id: invoice.customerId },

    // Invoice number
    tranId: invoice.invoiceNum,

    // Invoice date (format: YYYY-MM-DD)
    tranDate: invoice.invoiceDate,

    // PO Number
    otherRefNum: invoice.poNumber,

    // Memo/Notes
    memo: `Invoice from PACE ERP\nCustomer: ${invoice.customerName}\nAmount: $${invoice.invoiceAmount}`,
  }

  // Build line items from sales distributions
  const lineItems: any[] = []

  // Add sales distribution lines
  salesDistributions.forEach((dist: any) => {
    lineItems.push({
      item: { id: dist.salesCategoryId.toString() },
      quantity: dist.quantity || 1,
      rate: dist.amount, // Use amount as rate since quantity is 1
      description: dist.salesCategoryName,
    })
  })

  // Add invoice extras (Freight, Handling, etc.)
  invoiceExtras.forEach((extra: any) => {
    if (extra.price > 0) {
      // Map invoice extra type to NetSuite item ID
      const itemId = getInvoiceExtraItemId(extra.invoiceExtraTypeName)
      if (itemId) {
        lineItems.push({
          item: { id: itemId },
          quantity: extra.quantity || 1,
          rate: extra.price,
          description: extra.invoiceExtraTypeName,
        })
      }
    }
  })

  // Add line items to invoice
  if (lineItems.length > 0) {
    suitetalkInvoice.item = {
      items: lineItems,
      replaceAll: true,
    }
  }

  return suitetalkInvoice
}

/**
 * Map invoice extra type names to NetSuite item IDs
 */
function getInvoiceExtraItemId(typeName: string): string | null {
  const mapping: Record<string, string> = {
    'Freight': '376',
    'Handling': '376',
    'Postage': '372',
    'Sales Tax': '310',
  }
  return mapping[typeName] || null
}

/**
 * Generate OAuth 1.0 signature for NetSuite TBA (Token-Based Authentication)
 * Based on NetSuite's TBA specification - matches working implementation
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

  // Parse URL to separate base URL from query parameters
  const urlObj = new URL(url)
  const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`

  // Collect all parameters (OAuth + query parameters)
  const allParams: Record<string, string> = { ...oauthParams }

  // Add query parameters to the parameter collection
  urlObj.searchParams.forEach((value, key) => {
    allParams[key] = value
  })

  // Create parameter string - sorted alphabetically (OAuth 1.0 spec requirement)
  const paramString = Object.keys(allParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
    .join('&')

  // Create base string for signature
  // Format: METHOD&BASE_URL&PARAMS (all URL encoded)
  // Note: Use baseUrl (without query params) as per OAuth 1.0 spec
  const baseString = `${method.toUpperCase()}&${encodeURIComponent(baseUrl)}&${encodeURIComponent(paramString)}`

  // Create signing key from secrets
  // Per OAuth 1.0 spec: key = consumer_secret&token_secret (URL encoded)
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`

  // Generate HMAC-SHA256 signature
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(baseString)
    .digest('base64')

  // Build authorization header
  // NetSuite expects the realm to be the account ID in uppercase
  const realm = accountId.toUpperCase()

  // Build auth params - all values including signature should be URL encoded in header
  const authParams = [
    `realm="${realm}"`,
    ...Object.entries({ ...oauthParams, oauth_signature: signature })
      .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
  ]

  const authHeader = `OAuth ${authParams.join(',')}`

  return authHeader
}
