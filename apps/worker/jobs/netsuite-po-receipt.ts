import { Worker, Job } from 'bullmq'
import type { Redis } from 'ioredis'
import { db } from '@repo/database'
import { getNetSuiteCredentials } from '@repo/shared'
import crypto from 'crypto'

/**
 * NetSuite PO Receipt Worker
 *
 * This worker processes jobs from the netsuite-po-receipt queue.
 * It sends PO Receipts to NetSuite one at a time, with automatic retries on failure.
 */

export interface NetsuitePOReceiptJobData {
  poReceiptIntegrationId: string
  uniqueId: string
  attempt: number
}

export function netsuitePOReceiptWorker(connection: Redis) {
  const worker = new Worker<NetsuitePOReceiptJobData>(
    'netsuite-po-receipt',
    async (job: Job<NetsuitePOReceiptJobData>) => {
      const { poReceiptIntegrationId, uniqueId, attempt } = job.data

      console.log(`🔄 [Job ${job.id}] Processing PO Receipt ${uniqueId} (attempt ${attempt})`)

      try {
        // Get the PO Receipt integration record
        const poReceiptIntegration = await db.poReceiptIntegration.findUnique({
          where: { id: poReceiptIntegrationId },
        })

        if (!poReceiptIntegration) {
          throw new Error(`PO Receipt integration record not found: ${poReceiptIntegrationId}`)
        }

        // Check if already completed
        if (poReceiptIntegration.status === 'completed') {
          console.log(`✅ [Job ${job.id}] PO Receipt ${uniqueId} already completed, skipping`)
          return {
            success: true,
            message: 'PO Receipt already completed',
            uniqueId,
          }
        }

        // Update status to processing
        await db.poReceiptIntegration.update({
          where: { id: poReceiptIntegrationId },
          data: {
            status: 'processing',
            lastAttemptAt: new Date(),
          },
        })

        console.log(`📤 [Job ${job.id}] Sending PO Receipt ${uniqueId} to NetSuite...`)

        // Send to NetSuite
        const result = await sendPOReceiptToNetSuite(poReceiptIntegration)

        if (result.success) {
          // Update as completed
          await db.poReceiptIntegration.update({
            where: { id: poReceiptIntegrationId },
            data: {
              status: 'completed',
              netsuiteResponse: result.response as any,
              netsuiteRecordId: result.receiptId ? String(result.receiptId) : null,
              errorMessage: null,
              sentToNetsuiteAt: new Date(),
            },
          })

          console.log(`✅ [Job ${job.id}] PO Receipt ${uniqueId} sent successfully! NetSuite Receipt ID: ${result.receiptId}`)

          return {
            success: true,
            message: 'PO Receipt sent to NetSuite successfully',
            uniqueId,
            receiptId: result.receiptId,
          }
        } else {
          // Update as failed
          // Ensure errorMessage is a string
          const errorMessage = typeof result.error === 'string'
            ? result.error
            : JSON.stringify(result.error)

          await db.poReceiptIntegration.update({
            where: { id: poReceiptIntegrationId },
            data: {
              status: 'failed',
              errorMessage,
              netsuiteResponse: result.response as any,
              retryCount: poReceiptIntegration.retryCount + 1,
            },
          })

          throw new Error(errorMessage || 'Failed to send PO Receipt to NetSuite')
        }
      } catch (error) {
        console.error(`❌ [Job ${job.id}] Error processing PO Receipt ${uniqueId}:`, error)

        // Update retry count
        await db.poReceiptIntegration.update({
          where: { id: poReceiptIntegrationId },
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
      concurrency: 1, // Process one PO Receipt at a time to avoid rate limits
      limiter: {
        max: 10, // Max 10 jobs
        duration: 60000, // Per 60 seconds (rate limiting)
      },
    }
  )

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`✅ NetSuite PO Receipt Job ${job.id} completed successfully`)
  })

  worker.on('failed', (job, err) => {
    console.error(`❌ NetSuite PO Receipt Job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('❌ NetSuite PO Receipt Worker error:', err)
  })

  console.log('🚀 NetSuite PO Receipt Worker started')
  console.log('⏳ Waiting for NetSuite PO Receipt jobs...')

  return worker
}

/**
 * Send PO Receipt to NetSuite RESTlet
 */
async function sendPOReceiptToNetSuite(poReceiptIntegration: any) {
  try {
    // Get tenant ID from the PO Receipt integration record
    const tenantId = poReceiptIntegration.tenantId
    if (!tenantId) {
      throw new Error('PO Receipt integration has no tenantId')
    }

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

    // Use the payload as-is (it should already be in the correct Item Receipt format)
    const payload = poReceiptIntegration.payload as any

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
      accountId: accountId?.slice(0, 4) + '***' + accountId?.slice(-4), // Masked for security
      credentialsSource: netsuiteIntegration.currentMode === 'sandbox' ? 'Sandbox Credentials' : 'Production Credentials',
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

    let responseData: any
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
      // Format error message for better readability
      let errorMessage: string
      if (typeof responseData.error === 'string') {
        errorMessage = responseData.error
      } else if (responseData.error && typeof responseData.error === 'object') {
        // If error is an object with code and message, format it nicely
        if (responseData.error.code && responseData.error.message) {
          errorMessage = `[${responseData.error.code}] ${responseData.error.message}`
        } else {
          errorMessage = JSON.stringify(responseData.error)
        }
      } else {
        errorMessage = 'Unknown error from NetSuite'
      }

      return {
        success: false,
        error: errorMessage,
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
