/**
 * Script to update the adminStatus of a Job on PACE
 *
 * This script will:
 * 1. Read the current job to get its current adminStatus
 * 2. Update the adminStatus to the specified new value
 *
 * Usage: npx tsx scripts/update-job-admin-status.ts <jobNumber> <newStatus>
 * Example: npx tsx scripts/update-job-admin-status.ts 1002303 X
 */

import { getPaceApiCredentials } from '@repo/shared'

interface JobData {
  job: string
  adminStatus?: string
  adminStatusDescription?: string
  description?: string
  customer?: string
  [key: string]: any
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.log('Usage: npx tsx scripts/update-job-admin-status.ts <jobNumber> <newStatus>')
    console.log('Example: npx tsx scripts/update-job-admin-status.ts 1002303 X')
    process.exit(1)
  }

  const jobNumber = args[0]
  const newStatus = args[1]

  console.log('🚀 Starting Job adminStatus update script...\n')
  console.log(`📋 Job Number: ${jobNumber}`)
  console.log(`🎯 Target adminStatus: ${newStatus}\n`)

  try {
    // Get PACE API credentials
    const credentials = await getPaceApiCredentials()
    const paceApiUrl = credentials.url
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    console.log(`📡 Connected to PACE API: ${paceApiUrl}\n`)

    // Step 1: Read current job data
    console.log(`🔍 Reading current Job ${jobNumber}...`)

    const readJobUrl = `${paceApiUrl}/ReadObject/readJob?primaryKey=${jobNumber}`
    const readResponse = await fetch(readJobUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: '',
    })

    if (!readResponse.ok) {
      const errorText = await readResponse.text()
      throw new Error(`Failed to read job: ${readResponse.status} ${errorText}`)
    }

    const jobData: JobData = await readResponse.json()

    console.log(`✅ Found Job ${jobNumber}`)
    console.log(`   Description: ${jobData.description || 'N/A'}`)
    console.log(`   Customer: ${jobData.customer || 'N/A'}`)
    console.log(`   Current adminStatus: ${jobData.adminStatus || 'N/A'}`)
    if (jobData.adminStatusDescription) {
      console.log(`   Current adminStatus Description: ${jobData.adminStatusDescription}`)
    }
    console.log('')

    // Step 2: Update the adminStatus
    console.log(`📝 Updating adminStatus from "${jobData.adminStatus || 'N/A'}" to "${newStatus}"...`)

    const updatePayload = {
      job: jobNumber,
      adminStatus: newStatus,
    }

    const updateUrl = `${paceApiUrl}/UpdateObject/updateJob`
    const updateResponse = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    })

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text()
      throw new Error(`Failed to update job: ${updateResponse.status} ${errorText}`)
    }

    const updateResult = await updateResponse.json()
    console.log(`✅ Update response:`, JSON.stringify(updateResult, null, 2))

    // Step 3: Verify the update by reading again
    console.log(`\n🔍 Verifying update...`)

    const verifyResponse = await fetch(readJobUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: '',
    })

    if (verifyResponse.ok) {
      const updatedJob: JobData = await verifyResponse.json()
      console.log(`✅ Verified Job ${jobNumber}`)
      console.log(`   New adminStatus: ${updatedJob.adminStatus || 'N/A'}`)
      if (updatedJob.adminStatusDescription) {
        console.log(`   New adminStatus Description: ${updatedJob.adminStatusDescription}`)
      }

      if (updatedJob.adminStatus === newStatus) {
        console.log(`\n🎉 Successfully updated adminStatus to "${newStatus}"!`)
      } else {
        console.log(`\n⚠️  adminStatus is "${updatedJob.adminStatus}" (expected "${newStatus}")`)
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})
