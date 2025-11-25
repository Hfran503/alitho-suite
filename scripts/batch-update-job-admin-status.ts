/**
 * Batch script to update the adminStatus of multiple Jobs from an Excel file
 *
 * This script will:
 * 1. Read job numbers from an Excel file (expects a "Job" column)
 * 2. Update each job's adminStatus to the specified value
 *
 * Usage: npx tsx scripts/batch-update-job-admin-status.ts <excelFile> <newStatus>
 * Example: npx tsx scripts/batch-update-job-admin-status.ts "Atlassian - Open Orders (1).xlsx" X
 */

import { getPaceApiCredentials } from '@repo/shared'
import * as XLSX from 'xlsx'
import * as path from 'path'

interface JobRow {
  Job: string
}

interface UpdateResult {
  job: string
  success: boolean
  previousStatus?: string
  newStatus?: string
  error?: string
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.log('Usage: npx tsx scripts/batch-update-job-admin-status.ts <excelFile> <newStatus>')
    console.log('Example: npx tsx scripts/batch-update-job-admin-status.ts "Atlassian - Open Orders (1).xlsx" X')
    process.exit(1)
  }

  const excelFile = args[0]
  const newStatus = args[1]

  console.log('🚀 Starting Batch Job adminStatus update script...\n')

  // Resolve the file path
  const filePath = path.isAbsolute(excelFile) ? excelFile : path.join(process.cwd(), excelFile)

  console.log(`📁 Excel file: ${filePath}`)
  console.log(`🎯 Target adminStatus: ${newStatus}\n`)

  try {
    // Read Excel file
    console.log('📖 Reading Excel file...')
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const data: JobRow[] = XLSX.utils.sheet_to_json(sheet)

    if (!data || data.length === 0) {
      console.log('⚠️  No data found in Excel file')
      process.exit(1)
    }

    const jobNumbers = data.map((row) => row.Job?.toString()).filter(Boolean)
    console.log(`✅ Found ${jobNumbers.length} jobs to update\n`)

    // Get PACE API credentials
    const credentials = await getPaceApiCredentials()
    const paceApiUrl = credentials.url
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    console.log(`📡 Connected to PACE API: ${paceApiUrl}\n`)
    console.log('='.repeat(70))

    const results: UpdateResult[] = []
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < jobNumbers.length; i++) {
      const jobNumber = jobNumbers[i]
      const progress = `[${i + 1}/${jobNumbers.length}]`

      try {
        // Read current job
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

        const jobData = await readResponse.json()
        const previousStatus = jobData.adminStatus || 'N/A'

        // Update the adminStatus
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

        console.log(`${progress} ✅ Job ${jobNumber}: ${previousStatus} → ${newStatus}`)
        results.push({
          job: jobNumber,
          success: true,
          previousStatus,
          newStatus,
        })
        successCount++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.log(`${progress} ❌ Job ${jobNumber}: ${errorMessage}`)
        results.push({
          job: jobNumber,
          success: false,
          error: errorMessage,
        })
        errorCount++
      }

      // Small delay to avoid overwhelming the API
      if (i < jobNumbers.length - 1) {
        await sleep(100)
      }
    }

    // Summary
    console.log('\n' + '='.repeat(70))
    console.log('📊 SUMMARY')
    console.log('='.repeat(70))
    console.log(`Total Jobs: ${jobNumbers.length}`)
    console.log(`✅ Successfully updated: ${successCount}`)
    console.log(`❌ Errors: ${errorCount}`)
    console.log('='.repeat(70))

    if (errorCount > 0) {
      console.log('\n❌ Failed jobs:')
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`   - ${r.job}: ${r.error}`)
        })
    }

    if (successCount === jobNumbers.length) {
      console.log('\n🎉 All jobs updated successfully!')
    } else if (successCount > 0) {
      console.log('\n⚠️  Some jobs had errors. Check the logs above for details.')
    } else {
      console.log('\n❌ Failed to update any jobs.')
      process.exit(1)
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})
