#!/usr/bin/env tsx

/**
 * ShipStation Webhook Verification Script
 *
 * Lists all registered webhooks in ShipStation for a specific tenant.
 *
 * Usage:
 *   npx tsx list-webhooks.ts <tenantId> [mode]
 *
 * Example:
 *   npx tsx list-webhooks.ts cm0abc123 test
 *   npx tsx list-webhooks.ts cm0abc123 production
 */

import { getShipStationApiKey } from './packages/shared/src/secrets'

async function listWebhooks() {
  // Get command line arguments
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('❌ Error: Please provide a tenant ID')
    console.error('Usage: npx tsx list-webhooks.ts <tenantId> [mode]')
    console.error('Example: npx tsx list-webhooks.ts cm0abc123 test')
    process.exit(1)
  }

  const tenantId = args[0]
  const mode = (args[1] || 'test') as 'test' | 'production'

  console.log(`🔍 Fetching ${mode} webhooks for tenant: ${tenantId}`)
  console.log('')

  try {
    // Get ShipStation API key from AWS Secrets Manager
    console.log('🔐 Fetching ShipStation API key from AWS Secrets Manager...')
    const apiKey = await getShipStationApiKey(tenantId, mode)
    console.log('✅ API key retrieved successfully')
    console.log('')

    // Get all webhooks
    console.log('📤 Fetching registered webhooks from ShipStation API...')
    const response = await fetch('https://api.shipengine.com/v1/environment/webhooks', {
      method: 'GET',
      headers: {
        'API-Key': apiKey,
      },
    })

    const data = await response.json()

    if (response.ok) {
      console.log('✅ Successfully retrieved webhooks:')
      console.log('')
      console.log(JSON.stringify(data, null, 2))
      console.log('')

      // Check if our tracking webhook is registered
      const webhooks = Array.isArray(data) ? data : data.webhooks || []
      const trackingWebhook = webhooks.find((w: any) =>
        w.url?.includes('calithosuite.com/api/webhooks/shipstation/track')
      )

      if (trackingWebhook) {
        console.log('✅ Tracking webhook is registered!')
        console.log('   Event:', trackingWebhook.event)
        console.log('   Webhook ID:', trackingWebhook.webhook_id)
        console.log('   Status:', trackingWebhook.enabled ? 'Enabled' : 'Disabled')
      } else {
        console.log('⚠️  Tracking webhook NOT found.')
        console.log('   Run: npx tsx register-webhook.ts', tenantId, mode)
      }
    } else {
      console.error(`❌ Failed to retrieve webhooks (HTTP ${response.status})`)
      console.error('')
      console.error('Response:')
      console.error(JSON.stringify(data, null, 2))
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

listWebhooks()
