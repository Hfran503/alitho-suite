/**
 * Script to remove specific CartonContent entries from all cartons for a job
 *
 * This script will:
 * 1. Find all JobShipments for the specified job
 * 2. For each shipment, find all cartons
 * 3. For each carton, find CartonContent with the specified JobProduct
 * 4. Delete those CartonContent entries
 *
 * Usage: npx tsx scripts/remove-carton-content.ts
 */

import { getPaceApiCredentials } from '@repo/shared'

// Configuration - Update these values as needed
const JOB_ID = '1002849'
const JOB_PRODUCT_ID_TO_REMOVE = 65924

interface CartonContent {
  id: number
  carton: number
  jobProduct?: number
  quantity?: number
  [key: string]: any
}

async function main() {
  console.log('='.repeat(70))
  console.log(`🗑️  Removing CartonContent with JobProduct ${JOB_PRODUCT_ID_TO_REMOVE}`)
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
    let totalContentsFound = 0
    let successCount = 0
    let errorCount = 0

    // Step 2: Process each shipment
    for (let i = 0; i < shipmentIds.length; i++) {
      const shipmentId = shipmentIds[i]

      // Only log every 50 shipments to reduce noise
      if (i % 50 === 0) {
        console.log(`\n[${i + 1}/${shipmentIds.length}] Processing shipments...`)
      }

      try {
        // Find all cartons for this shipment
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
          continue
        }

        const cartonIds: string[] = await findCartonsResponse.json()

        if (!cartonIds || cartonIds.length === 0) {
          continue
        }

        totalCartons += cartonIds.length

        // Step 3: For each carton, find and delete CartonContent with the specified JobProduct
        for (const cartonId of cartonIds) {
          try {
            // Find CartonContent for this carton with the specified jobProduct
            const contentXpath = `@carton=${cartonId} and @jobProduct=${JOB_PRODUCT_ID_TO_REMOVE}`
            const contentQueryParams = new URLSearchParams({
              type: 'CartonContent',
              xpath: contentXpath,
              offset: '0',
              limit: '100',
            })

            const findContentUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${contentQueryParams.toString()}`

            const findContentResponse = await fetch(findContentUrl, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Authorization': authHeader,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify([]),
            })

            if (!findContentResponse.ok) {
              continue
            }

            const contentIds: string[] = await findContentResponse.json()

            if (!contentIds || contentIds.length === 0) {
              continue
            }

            totalContentsFound += contentIds.length

            // Delete each content entry
            for (const contentId of contentIds) {
              try {
                const deleteUrl = `${paceApiUrl}/DeleteObject/DeleteObject?${new URLSearchParams({
                  type: 'CartonContent',
                  key: contentId,
                }).toString()}`

                const deleteResponse = await fetch(deleteUrl, {
                  method: 'DELETE',
                  headers: {
                    'Accept': 'application/json',
                    'Authorization': authHeader,
                  },
                })

                if (deleteResponse.ok) {
                  successCount++
                  if (successCount % 50 === 0) {
                    console.log(`  ✅ Deleted ${successCount} CartonContent entries...`)
                  }
                } else {
                  errorCount++
                  const errorText = await deleteResponse.text()
                  console.error(`  ❌ Failed to delete CartonContent ${contentId}: ${errorText}`)
                }
              } catch (deleteError) {
                errorCount++
                console.error(`  ❌ Error deleting CartonContent ${contentId}:`, deleteError instanceof Error ? deleteError.message : deleteError)
              }
            }
          } catch (cartonError) {
            // Silently continue on carton errors
          }
        }
      } catch (shipmentError) {
        // Silently continue on shipment errors
      }
    }

    // Summary
    console.log('\n' + '='.repeat(70))
    console.log('📊 SUMMARY')
    console.log('='.repeat(70))
    console.log(`Job: ${JOB_ID}`)
    console.log(`JobProduct to remove: ${JOB_PRODUCT_ID_TO_REMOVE}`)
    console.log('-'.repeat(70))
    console.log(`Total Shipments: ${shipmentIds.length}`)
    console.log(`Total Cartons Checked: ${totalCartons}`)
    console.log(`CartonContent entries found: ${totalContentsFound}`)
    console.log('-'.repeat(70))
    console.log(`✅ Successfully deleted: ${successCount}`)
    console.log(`❌ Errors: ${errorCount}`)
    console.log('='.repeat(70))

    if (errorCount === 0 && successCount > 0) {
      console.log('\n🎉 All CartonContent entries removed successfully!')
    } else if (successCount > 0) {
      console.log('\n⚠️  Some entries had errors. Check the logs above for details.')
    } else if (totalContentsFound === 0) {
      console.log('\n⚠️  No CartonContent entries found with the specified JobProduct.')
    } else {
      console.log('\n❌ Failed to remove any entries.')
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
