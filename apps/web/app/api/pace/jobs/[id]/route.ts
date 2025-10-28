import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: {
        userId: session.user.id,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Await params before accessing properties
    const { id: jobNumber } = await params

    if (!jobNumber) {
      return NextResponse.json(
        { error: 'Job number is required' },
        { status: 400 }
      )
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
        { status: 400 }
      )
    }

    // Create Basic Auth header
    const auth = Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')

    // Fetch job details from PACE using ReadObject endpoint
    const jobUrl = `${paceApiUrl}/ReadObject/readJob?primaryKey=${encodeURIComponent(jobNumber)}`

    const jobRes = await fetch(jobUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    })

    if (!jobRes.ok) {
      if (jobRes.status === 404) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        )
      }
      throw new Error(`PACE API returned ${jobRes.status}`)
    }

    const jobData = await jobRes.json()

    // Enrich with customer name if we have customer ID
    if (jobData.customer) {
      try {
        const customerUrl = `${paceApiUrl}/ReadObject/readCustomer?primaryKey=${encodeURIComponent(jobData.customer)}`
        const customerRes = await fetch(customerUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        })

        if (customerRes.ok) {
          const customerData = await customerRes.json()
          jobData.customerName = customerData.name || customerData.custName
        }
      } catch (error) {
        // Continue without customer name if fetch fails
        console.error('Failed to fetch customer name:', error)
      }
    }

    // Enrich with job type description if we have jobType
    if (jobData.jobType) {
      try {
        const jobTypeUrl = `${paceApiUrl}/ReadObject/readJobType?primaryKey=${encodeURIComponent(jobData.jobType)}`
        const jobTypeRes = await fetch(jobTypeUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        })

        if (jobTypeRes.ok) {
          const jobTypeData = await jobTypeRes.json()
          jobData.jobTypeDescription = jobTypeData.description || jobTypeData.name
        }
      } catch (error) {
        // Continue without job type description if fetch fails
        console.error('Failed to fetch job type:', error)
      }
    }

    return NextResponse.json(jobData)
  } catch (error: any) {
    console.error('Error fetching job from PACE:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job from PACE' },
      { status: 500 }
    )
  }
}
