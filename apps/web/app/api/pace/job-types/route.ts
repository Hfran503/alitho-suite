import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// GET /api/pace/job-types - Fetch all JobTypes from PACE
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
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
        {
          error: 'PACE API not configured',
          message: error instanceof Error ? error.message : 'Failed to get PACE API credentials'
        },
        { status: 500 }
      )
    }

    // Prepare Basic Auth header
    const authHeader = `Basic ${Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')}`

    // Query all JobTypes
    const queryParams = new URLSearchParams({
      type: 'JobType',
      xpath: '@id > 0', // Get all job types
      offset: '0',
      limit: '1000',
    })

    const paceUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${queryParams.toString()}`

    // Sort by ID ascending
    const requestBody = [{ xpath: '@id', descending: false }]

    const response = await fetch(paceUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PACE API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch job types from PACE API', details: errorText },
        { status: response.status }
      )
    }

    const jobTypeIds: number[] = await response.json()
    console.log(`Found ${jobTypeIds.length} job types`)

    // Fetch details for each job type
    const fetchJobTypeDetail = async (id: number) => {
      try {
        const detailResponse = await fetch(
          `${paceApiUrl}/ReadObject/readJobType?primaryKey=${encodeURIComponent(id)}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )

        if (detailResponse.ok) {
          const jobTypeDetail = await detailResponse.json()
          return {
            id: jobTypeDetail.id,
            description: jobTypeDetail.description || `Job Type ${id}`,
            active: jobTypeDetail.active !== false, // Default to true if not specified
          }
        }
      } catch (err) {
        console.error(`Error fetching job type ${id}:`, err)
      }
      return null
    }

    // Fetch in batches
    const batchSize = 50
    const jobTypes: any[] = []

    for (let i = 0; i < jobTypeIds.length; i += batchSize) {
      const batch = jobTypeIds.slice(i, i + batchSize)
      const batchResults = await Promise.all(batch.map(fetchJobTypeDetail))

      for (const result of batchResults) {
        if (result) {
          jobTypes.push(result)
        }
      }

      console.log(`Processed ${Math.min(i + batchSize, jobTypeIds.length)}/${jobTypeIds.length} job types...`)
    }

    // Sort by description
    jobTypes.sort((a, b) => a.description.localeCompare(b.description))

    return NextResponse.json({
      success: true,
      data: {
        items: jobTypes,
        total: jobTypes.length,
      },
    })
  } catch (error) {
    console.error('Get job types error:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
