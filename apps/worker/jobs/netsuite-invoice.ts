import { Worker, Job } from 'bullmq'
import type { Redis } from 'ioredis'
import { db } from '@repo/database'
import { getNetSuiteCredentials } from '@repo/shared'
import crypto from 'crypto'

/**
 * NetSuite Invoice Worker
 *
 * This worker processes jobs from the netsuite-invoice queue.
 * It sends invoices to NetSuite one at a time, with automatic retries on failure.
 */

export interface NetsuiteInvoiceJobData {
  invoiceIntegrationId: string
  invoiceNumber: string
  attempt: number
}

export function netsuiteInvoiceWorker(connection: Redis) {
  const worker = new Worker<NetsuiteInvoiceJobData>(
    'netsuite-invoice',
    async (job: Job<NetsuiteInvoiceJobData>) => {
      const { invoiceIntegrationId, invoiceNumber, attempt } = job.data

      console.log(`🔄 [Job ${job.id}] Processing invoice ${invoiceNumber} (attempt ${attempt})`)

      try {
        // Get the invoice integration record
        const invoiceIntegration = await db.invoiceIntegration.findUnique({
          where: { id: invoiceIntegrationId },
        })

        if (!invoiceIntegration) {
          throw new Error(`Invoice integration record not found: ${invoiceIntegrationId}`)
        }

        // Check if already completed
        if (invoiceIntegration.status === 'completed') {
          console.log(`✅ [Job ${job.id}] Invoice ${invoiceNumber} already completed, skipping`)
          return {
            success: true,
            message: 'Invoice already completed',
            invoiceNumber,
          }
        }

        // Update status to processing
        await db.invoiceIntegration.update({
          where: { id: invoiceIntegrationId },
          data: {
            status: 'processing',
            lastAttemptAt: new Date(),
          },
        })

        console.log(`📤 [Job ${job.id}] Sending invoice ${invoiceNumber} to NetSuite...`)

        // Send to NetSuite
        const result = await sendToNetSuite(invoiceIntegration)

        if (result.success) {
          // Update as completed
          await db.invoiceIntegration.update({
            where: { id: invoiceIntegrationId },
            data: {
              status: 'completed',
              netsuiteResponse: result.response as any,
              netsuiteInvoiceId: result.netsuiteInvoiceId ? String(result.netsuiteInvoiceId) : null,
              errorMessage: null,
              sentToNetsuiteAt: new Date(),
            },
          })

          console.log(`✅ [Job ${job.id}] Invoice ${invoiceNumber} sent successfully! NetSuite ID: ${result.netsuiteInvoiceId}`)

          return {
            success: true,
            message: 'Invoice sent to NetSuite successfully',
            invoiceNumber,
            netsuiteInvoiceId: result.netsuiteInvoiceId,
          }
        } else {
          // Update as failed
          await db.invoiceIntegration.update({
            where: { id: invoiceIntegrationId },
            data: {
              status: 'failed',
              errorMessage: result.error,
              netsuiteResponse: result.response as any,
              retryCount: invoiceIntegration.retryCount + 1,
            },
          })

          throw new Error(result.error || 'Failed to send invoice to NetSuite')
        }
      } catch (error) {
        console.error(`❌ [Job ${job.id}] Error processing invoice ${invoiceNumber}:`, error)

        // Update retry count
        await db.invoiceIntegration.update({
          where: { id: invoiceIntegrationId },
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
      concurrency: 1, // Process one invoice at a time to avoid rate limits
      limiter: {
        max: 10, // Max 10 jobs
        duration: 60000, // Per 60 seconds (rate limiting)
      },
    }
  )

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`✅ NetSuite Job ${job.id} completed successfully`)
  })

  worker.on('failed', (job, err) => {
    console.error(`❌ NetSuite Job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('❌ NetSuite Worker error:', err)
  })

  console.log('🚀 NetSuite Invoice Worker started')
  console.log('⏳ Waiting for NetSuite invoice jobs...')

  return worker
}

/**
 * Send invoice to NetSuite RESTlet
 */
async function sendToNetSuite(invoiceIntegration: any) {
  try {
    // Get tenant ID from the invoice payload
    // We'll need to determine this from the customer or store it separately
    // For now, we'll get the first membership's tenant
    const firstMembership = await db.membership.findFirst()
    if (!firstMembership) {
      throw new Error('No tenant found')
    }
    const tenantId = firstMembership.tenantId

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

    // Normalize account ID format (if it exists)
    const accountId = rawAccountId?.toUpperCase().replace(/-/g, '_')

    // Validate credentials
    if (!accountId || !consumerKey || !consumerSecret || !tokenId || !tokenSecret) {
      throw new Error(`Missing credentials for ${netsuiteIntegration.currentMode} mode`)
    }

    // Get RESTlet URL
    const restletUrl = process.env.NETSUITE_RESTLET_URL
    if (!restletUrl) {
      throw new Error('NETSUITE_RESTLET_URL not configured')
    }

    // The invoice payload from PACE is already in the correct format
    const invoicePayload = invoiceIntegration.payload

    // Generate OAuth 1.0 signature
    // At this point all credentials are validated and non-null
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
      invoiceNumber: invoiceIntegration.invoiceNumber,
    })

    // Send to NetSuite RESTlet
    const netsuiteResponse = await fetch(restletUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: oauthParams,
      },
      body: JSON.stringify(invoicePayload),
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
    })

    if (responseData.success) {
      return {
        success: true,
        response: responseData,
        netsuiteInvoiceId: responseData.invoiceId || responseData.invoiceNumber || null,
      }
    } else {
      return {
        success: false,
        error: responseData.error || 'Unknown error from NetSuite',
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
