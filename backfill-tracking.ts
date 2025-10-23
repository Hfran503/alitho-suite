#!/usr/bin/env tsx

/**
 * Backfill Tracking Data Script
 *
 * This script fetches tracking information for existing shipping labels
 * that don't have tracking data yet. It queries the ShipStation API
 * for each label and updates the database with the latest tracking info.
 *
 * Usage:
 *   npx tsx backfill-tracking.ts <tenantId> [mode] [limit]
 *
 * Examples:
 *   npx tsx backfill-tracking.ts cmgzzea5200001vtaazq29pyk test
 *   npx tsx backfill-tracking.ts cmgzzea5200001vtaazq29pyk test 10
 */

import { config } from 'dotenv'
import { db } from './packages/database/src'
import { getShipStationApiKey } from './packages/shared/src/secrets'

// Load environment variables
config()

interface TrackingResponse {
  tracking_number: string
  status_code: string
  status_description: string
  carrier_status_code: string
  carrier_status_description: string
  ship_date: string
  estimated_delivery_date: string | null
  actual_delivery_date: string | null
  exception_description: string | null
  events: Array<{
    occurred_at: string
    carrier_occurred_at: string
    description: string
    city_locality: string
    state_province: string
    postal_code: string
    country_code: string
    event_code: string
    event_description: string
    latitude: number | null
    longitude: number | null
  }>
}

/**
 * Map ShipEngine status codes to internal statuses
 */
function mapStatusCode(statusCode: string): string {
  const statusMap: Record<string, string> = {
    'UN': 'unknown',
    'AC': 'accepted',
    'IT': 'in_transit',
    'DE': 'delivered',
    'EX': 'exception',
    'AT': 'attempted_delivery',
    'NY': 'not_yet_in_system',
  }
  return statusMap[statusCode] || 'unknown'
}

/**
 * Fetch tracking data from ShipStation API
 */
async function fetchTrackingData(
  trackingNumber: string,
  carrier: string,
  apiKey: string
): Promise<TrackingResponse | null> {
  try {
    // Map carrier names to ShipStation carrier codes
    const carrierCodeMap: Record<string, string> = {
      'UPS': 'ups',
      'USPS': 'usps',
      'FedEx': 'fedex',
      'DHL': 'dhl_express',
    }

    const carrierCode = carrierCodeMap[carrier] || carrier.toLowerCase()

    const url = `https://api.shipengine.com/v1/tracking?carrier_code=${carrierCode}&tracking_number=${trackingNumber}`

    const response = await fetch(url, {
      headers: {
        'API-Key': apiKey,
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`   ⚠️  Tracking not found yet for ${trackingNumber}`)
        return null
      }
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`   ❌ Error fetching tracking for ${trackingNumber}:`, error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Update shipping label with tracking data
 */
async function updateLabelTracking(labelId: string, trackingData: TrackingResponse) {
  const trackingStatus = mapStatusCode(trackingData.status_code)

  const trackingMetadata = {
    tracking: {
      status_code: trackingData.status_code,
      status_description: trackingData.status_description,
      carrier_status_code: trackingData.carrier_status_code,
      carrier_status_description: trackingData.carrier_status_description,
      ship_date: trackingData.ship_date,
      estimated_delivery_date: trackingData.estimated_delivery_date,
      actual_delivery_date: trackingData.actual_delivery_date,
      exception_description: trackingData.exception_description,
      last_event: trackingData.events[0] ? {
        occurred_at: trackingData.events[0].occurred_at,
        carrier_occurred_at: trackingData.events[0].carrier_occurred_at,
        description: trackingData.events[0].description,
        city_locality: trackingData.events[0].city_locality,
        state_province: trackingData.events[0].state_province,
        postal_code: trackingData.events[0].postal_code,
        country_code: trackingData.events[0].country_code,
        event_code: trackingData.events[0].event_code,
        event_description: trackingData.events[0].event_description,
      } : null,
      updated_at: new Date().toISOString(),
    },
  }

  await db.shippingLabel.update({
    where: { id: labelId },
    data: {
      trackingStatus: trackingStatus,
      lastTrackedAt: new Date(),
      ...(trackingData.status_code === 'DE' && {
        status: 'delivered',
      }),
      metadata: trackingMetadata,
    },
  })

  return trackingStatus
}

async function backfillTracking() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('❌ Error: Please provide a tenant ID')
    console.error('Usage: npx tsx backfill-tracking.ts <tenantId> [mode] [limit]')
    console.error('Example: npx tsx backfill-tracking.ts cm0abc123 test 10')
    process.exit(1)
  }

  const tenantId = args[0]
  const mode = (args[1] || 'test') as 'test' | 'production'
  const limit = args[2] ? parseInt(args[2]) : undefined

  console.log(`🔄 Backfilling tracking data for tenant: ${tenantId} (${mode} mode)`)
  if (limit) {
    console.log(`   📊 Limiting to ${limit} labels`)
  }
  console.log('')

  try {
    // Get ShipStation API key
    console.log('🔐 Fetching ShipStation API key from AWS Secrets Manager...')
    const apiKey = await getShipStationApiKey(tenantId, mode)
    console.log('✅ API key retrieved')
    console.log('')

    // Find labels without tracking data
    console.log('🔍 Finding labels without tracking data...')
    const labels = await db.shippingLabel.findMany({
      where: {
        tenantId: tenantId,
        provider: 'shipstation',
        status: 'active',
        OR: [
          { trackingStatus: null },
          { trackingStatus: 'unknown' },
          { lastTrackedAt: null },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      ...(limit && { take: limit }),
    })

    console.log(`📦 Found ${labels.length} labels to update`)
    console.log('')

    let updated = 0
    let notFound = 0
    let errors = 0

    for (const label of labels) {
      console.log(`📍 Processing ${label.trackingNumber} (${label.carrier})...`)

      // Fetch tracking data
      const trackingData = await fetchTrackingData(label.trackingNumber, label.carrier, apiKey)

      if (trackingData) {
        // Update label
        const status = await updateLabelTracking(label.id, trackingData)

        const lastEvent = trackingData.events[0]
        const location = lastEvent?.city_locality
          ? `${lastEvent.city_locality}, ${lastEvent.state_province}`
          : 'Unknown'

        console.log(`   ✅ Updated: ${status} - ${location}`)
        updated++
      } else {
        notFound++
      }

      // Rate limiting - wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log('')
    console.log('━'.repeat(50))
    console.log('📊 Summary:')
    console.log(`   ✅ Updated: ${updated}`)
    console.log(`   ⚠️  Not found: ${notFound}`)
    console.log(`   ❌ Errors: ${errors}`)
    console.log('━'.repeat(50))

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

backfillTracking()
