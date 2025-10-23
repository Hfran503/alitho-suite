#!/usr/bin/env tsx

/**
 * ShipStation Webhook Registration Script
 *
 * This script registers the tracking webhook with ShipStation API using
 * credentials from AWS Secrets Manager.
 *
 * Usage:
 *   npx tsx register-webhook.ts <tenantId> [mode]
 *
 * Example:
 *   npx tsx register-webhook.ts cm0abc123 test
 *   npx tsx register-webhook.ts cm0abc123 production
 */

import { config } from 'dotenv'
import { getShipStationApiKey } from './packages/shared/src/secrets'

// Load environment variables from .env
config()

const WEBHOOK_URL_BASE = 'https://calithosuite.com/api/webhooks/shipstation/track'

async function registerWebhook() {
  // Get command line arguments
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('❌ Error: Please provide a tenant ID')
    console.error('Usage: npx tsx register-webhook.ts <tenantId> [mode]')
    console.error('Example: npx tsx register-webhook.ts cm0abc123 test')
    process.exit(1)
  }

  const tenantId = args[0]
  const mode = (args[1] || 'test') as 'test' | 'production'

  console.log(`🔧 Registering ShipStation ${mode} webhook for tenant: ${tenantId}`)
  console.log('')

  try {
    // Get ShipStation API key from AWS Secrets Manager
    console.log('🔐 Fetching ShipStation API key from AWS Secrets Manager...')
    const apiKey = await getShipStationApiKey(tenantId, mode)
    console.log('✅ API key retrieved successfully')
    console.log('')

    // Get webhook credentials from environment
    const webhookUsername = process.env.SHIPSTATION_WEBHOOK_USERNAME
    const webhookPassword = process.env.SHIPSTATION_WEBHOOK_PASSWORD

    if (!webhookUsername || !webhookPassword) {
      console.error('❌ Error: Webhook credentials not found in environment')
      console.error('Please set SHIPSTATION_WEBHOOK_USERNAME and SHIPSTATION_WEBHOOK_PASSWORD in .env')
      process.exit(1)
    }

    // Construct webhook URL with Basic Auth
    const webhookUrl = `https://${webhookUsername}:${webhookPassword}@${WEBHOOK_URL_BASE.replace('https://', '')}`

    console.log(`📍 Webhook URL: https://${webhookUsername}:***@calithosuite.com/api/webhooks/shipstation/track`)
    console.log('')

    // Register the webhook
    console.log('📤 Registering webhook with ShipStation API...')
    const response = await fetch('https://api.shipengine.com/v1/environment/webhooks', {
      method: 'POST',
      headers: {
        'API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        event: 'track',
      }),
    })

    const data = await response.json()

    if (response.ok) {
      console.log('✅ Webhook registered successfully!')
      console.log('')
      console.log('Response:')
      console.log(JSON.stringify(data, null, 2))
      console.log('')
      console.log('🎉 Your webhook is now active and will receive tracking updates!')
    } else {
      console.error(`❌ Failed to register webhook (HTTP ${response.status})`)
      console.error('')
      console.error('Response:')
      console.error(JSON.stringify(data, null, 2))
      console.error('')
      console.error('💡 Troubleshooting:')
      console.error('  - Verify your API key is correct')
      console.error('  - Check if webhook already exists (you may need to update instead)')
      console.error('  - Ensure your URL is publicly accessible')
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

registerWebhook()
