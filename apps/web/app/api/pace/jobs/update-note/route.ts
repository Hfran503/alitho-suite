import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPaceApiCredentials } from '@/lib/secrets'

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { jobNumber, note } = body

    if (!jobNumber) {
      return NextResponse.json({ error: 'Job number is required' }, { status: 400 })
    }

    // Get PACE API credentials
    let paceApiUrl: string
    let paceUsername: string
    let pacePassword: string

    try {
      const credentials = await getPaceApiCredentials()
      paceApiUrl = credentials.url
      paceUsername = credentials.username
      pacePassword = credentials.password
    } catch (error) {
      console.error('Failed to get PACE API credentials:', error)
      return NextResponse.json(
        { error: 'PACE API not configured' },
        { status: 500 }
      )
    }

    // Update the Job's U_calithoSuite_note field in PACE using UpdateObject
    const updateUrl = `${paceApiUrl}/UpdateObject/updateJob`

    // PACE Job object uses 'job' field as the primary key (not 'id')
    // Note: U_calithoSuite_note must be enabled in PACE REST API configuration first
    const updatePayload = {
      job: jobNumber.toString(),
      U_calithoSuite_note: note || '' // Use empty string if note is null/undefined
    }

    console.log(`Updating job ${jobNumber} note:`, { url: updateUrl, payload: updatePayload })

    const updateResponse = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')
      },
      body: JSON.stringify(updatePayload)
    })

    // Log response details
    console.log(`PACE Response Status: ${updateResponse.status} ${updateResponse.statusText}`)

    const responseText = await updateResponse.text()
    console.log(`PACE Response Body:`, responseText)

    if (updateResponse.ok) {
      // Try to parse the response to see what PACE actually returned
      let responseData
      try {
        responseData = JSON.parse(responseText)
        console.log(`✅ Updated job ${jobNumber} note - Response data:`, responseData)

        // Check if the field appears in the response
        if (responseData.calithoSuite_note !== undefined) {
          console.log(`✅ Field calithoSuite_note is present in response:`, responseData.calithoSuite_note)
        } else {
          console.log(`⚠️ Field calithoSuite_note NOT found in response. Trying to read job directly...`)

          // Try reading the job directly to verify the update
          const readUrl = `${paceApiUrl}/ReadObject/readJob?primaryKey=${encodeURIComponent(jobNumber)}`
          const readResponse = await fetch(readUrl, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Basic ' + Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')
            },
            body: ''
          })

          if (readResponse.ok) {
            const readData = await readResponse.json()
            console.log(`Read job ${jobNumber} - Checking for note field...`)

            // Check all possible variations
            const possibleFields = [
              'calithoSuite_note', // Source File Name - try this first
              'U_calithoSuite_note', // Attribute name
              'u_calithosuite_note', // Database name (lowercase)
              'u_calithoSuite_note', // Database name with camelCase
              'calithosuite_note' // All lowercase
            ]

            for (const field of possibleFields) {
              if (readData[field] !== undefined) {
                console.log(`✅ Found field "${field}" with value:`, readData[field])
              }
            }
          }
        }
      } catch (e) {
        console.log(`✅ Updated job ${jobNumber} note - Response was not JSON:`, responseText)
      }

      return NextResponse.json({
        success: true,
        message: 'Note updated successfully',
        paceResponse: responseData || responseText
      })
    } else {
      console.error(`❌ Failed to update job ${jobNumber} note:`, responseText)
      return NextResponse.json(
        { error: `Failed to update note: ${responseText}` },
        { status: updateResponse.status }
      )
    }
  } catch (error) {
    console.error('Update note error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
