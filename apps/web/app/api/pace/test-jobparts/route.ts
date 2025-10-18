import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// GET /api/pace/test-jobparts - Test JobPart fetching
export async function GET(req: NextRequest) {
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

    const jobId = req.nextUrl.searchParams.get('jobId') || '112823'

    // Get PACE API credentials
    const credentials = await getPaceApiCredentials()
    const paceApiUrl = credentials.url
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    console.log(`Testing JobPart fetch for job ${jobId}`)

    // Try fetching JobParts
    const url = `${paceApiUrl}/FindObjects/findSortAndLimit?${new URLSearchParams({
      type: 'JobPart',
      xpath: `@job=${jobId}`,
      offset: '0',
      limit: '1000',
    })}`

    console.log('Request URL:', url)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ xpath: '@jobPart', descending: false }]),
    })

    console.log('Response status:', response.status)
    const responseText = await response.text()
    console.log('Response body:', responseText)

    let data
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse JSON',
        status: response.status,
        rawResponse: responseText,
      })
    }

    return NextResponse.json({
      success: true,
      jobId,
      url,
      status: response.status,
      data,
      count: Array.isArray(data) ? data.length : 0,
    })
  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
