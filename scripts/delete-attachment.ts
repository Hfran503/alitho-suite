/**
 * Script to delete a problematic attachment from a PACE Job
 *
 * Error: Unable to locate object: FileAttachment (p4nriBQhnYa238rxdpOKiA==)
 * Job: 111860
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
config({ path: resolve(__dirname, '../apps/web/.env.local') })
config({ path: resolve(__dirname, '../.env') })

async function getPaceConfig() {
  // Try AWS Secrets Manager first, fall back to env vars
  const url = process.env.PACE_API_URL
  const username = process.env.PACE_API_USERNAME
  const password = process.env.PACE_API_PASSWORD

  if (!url || !username || !password) {
    throw new Error('PACE API credentials not found in environment variables')
  }

  return { apiUrl: url, username, password }
}

function getAuthHeader(config: { username: string; password: string }): string {
  return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`
}

async function main() {
  const JOB_NUMBER = '111860'
  const ATTACHMENT_KEY = 'p4nriBQhnYa238rxdpOKiA=='

  console.log(`\n🔍 Checking Job ${JOB_NUMBER} and attempting to delete attachment...`)
  console.log(`   Attachment Key: ${ATTACHMENT_KEY}\n`)

  try {
    const paceConfig = await getPaceConfig()
    const authHeader = getAuthHeader(paceConfig)

    // Step 1: Verify the job exists
    console.log('Step 1: Verifying job exists...')
    const jobUrl = `${paceConfig.apiUrl}/ReadObject/readJob?primaryKey=${JOB_NUMBER}`
    const jobResponse = await fetch(jobUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
      body: '',
    })

    if (!jobResponse.ok) {
      const errorText = await jobResponse.text()
      console.log(`❌ Failed to read job: ${jobResponse.status} - ${errorText}`)
      return
    }

    const jobData = await jobResponse.json() as Record<string, any>
    console.log(`✅ Job ${JOB_NUMBER} found:`)
    console.log(`   Description: ${jobData.description || 'N/A'}`)
    console.log(`   Customer: ${jobData.customer || 'N/A'}`)
    console.log(`   Status: ${jobData.adminStatus || 'N/A'}\n`)

    // Step 2: Get all attachments for this job
    console.log('Step 2: Getting all attachments for this job...')
    const attachmentsUrl = `${paceConfig.apiUrl}/AttachmentService/getAllAttachments?type=Job&pKey=${JOB_NUMBER}`
    const attachmentsResponse = await fetch(attachmentsUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
    })

    if (!attachmentsResponse.ok) {
      const errorText = await attachmentsResponse.text()
      console.log(`⚠️  Failed to get attachments: ${attachmentsResponse.status} - ${errorText}`)
      console.log('   Will still try to delete the attachment by key...\n')
    } else {
      const attachments = await attachmentsResponse.json()
      console.log(`   Found ${Array.isArray(attachments) ? attachments.length : 0} attachment(s)`)
      if (Array.isArray(attachments) && attachments.length > 0) {
        attachments.forEach((att: any, i: number) => {
          console.log(`   [${i + 1}] Key: ${att.attachmentKey || 'N/A'}, Name: ${att.name || 'N/A'}`)
        })
      }
      console.log('')
    }

    // Step 3: Try to delete the attachment by key
    console.log('Step 3: Attempting to delete attachment by key...')
    const deleteUrl = `${paceConfig.apiUrl}/AttachmentService/removeAttachmentFromKey?attachmentKey=${encodeURIComponent(ATTACHMENT_KEY)}`

    console.log(`   DELETE URL: ${deleteUrl}`)

    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
    })

    const deleteText = await deleteResponse.text()

    if (deleteResponse.ok) {
      console.log(`✅ Attachment deleted successfully!`)
      console.log(`   Response: ${deleteText || 'No response body'}`)
    } else {
      console.log(`❌ Failed to delete attachment: ${deleteResponse.status}`)
      console.log(`   Response: ${deleteText}`)

      // If direct delete fails, try finding the FileAttachment object and deleting it
      console.log('\n🔄 Trying alternative approach: Finding FileAttachment by key...')

      // Try to read the FileAttachment object directly
      const readFileAttachmentUrl = `${paceConfig.apiUrl}/ReadObject/readFileAttachment?primaryKey=${encodeURIComponent(ATTACHMENT_KEY)}`
      const readResponse = await fetch(readFileAttachmentUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: '',
      })

      if (readResponse.ok) {
        const fileAttachment = await readResponse.json()
        console.log(`   Found FileAttachment: ${JSON.stringify(fileAttachment, null, 2)}`)
      } else {
        console.log(`   Could not read FileAttachment: ${await readResponse.text()}`)
      }
    }

    console.log('\n--- Done ---\n')

  } catch (error) {
    console.error('Error:', error)
  }
}

main()
