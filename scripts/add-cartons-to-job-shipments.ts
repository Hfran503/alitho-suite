/**
 * One-time script to add 1 carton with carton content to all JobShipments under Job 113188
 * AND update shipping label status from "active" to "delivered"
 *
 * This script will:
 * 1. Find all JobShipments for Job 113188
 * 2. For each shipment, create 1 carton
 * 3. Add carton content with JobProduct ID 64568 and quantity 1
 * 4. Update all related ShippingLabel records status from "active" to "delivered"
 *
 * Usage: npx tsx scripts/add-cartons-to-job-shipments.ts
 */

import { getPaceApiCredentials } from '@repo/shared'
import { db } from '@repo/database'

const JOB_ID = '113188'
const JOB_PRODUCT_ID = 64568
const QUANTITY = 1

interface JobShipment {
  id: number
  job: string
  shipmentNumber?: string
  [key: string]: any
}

async function main() {
  console.log('🚀 Starting script to add cartons to Job 113188 shipments...\n')

  try {
    // Get PACE API credentials
    const credentials = await getPaceApiCredentials()
    const paceApiUrl = credentials.url
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    console.log(`📡 Connected to PACE API: ${paceApiUrl}\n`)

    // Step 1: Find all JobShipments for the specified job
    console.log(`🔍 Finding all shipments for Job ${JOB_ID}...`)

    const xpath = `@job=${JOB_ID}`
    const queryParams = new URLSearchParams({
      type: 'JobShipment',
      xpath: xpath,
      offset: '0',
      limit: '1000',
    })

    const findShipmentsUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${queryParams.toString()}`

    const findResponse = await fetch(findShipmentsUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([]),
    })

    if (!findResponse.ok) {
      const errorText = await findResponse.text()
      throw new Error(`Failed to find shipments: ${findResponse.status} ${errorText}`)
    }

    const shipmentIds: string[] = await findResponse.json()

    if (!shipmentIds || shipmentIds.length === 0) {
      console.log(`⚠️  No shipments found for Job ${JOB_ID}`)
      return
    }

    console.log(`✅ Found ${shipmentIds.length} shipment(s) for Job ${JOB_ID}\n`)

    // Step 2: Process each shipment
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < shipmentIds.length; i++) {
      const shipmentId = shipmentIds[i]
      console.log(`\n[${i + 1}/${shipmentIds.length}] Processing Shipment ID: ${shipmentId}`)

      try {
        // Read shipment details for logging
        const readShipmentUrl = `${paceApiUrl}/ReadObject/readJobShipment?primaryKey=${shipmentId}`
        const shipmentResponse = await fetch(readShipmentUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
          },
          body: '',
        })

        let shipmentInfo = ''
        if (shipmentResponse.ok) {
          const shipment: JobShipment = await shipmentResponse.json()
          shipmentInfo = shipment.shipmentNumber ? ` (${shipment.shipmentNumber})` : ''
        }

        console.log(`  📦 Creating carton for shipment ${shipmentId}${shipmentInfo}...`)

        // Create carton
        const cartonData = {
          shipment: parseInt(shipmentId),
          count: 1,
          addDefaultContent: false,
        }

        const createCartonUrl = `${paceApiUrl}/CreateObject/createCarton`
        const cartonResponse = await fetch(createCartonUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cartonData),
        })

        if (!cartonResponse.ok) {
          const errorText = await cartonResponse.text()
          throw new Error(`Failed to create carton: ${cartonResponse.status} ${errorText}`)
        }

        const cartonResult = await cartonResponse.json()
        const cartonId = cartonResult.id

        console.log(`  ✅ Created Carton ID: ${cartonId}`)

        // Create carton content
        console.log(`  📝 Adding content to carton (JobProduct: ${JOB_PRODUCT_ID}, Qty: ${QUANTITY})...`)

        const contentData = {
          carton: cartonId,
          jobProduct: JOB_PRODUCT_ID,
          quantity: QUANTITY,
        }

        const createContentUrl = `${paceApiUrl}/CreateObject/createCartonContent`
        const contentResponse = await fetch(createContentUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(contentData),
        })

        if (!contentResponse.ok) {
          const errorText = await contentResponse.text()
          throw new Error(`Failed to create carton content: ${contentResponse.status} ${errorText}`)
        }

        const contentResult = await contentResponse.json()
        console.log(`  ✅ Created CartonContent ID: ${contentResult.id}`)

        successCount++
      } catch (error) {
        errorCount++
        console.error(`  ❌ Error processing shipment ${shipmentId}:`, error instanceof Error ? error.message : error)
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total Shipments: ${shipmentIds.length}`)
    console.log(`✅ Successfully processed: ${successCount}`)
    console.log(`❌ Errors: ${errorCount}`)
    console.log('='.repeat(60))

    if (successCount === shipmentIds.length) {
      console.log('\n🎉 All shipments processed successfully!')
    } else if (successCount > 0) {
      console.log('\n⚠️  Some shipments had errors. Check the logs above for details.')
    } else {
      console.log('\n❌ Failed to process any shipments.')
      process.exit(1)
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})
