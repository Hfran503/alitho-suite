/**
 * Script to add product content to ALL EXISTING cartons for a specific job
 *
 * This script will:
 * 1. Find all JobShipments for the specified job
 * 2. For each shipment, find all existing cartons
 * 3. For each carton, add CartonContent with the specified JobProduct and quantity
 *
 * Usage: npx tsx scripts/add-content-to-existing-cartons.ts
 */

import { getPaceApiCredentials } from '@repo/shared'

// Configuration - Update these values as needed
const JOB_ID = '1003073'
const JOB_PRODUCT_ID = 66710
const QUANTITY = 1

interface JobShipment {
  id: number
  job: string
  shipmentNumber?: string
  [key: string]: any
}

interface Carton {
  id: number
  shipment: number
  trackingNumber?: string
  [key: string]: any
}

async function main() {
  console.log('='.repeat(70))
  console.log(`🚀 Adding JobProduct ${JOB_PRODUCT_ID} (Qty: ${QUANTITY}) to existing cartons`)
  console.log(`   Job: ${JOB_ID}`)
  console.log('='.repeat(70))
  console.log('')

  try {
    // Get PACE API credentials
    const credentials = await getPaceApiCredentials()
    const paceApiUrl = credentials.url
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    console.log(`📡 Connected to PACE API: ${paceApiUrl}\n`)

    // Step 1: Find all JobShipments for the specified job
    console.log(`🔍 Finding all shipments for Job ${JOB_ID}...`)

    const shipmentXpath = `@job=${JOB_ID}`
    const shipmentQueryParams = new URLSearchParams({
      type: 'JobShipment',
      xpath: shipmentXpath,
      offset: '0',
      limit: '1000',
    })

    const findShipmentsUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${shipmentQueryParams.toString()}`

    const findShipmentsResponse = await fetch(findShipmentsUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([]),
    })

    if (!findShipmentsResponse.ok) {
      const errorText = await findShipmentsResponse.text()
      throw new Error(`Failed to find shipments: ${findShipmentsResponse.status} ${errorText}`)
    }

    const shipmentIds: string[] = await findShipmentsResponse.json()

    if (!shipmentIds || shipmentIds.length === 0) {
      console.log(`⚠️  No shipments found for Job ${JOB_ID}`)
      return
    }

    console.log(`✅ Found ${shipmentIds.length} shipment(s) for Job ${JOB_ID}\n`)

    // Track totals
    let totalCartons = 0
    let successCount = 0
    let errorCount = 0
    let skippedCount = 0

    // Step 2: Process each shipment
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
          shipmentInfo = shipment.shipmentNumber ? ` (Shipment #${shipment.shipmentNumber})` : ''
        }

        // Find all cartons for this shipment
        console.log(`  🔍 Finding cartons for shipment ${shipmentId}${shipmentInfo}...`)

        const cartonXpath = `@shipment=${shipmentId}`
        const cartonQueryParams = new URLSearchParams({
          type: 'Carton',
          xpath: cartonXpath,
          offset: '0',
          limit: '1000',
        })

        const findCartonsUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${cartonQueryParams.toString()}`

        const findCartonsResponse = await fetch(findCartonsUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([]),
        })

        if (!findCartonsResponse.ok) {
          const errorText = await findCartonsResponse.text()
          throw new Error(`Failed to find cartons: ${findCartonsResponse.status} ${errorText}`)
        }

        const cartonIds: string[] = await findCartonsResponse.json()

        if (!cartonIds || cartonIds.length === 0) {
          console.log(`  ⚠️  No cartons found for shipment ${shipmentId}`)
          skippedCount++
          continue
        }

        console.log(`  📦 Found ${cartonIds.length} carton(s)`)
        totalCartons += cartonIds.length

        // Step 3: Add content to each carton
        for (let j = 0; j < cartonIds.length; j++) {
          const cartonId = cartonIds[j]

          try {
            // Read carton details for logging
            const readCartonUrl = `${paceApiUrl}/ReadObject/readCarton?primaryKey=${cartonId}`
            const cartonResponse = await fetch(readCartonUrl, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Authorization': authHeader,
              },
              body: '',
            })

            let cartonInfo = ''
            if (cartonResponse.ok) {
              const carton: Carton = await cartonResponse.json()
              cartonInfo = carton.trackingNumber ? ` (Tracking: ${carton.trackingNumber})` : ''
            }

            console.log(`    [${j + 1}/${cartonIds.length}] Adding content to Carton ${cartonId}${cartonInfo}...`)

            // Create carton content
            const contentData = {
              carton: parseInt(cartonId),
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
            console.log(`    ✅ Created CartonContent ID: ${contentResult.id}`)
            successCount++
          } catch (cartonError) {
            errorCount++
            console.error(`    ❌ Error adding content to carton ${cartonId}:`, cartonError instanceof Error ? cartonError.message : cartonError)
          }
        }
      } catch (shipmentError) {
        console.error(`  ❌ Error processing shipment ${shipmentId}:`, shipmentError instanceof Error ? shipmentError.message : shipmentError)
      }
    }

    // Summary
    console.log('\n' + '='.repeat(70))
    console.log('📊 SUMMARY')
    console.log('='.repeat(70))
    console.log(`Job: ${JOB_ID}`)
    console.log(`JobProduct: ${JOB_PRODUCT_ID}`)
    console.log(`Quantity per carton: ${QUANTITY}`)
    console.log('-'.repeat(70))
    console.log(`Total Shipments: ${shipmentIds.length}`)
    console.log(`Total Cartons Found: ${totalCartons}`)
    console.log(`Shipments with no cartons (skipped): ${skippedCount}`)
    console.log('-'.repeat(70))
    console.log(`✅ Successfully added content: ${successCount}`)
    console.log(`❌ Errors: ${errorCount}`)
    console.log('='.repeat(70))

    if (errorCount === 0 && successCount > 0) {
      console.log('\n🎉 All cartons updated successfully!')
    } else if (successCount > 0) {
      console.log('\n⚠️  Some cartons had errors. Check the logs above for details.')
    } else if (totalCartons === 0) {
      console.log('\n⚠️  No cartons found to update.')
    } else {
      console.log('\n❌ Failed to update any cartons.')
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
