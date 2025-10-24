import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getNetSuiteCredentials } from '@repo/shared'
import crypto from 'crypto'

/**
 * GET /api/integrations/netsuite/test
 * Test NetSuite credentials and OAuth signature
 */
export async function GET() {
  try {
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

    // Get credentials from AWS Secrets Manager
    let credentials
    try {
      credentials = await getNetSuiteCredentials(membership.tenantId)
    } catch (credError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch NetSuite credentials',
          details: credError instanceof Error ? credError.message : String(credError),
        },
        { status: 500 }
      )
    }

    // Get current mode credentials
    const mode = netsuiteIntegration.currentMode
    const rawAccountId = mode === 'sandbox' ? credentials.sandboxAccountId : credentials.productionAccountId
    const consumerKey = mode === 'sandbox' ? credentials.sandboxConsumerKey : credentials.productionConsumerKey
    const consumerSecret = mode === 'sandbox' ? credentials.sandboxConsumerSecret : credentials.productionConsumerSecret
    const tokenId = mode === 'sandbox' ? credentials.sandboxTokenId : credentials.productionTokenId
    const tokenSecret = mode === 'sandbox' ? credentials.sandboxTokenSecret : credentials.productionTokenSecret

    // Normalize account ID (if it exists)
    const accountId = rawAccountId?.toUpperCase().replace(/-/g, '_')

    // Check if all credentials exist
    const hasAllCredentials = !!(accountId && consumerKey && consumerSecret && tokenId && tokenSecret)

    if (!hasAllCredentials) {
      return NextResponse.json({
        success: false,
        mode,
        credentials: {
          hasAccountId: !!accountId,
          hasConsumerKey: !!consumerKey,
          hasConsumerSecret: !!consumerSecret,
          hasTokenId: !!tokenId,
          hasTokenSecret: !!tokenSecret,
        },
        message: 'Missing some credentials',
      })
    }

    // Test with a simple GET request to the RESTlet
    const restletUrl = process.env.NETSUITE_RESTLET_URL || ''

    if (!restletUrl) {
      return NextResponse.json({
        success: false,
        error: 'NETSUITE_RESTLET_URL not configured in environment variables',
      })
    }

    // Generate OAuth header for GET request
    // At this point we know all credentials exist due to hasAllCredentials check
    const oauthHeader = generateOAuthSignature(
      restletUrl,
      'GET',
      accountId!,
      consumerKey!,
      consumerSecret!,
      tokenId!,
      tokenSecret!
    )

    // Make test request
    try {
      const response = await fetch(restletUrl, {
        method: 'GET',
        headers: {
          Authorization: oauthHeader,
        },
      })

      const responseText = await response.text()
      let responseData
      try {
        responseData = JSON.parse(responseText)
      } catch {
        responseData = { rawResponse: responseText }
      }

      return NextResponse.json({
        success: response.ok,
        test: 'NetSuite TBA Authentication Test',
        mode,
        accountId: accountId!,
        consumerKeyPrefix: consumerKey!.substring(0, 10) + '...',
        tokenIdPrefix: tokenId!.substring(0, 10) + '...',
        restletUrl,
        httpStatus: response.status,
        httpStatusText: response.statusText,
        response: responseData,
        oauthHeaderSample: oauthHeader.substring(0, 100) + '...',
      })
    } catch (fetchError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to connect to NetSuite',
        details: fetchError instanceof Error ? fetchError.message : String(fetchError),
      })
    }
  } catch (error) {
    console.error('NetSuite test error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

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
  const nonce = crypto.randomBytes(11).toString('base64').replace(/[+/=]/g, '')

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_token: tokenId,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: timestamp,
    oauth_nonce: nonce,
    oauth_version: '1.0',
  }

  const parameterString = Object.keys(oauthParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
    .join('&')

  const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(parameterString)}`
  const signingKey = `${consumerSecret}&${tokenSecret}`
  const signature = crypto.createHmac('sha256', signingKey).update(baseString).digest('base64')

  const authHeader =
    'OAuth realm="' + accountId + '"' +
    ', oauth_consumer_key="' + consumerKey + '"' +
    ', oauth_token="' + tokenId + '"' +
    ', oauth_signature_method="HMAC-SHA256"' +
    ', oauth_timestamp="' + timestamp + '"' +
    ', oauth_nonce="' + nonce + '"' +
    ', oauth_version="1.0"' +
    ', oauth_signature="' + signature + '"'

  return authHeader
}
