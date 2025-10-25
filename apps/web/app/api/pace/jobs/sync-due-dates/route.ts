import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPaceApiCredentials } from '@/lib/secrets'

export async function POST(request: Request) {
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== 'full_admin' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { jobs, dueDate } = body

    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json({ error: 'No jobs provided' }, { status: 400 })
    }

    if (!dueDate) {
      return NextResponse.json({ error: 'No due date provided' }, { status: 400 })
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

    // Convert the date input to ISO format for PACE
    // The input will be in format: "2025-01-15" (date only)
    // We'll set the time to 17:00 (5:00 PM) as a default due time
    // PACE expects ISO 8601 format: "2025-01-15T17:00:00.000Z"
    const dateObj = new Date(dueDate + 'T17:00:00')
    const dueDateISO = dateObj.toISOString()

    let successCount = 0
    let failedCount = 0
    const errors: string[] = []

    // Process each job
    for (const jobData of jobs) {
      const { jobNumber } = jobData

      if (!jobNumber) {
        failedCount++
        errors.push(`Job ${jobNumber}: Missing job number`)
        continue
      }

      try {
        // Update the Job's promiseDateTime field in PACE using UpdateObject
        const updateUrl = `${paceApiUrl}/UpdateObject/updateJob`

        // PACE Job object uses 'job' field as the primary key (not 'id')
        const updatePayload = {
          job: jobNumber.toString(), // job field is a string type in PACE
          promiseDateTime: dueDateISO
        }

        console.log(`Updating job ${jobNumber} due date:`, { url: updateUrl, payload: updatePayload })

        const updateResponse = await fetch(updateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')
          },
          body: JSON.stringify(updatePayload)
        })

        if (updateResponse.ok) {
          successCount++
          console.log(`✅ Updated job ${jobNumber} with promiseDateTime: ${dueDateISO}`)
        } else {
          const errorText = await updateResponse.text()
          failedCount++
          errors.push(`Job ${jobNumber}: ${errorText || 'Update failed'}`)
          console.error(`❌ Failed to update job ${jobNumber}:`, errorText)
        }
      } catch (err) {
        failedCount++
        errors.push(`Job ${jobNumber}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        console.error(`❌ Error updating job ${jobNumber}:`, err)
      }
    }

    return NextResponse.json({
      success: true,
      successCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Sync due dates error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
