import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// GET /api/pace/job-statuses - Fetch all JobStatus records from PACE
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const credentials = await getPaceApiCredentials()
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    // Find all JobStatus IDs
    const queryParams = new URLSearchParams({
      type: 'JobStatus',
      xpath: '@adminToProduction = "true"',
      offset: '0',
      limit: '200',
    })

    const queryUrl = `${credentials.url}/FindObjects/findSortAndLimit?${queryParams.toString()}`
    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([]),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch job statuses' }, { status: 500 })
    }

    const statusIds: string[] = await response.json()

    // Read each status to get description
    const statuses = await Promise.all(
      statusIds.map(async (id) => {
        try {
          const res = await fetch(
            `${credentials.url}/ReadObject/readJobStatus?primaryKey=${encodeURIComponent(id)}`,
            {
              method: 'POST',
              headers: { 'Accept': 'application/json', 'Authorization': authHeader },
              body: '',
            }
          )
          if (res.ok) {
            const data = await res.json()
            return { id: String(data.id), description: data.description || String(data.id) }
          }
        } catch {
          // ignore
        }
        return { id, description: id }
      })
    )

    // Sort by ID
    statuses.sort((a, b) => a.id.localeCompare(b.id))

    return NextResponse.json({ success: true, data: statuses })
  } catch (error) {
    console.error('[Job Statuses] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
