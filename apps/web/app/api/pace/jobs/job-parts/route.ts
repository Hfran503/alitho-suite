import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// GET /api/pace/jobs/job-parts - Fetch job parts for jobs with statusType != 5 and jobType in (5018, 5021)
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

    // Step 1: Find all JobStatus IDs that have statusType != 5
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

    // Step 2: Build XPath query for Jobs with adminStatus matching JobStatus IDs and jobType in (5018, 5021)
    const adminStatusConditions = jobStatusIds.map(id => `@adminStatus = '${id}'`).join(' or ')
    const statusXPath = jobStatusIds.length === 1
      ? `@adminStatus = '${jobStatusIds[0]}'`
      : `(${adminStatusConditions})`

    const xpath = `${statusXPath} and (@jobType = 5018 or @jobType = 5021)`

    console.log('Querying jobs with xpath:', xpath)

    // Build query parameters for PACE API FindObjects
    const jobQueryParams = new URLSearchParams({
      type: 'Job',
      xpath: xpath,
      offset: '0',
      limit: '10000',
    })

    const jobUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${jobQueryParams.toString()}`

    // Sort by job number descending
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
    console.log(`Found ${jobIds.length} jobs matching criteria`)

    if (jobIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          total: 0,
        },
      })
    }

    // Step 3: Fetch job details
    console.log(`Fetching details for ${jobIds.length} jobs...`)

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

    // Fetch jobs in batches
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

    console.log(`✅ Fetched ${jobs.length} job details`)

    // Step 4: Query JobParts for all jobs
    console.log(`Fetching JobParts for ${jobs.length} jobs...`)

    const jobPartsMap = new Map<string, any[]>()

    const fetchJobParts = async (jobNumber: string) => {
      try {
        // Query for all JobParts for this job
        const jobPartQueryParams = new URLSearchParams({
          type: 'JobPart',
          xpath: `@job = '${jobNumber}'`,
          offset: '0',
          limit: '1000',
        })

        const jobPartUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${jobPartQueryParams.toString()}`

        const jobPartResponse = await fetch(jobPartUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([]),
        })

        if (jobPartResponse.ok) {
          const jobPartIds: string[] = await jobPartResponse.json()

          // Fetch details for each part
          const partDetails = await Promise.all(
            jobPartIds.map(async (partId) => {
              try {
                const partDetailResponse = await fetch(
                  `${paceApiUrl}/ReadObject/readJobPart?primaryKey=${encodeURIComponent(partId)}`,
                  {
                    method: 'POST',
                    headers: {
                      'Accept': 'application/json',
                      'Authorization': authHeader,
                    },
                    body: '',
                  }
                )

                if (partDetailResponse.ok) {
                  const partDetail = await partDetailResponse.json()
                  return {
                    id: partDetail.id,
                    jobPart: partDetail.jobPart,
                    // Try ccpartdesc first, then fallback to description field
                    description: partDetail.ccpartdesc || partDetail.description,
                    qtyOrdered: partDetail.qtyOrdered,
                  }
                }
              } catch (err) {
                console.error(`Error fetching JobPart ${partId}:`, err)
              }
              return null
            })
          )

          return partDetails.filter(p => p !== null)
        }
      } catch (err) {
        console.error(`Error fetching JobParts for job ${jobNumber}:`, err)
      }
      return []
    }

    // Fetch job parts in batches
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(async (job) => {
          const parts = await fetchJobParts(job.job)
          return { jobNumber: job.job, parts }
        })
      )

      batchResults.forEach(result => {
        jobPartsMap.set(result.jobNumber, result.parts)
      })

      console.log(`Processed parts for ${Math.min(i + batchSize, jobs.length)}/${jobs.length} jobs...`)
    }

    console.log(`✅ Fetched JobParts for all jobs`)

    // Step 5: Enrich with customer names
    const uniqueCustomers = [...new Set(jobs.map(j => j.customer).filter(Boolean))]
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

    console.log(`✅ Fetched customer names`)

    // Step 6: Enrich with JobType descriptions
    const uniqueJobTypes = [...new Set(jobs.map(j => j.jobType).filter(Boolean))]
    console.log(`Fetching ${uniqueJobTypes.length} unique JobType descriptions...`)

    const jobTypeDescriptionMap = new Map()

    const fetchJobTypeDescription = async (jobTypeId: number) => {
      try {
        const jobTypeResponse = await fetch(
          `${paceApiUrl}/ReadObject/readJobType?primaryKey=${encodeURIComponent(jobTypeId)}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )

        if (jobTypeResponse.ok) {
          const jobTypeData = await jobTypeResponse.json()
          return { jobTypeId, jobTypeDescription: jobTypeData.description || null }
        }
      } catch (err) {
        console.error(`Error fetching JobType ${jobTypeId}:`, err)
      }
      return { jobTypeId, jobTypeDescription: null }
    }

    const jobTypeResults = await Promise.all(uniqueJobTypes.map(fetchJobTypeDescription))
    jobTypeResults.forEach(r => {
      jobTypeDescriptionMap.set(r.jobTypeId, r.jobTypeDescription)
    })

    console.log(`✅ Fetched JobType descriptions`)

    // Step 7: Build grouped response
    const groupedJobs = jobs.map(job => {
      const parts = jobPartsMap.get(job.job) || []

      return {
        job: job.job,
        jobDetails: {
          job: job.job,
          customer: job.customer,
          description: job.description,
          jobType: job.jobType,
          adminStatus: job.adminStatus,
          promiseDateTime: job.promiseDateTime,
        },
        customerName: customerNameMap.get(job.customer) || null,
        jobTypeDescription: jobTypeDescriptionMap.get(job.jobType) || null,
        parts: parts,
      }
    }).filter(job => job.parts.length > 0) // Only include jobs that have parts

    console.log(`✅ Built ${groupedJobs.length} grouped jobs with parts`)

    return NextResponse.json({
      success: true,
      data: {
        items: groupedJobs,
        total: groupedJobs.length,
      },
    })
  } catch (error) {
    console.error('Get job parts error:', error)

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
