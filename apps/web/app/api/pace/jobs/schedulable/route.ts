import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// GET /api/pace/jobs/schedulable?departmentId=xxx - Fetch schedulable jobs for a department
export async function GET(request: Request) {
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

    // Get departmentId from query params
    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')

    if (!departmentId) {
      return NextResponse.json(
        { error: 'departmentId is required' },
        { status: 400 }
      )
    }

    // Verify department belongs to tenant and get job types
    const department = await db.department.findFirst({
      where: {
        id: departmentId,
        tenantId: membership.tenantId,
      },
      include: {
        jobTypes: true,
      },
    })

    if (!department) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      )
    }

    if (department.jobTypes.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          total: 0,
          message: 'No job types assigned to this department',
        },
      })
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

    // Step 1: Find all JobStatus IDs with statusType != 5 (active jobs)
    console.log('Finding JobStatus IDs with statusType != 5...')

    const jobStatusQueryParams = new URLSearchParams({
      type: 'JobStatus',
      xpath: '@statusType != 5',
      offset: '0',
      limit: '100',
    })

    const jobStatusUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${jobStatusQueryParams.toString()}`

    const jobStatusResponse = await fetch(jobStatusUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([]),
    })

    if (!jobStatusResponse.ok) {
      const errorText = await jobStatusResponse.text()
      console.error('JobStatus API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch JobStatus from PACE API', details: errorText },
        { status: jobStatusResponse.status }
      )
    }

    const jobStatusIds: string[] = await jobStatusResponse.json()
    console.log(`Found ${jobStatusIds.length} JobStatus IDs with statusType != 5`)

    if (jobStatusIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          total: 0,
        },
      })
    }

    // Step 2: Build XPath for jobs matching department job types
    const jobTypeIds = department.jobTypes.map((jt: typeof department.jobTypes[number]) => jt.paceJobTypeId)
    const jobTypeConditions = jobTypeIds.map((id: number) => `@jobType = ${id}`).join(' or ')
    const statusConditions = jobStatusIds.map((id: string) => `@adminStatus = '${id}'`).join(' or ')

    const statusXPath = jobStatusIds.length === 1
      ? `@adminStatus = '${jobStatusIds[0]}'`
      : `(${statusConditions})`

    const jobTypeXPath = jobTypeIds.length === 1
      ? `@jobType = ${jobTypeIds[0]}`
      : `(${jobTypeConditions})`

    const xpath = `${statusXPath} and ${jobTypeXPath}`

    console.log('Querying schedulable jobs with xpath:', xpath)

    // Step 3: Query jobs
    const jobQueryParams = new URLSearchParams({
      type: 'Job',
      xpath: xpath,
      offset: '0',
      limit: '10000',
    })

    const jobUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${jobQueryParams.toString()}`
    const requestBody = [{ xpath: '@job', descending: true }]

    const jobResponse = await fetch(jobUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!jobResponse.ok) {
      const errorText = await jobResponse.text()
      console.error('Job query API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch jobs from PACE API', details: errorText },
        { status: jobResponse.status }
      )
    }

    const jobIds: string[] = await jobResponse.json()
    console.log(`Found ${jobIds.length} schedulable jobs`)

    // Step 4: Fetch job details in batches
    const fetchJobDetail = async (id: string) => {
      try {
        const detailResponse = await fetch(
          `${paceApiUrl}/ReadObject/readJob?primaryKey=${encodeURIComponent(id)}`,
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
          const jobDetail = await detailResponse.json()
          return { id, job: jobDetail }
        }
      } catch (err) {
        console.error(`Error fetching job ${id}:`, err)
      }
      return null
    }

    const batchSize = 100
    const jobs: any[] = []

    for (let i = 0; i < jobIds.length; i += batchSize) {
      const batch = jobIds.slice(i, i + batchSize)
      const batchResults = await Promise.all(batch.map(fetchJobDetail))

      for (const result of batchResults) {
        if (result?.job) {
          jobs.push(result.job)
        }
      }

      console.log(`Processed ${Math.min(i + batchSize, jobIds.length)}/${jobIds.length} jobs...`)
    }

    // Step 5: Enrich with customer names
    const uniqueCustomers = [...new Set(jobs.map((j: any) => j.customer).filter(Boolean))]
    console.log(`Fetching ${uniqueCustomers.length} unique customer names...`)

    const customerNameMap = new Map()

    const fetchCustomerName = async (customerId: string) => {
      try {
        const customerResponse = await fetch(
          `${paceApiUrl}/ReadObject/readCustomer?primaryKey=${encodeURIComponent(customerId)}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )

        if (customerResponse.ok) {
          const customerData = await customerResponse.json()
          return { customerId, customerName: customerData.custName || customerData.id }
        }
      } catch (err) {
        console.error(`Error fetching customer ${customerId}:`, err)
      }
      return { customerId, customerName: null }
    }

    const customerResults = await Promise.all(uniqueCustomers.map(fetchCustomerName))
    customerResults.forEach(r => {
      customerNameMap.set(r.customerId, r.customerName)
    })

    // Step 6: Enrich with JobType descriptions
    const jobTypeDescriptionMap = new Map()
    department.jobTypes.forEach((jt: typeof department.jobTypes[number]) => {
      jobTypeDescriptionMap.set(jt.paceJobTypeId, jt.jobTypeName)
    })

    // Step 7: Check which jobs are already scheduled
    const scheduledJobNumbers = await db.jobSchedule.findMany({
      where: {
        paceJobNumber: {
          in: jobs.map((j: any) => j.job),
        },
        tenantId: membership.tenantId,
      },
      select: {
        paceJobNumber: true,
        scheduledDate: true,
        status: true,
      },
    })

    const scheduledMap = new Map(
      scheduledJobNumbers.map(s => [s.paceJobNumber, s])
    )

    // Step 8: Build response with enriched data
    const enrichedJobs = jobs.map((job: any) => ({
      jobNumber: job.job,
      customer: job.customer,
      customerName: customerNameMap.get(job.customer) || null,
      description: job.description,
      jobType: job.jobType,
      jobTypeDescription: jobTypeDescriptionMap.get(job.jobType) || null,
      promiseDateTime: job.promiseDateTime,
      adminStatus: job.adminStatus,
      // Mark if already scheduled
      isScheduled: scheduledMap.has(job.job),
      scheduleInfo: scheduledMap.get(job.job) || null,
      // Include full job data for scheduling with enriched customer name
      paceJobData: {
        ...job,
        customerName: customerNameMap.get(job.customer) || null,
        custName: customerNameMap.get(job.customer) || null,
      },
    }))

    console.log(`✅ Fetched ${enrichedJobs.length} schedulable jobs`)

    return NextResponse.json({
      success: true,
      data: {
        items: enrichedJobs,
        total: enrichedJobs.length,
        department: {
          id: department.id,
          name: department.name,
          jobTypes: department.jobTypes,
        },
      },
    })
  } catch (error) {
    console.error('Get schedulable jobs error:', error)

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
