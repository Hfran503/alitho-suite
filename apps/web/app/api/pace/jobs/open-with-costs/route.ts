import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

type JobCostRecord = {
  id: number
  job: string
  jobPart?: string
  activityCode: string
  employee?: string
  chargeClass: number | string
  cost: number
  hours: number
  postedDate?: string
}

type OpenJobWithCosts = {
  id: string
  job: string
  description: string
  customer: string
  customerName: string
  adminStatus: string
  adminStatusDescription: string
  dateSetup: string
  csr: string
  csrName: string
  jobType: string
  jobTypeDescription: string
  // Cost aggregates
  estimatedCost: number
  actualCost: number
  estimatedHours: number
  actualHours: number
  variance: number
  variancePercent: number
  activityCodeCount: number
  // Activity breakdown
  activityBreakdown: ActivityBreakdown[]
}

type ActivityBreakdown = {
  activityCode: string
  description: string
  estimatedCost: number
  actualCost: number
  estimatedHours: number
  actualHours: number
  variance: number
}

// GET /api/pace/jobs/open-with-costs - Fetch all Open Jobs with activity cost summaries
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

    // Parse optional query parameters
    const { searchParams } = new URL(request.url)
    const activityCodesParam = searchParams.getAll('activityCodes')
    const hasActivityCodes = activityCodesParam.length > 0

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

    const authHeader = `Basic ${Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')}`

    // Step 1: Find all JobStatus IDs with statusType != 5 (not closed)
    console.log('Finding open JobStatus IDs...')

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
    console.log(`Found ${jobStatusIds.length} open JobStatus IDs`)

    if (jobStatusIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          total: 0,
          summary: {
            totalEstimatedCost: 0,
            totalActualCost: 0,
            totalVariance: 0,
          }
        },
      })
    }

    // Step 2: Find all open Jobs
    const adminStatusConditions = jobStatusIds.map(id => `@adminStatus = '${id}'`).join(' or ')
    const jobXpath = jobStatusIds.length === 1
      ? `@adminStatus = '${jobStatusIds[0]}'`
      : `(${adminStatusConditions})`

    const jobQueryParams = new URLSearchParams({
      type: 'Job',
      xpath: jobXpath,
      offset: '0',
      limit: '10000',
    })

    const jobQueryUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${jobQueryParams.toString()}`

    const jobResponse = await fetch(jobQueryUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ xpath: '@job', descending: true }]),
    })

    if (!jobResponse.ok) {
      const errorText = await jobResponse.text()
      console.error('Job query error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch Jobs from PACE API', details: errorText },
        { status: jobResponse.status }
      )
    }

    const jobIds: string[] = await jobResponse.json()
    console.log(`Found ${jobIds.length} open jobs`)

    if (jobIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          total: 0,
          summary: {
            totalEstimatedCost: 0,
            totalActualCost: 0,
            totalVariance: 0,
          }
        },
      })
    }

    // Step 3: Fetch job details in batches
    console.log(`Fetching details for ${jobIds.length} jobs...`)
    const jobBatchSize = 100
    const jobs: any[] = []

    for (let i = 0; i < jobIds.length; i += jobBatchSize) {
      const batch = jobIds.slice(i, i + jobBatchSize)

      const batchPromises = batch.map(async (jobId) => {
        try {
          const response = await fetch(
            `${paceApiUrl}/ReadObject/readJob?primaryKey=${encodeURIComponent(jobId)}`,
            {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Authorization': authHeader,
              },
              body: '',
            }
          )

          if (response.ok) {
            return await response.json()
          }
        } catch (err) {
          console.error(`Error fetching job ${jobId}:`, err)
        }
        return null
      })

      const batchResults = await Promise.all(batchPromises)
      jobs.push(...batchResults.filter(Boolean))
    }

    console.log(`Fetched ${jobs.length} job details`)

    // Step 4: Fetch JobCosts for all jobs with optional activity code filter
    console.log('Fetching JobCosts for all open jobs...')
    const allJobCosts: JobCostRecord[] = []
    const jobCostBatchSize = 50

    for (let i = 0; i < jobIds.length; i += jobCostBatchSize) {
      const jobBatch = jobIds.slice(i, i + jobCostBatchSize)

      const jobConditions = jobBatch.map(id => `@job = "${id}"`).join(' or ')
      let xpath = `(${jobConditions})`

      // Add activity code filter if specified
      if (hasActivityCodes) {
        const activityConditions = activityCodesParam.map(code => `@activityCode = "${code}"`).join(' or ')
        xpath = `${xpath} and (${activityConditions})`
      }

      const queryParams = new URLSearchParams({
        type: 'JobCost',
        xpath: xpath,
        offset: '0',
        limit: '50000',
      })

      const queryUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${queryParams.toString()}`

      try {
        const response = await fetch(queryUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([]),
        })

        if (response.ok) {
          const jobCostIds: string[] = await response.json()

          // Fetch JobCost details in sub-batches
          const detailBatchSize = 50
          for (let j = 0; j < jobCostIds.length; j += detailBatchSize) {
            const detailBatch = jobCostIds.slice(j, j + detailBatchSize)

            const detailPromises = detailBatch.map(async (jcId) => {
              try {
                const detailResponse = await fetch(
                  `${paceApiUrl}/ReadObject/readJobCost?primaryKey=${encodeURIComponent(jcId)}`,
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
                  return await detailResponse.json()
                }
              } catch (err) {
                console.error(`Error fetching JobCost ${jcId}:`, err)
              }
              return null
            })

            const detailResults = await Promise.all(detailPromises)
            allJobCosts.push(...detailResults.filter(Boolean))
          }
        }
      } catch (err) {
        console.error(`Error fetching JobCosts for batch starting at ${i}:`, err)
      }
    }

    console.log(`Fetched ${allJobCosts.length} JobCost records`)

    // Step 5: Get unique activity codes for enrichment
    const uniqueActivityCodes = [...new Set(allJobCosts.map(jc => jc.activityCode).filter(Boolean))]
    console.log(`Fetching ${uniqueActivityCodes.length} activity code descriptions...`)

    const activityCodeMap = new Map<string, string>()
    const activityPromises = uniqueActivityCodes.map(async (code) => {
      try {
        const response = await fetch(
          `${paceApiUrl}/ReadObject/readActivityCode?primaryKey=${encodeURIComponent(code)}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )

        if (response.ok) {
          const data = await response.json()
          return { code, description: data.description || code }
        }
      } catch (err) {
        console.error(`Error fetching ActivityCode ${code}:`, err)
      }
      return { code, description: code }
    })

    const activityResults = await Promise.all(activityPromises)
    activityResults.forEach(r => activityCodeMap.set(r.code, r.description))

    // Step 6: Enrich jobs with related data (customers, statuses, CSRs, job types)
    const uniqueCustomers = [...new Set(jobs.map(j => j.customer).filter(Boolean))]
    const uniqueStatuses = [...new Set(jobs.map(j => j.adminStatus).filter(Boolean))]
    const uniqueCSRs = [...new Set(jobs.map(j => j.csr).filter(Boolean))]
    const uniqueJobTypes = [...new Set(jobs.map(j => j.jobType).filter(Boolean))]

    console.log('Enriching jobs with related data...')

    // Fetch customer names
    const customerMap = new Map<string, string>()
    const customerPromises = uniqueCustomers.map(async (customerId) => {
      try {
        const response = await fetch(
          `${paceApiUrl}/ReadObject/readCustomer?primaryKey=${encodeURIComponent(customerId!)}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )

        if (response.ok) {
          const data = await response.json()
          return { id: customerId, name: data.custName || customerId }
        }
      } catch (err) {
        console.error(`Error fetching customer ${customerId}:`, err)
      }
      return { id: customerId, name: customerId }
    })

    const customerResults = await Promise.all(customerPromises)
    customerResults.forEach(r => customerMap.set(r.id!, r.name!))

    // Fetch status descriptions
    const statusMap = new Map<string, string>()
    const statusPromises = uniqueStatuses.map(async (statusId) => {
      try {
        const response = await fetch(
          `${paceApiUrl}/ReadObject/readJobStatus?primaryKey=${encodeURIComponent(statusId!)}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )

        if (response.ok) {
          const data = await response.json()
          return { id: statusId, description: data.description || statusId }
        }
      } catch (err) {
        console.error(`Error fetching JobStatus ${statusId}:`, err)
      }
      return { id: statusId, description: statusId }
    })

    const statusResults = await Promise.all(statusPromises)
    statusResults.forEach(r => statusMap.set(r.id!, r.description!))

    // Fetch CSR names
    const csrMap = new Map<string, string>()
    const csrPromises = uniqueCSRs.map(async (csrId) => {
      try {
        const response = await fetch(
          `${paceApiUrl}/ReadObject/readCSR?primaryKey=${encodeURIComponent(csrId!)}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )

        if (response.ok) {
          const data = await response.json()
          return { id: csrId, name: data.name || csrId }
        }
      } catch (err) {
        console.error(`Error fetching CSR ${csrId}:`, err)
      }
      return { id: csrId, name: csrId }
    })

    const csrResults = await Promise.all(csrPromises)
    csrResults.forEach(r => csrMap.set(r.id!, r.name!))

    // Fetch JobType descriptions
    const jobTypeMap = new Map<string, string>()
    const jobTypePromises = uniqueJobTypes.map(async (jobTypeId) => {
      try {
        const response = await fetch(
          `${paceApiUrl}/ReadObject/readJobType?primaryKey=${encodeURIComponent(jobTypeId!)}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )

        if (response.ok) {
          const data = await response.json()
          return { id: jobTypeId, description: data.description || jobTypeId }
        }
      } catch (err) {
        console.error(`Error fetching JobType ${jobTypeId}:`, err)
      }
      return { id: jobTypeId, description: jobTypeId }
    })

    const jobTypeResults = await Promise.all(jobTypePromises)
    jobTypeResults.forEach(r => jobTypeMap.set(r.id!, r.description!))

    // Step 7: Build the final result with cost aggregations
    const isEstimate = (jc: JobCostRecord) => jc.chargeClass === 1 || jc.chargeClass === '1'
    const isActual = (jc: JobCostRecord) => jc.chargeClass === 9 || jc.chargeClass === '9'

    const jobsWithCosts: OpenJobWithCosts[] = jobs.map(job => {
      const jobCosts = allJobCosts.filter(jc => jc.job === job.job)

      const estimatedCost = jobCosts.filter(isEstimate).reduce((sum, jc) => sum + (jc.cost || 0), 0)
      const actualCost = jobCosts.filter(isActual).reduce((sum, jc) => sum + (jc.cost || 0), 0)
      const estimatedHours = jobCosts.filter(isEstimate).reduce((sum, jc) => sum + (jc.hours || 0), 0)
      const actualHours = jobCosts.filter(isActual).reduce((sum, jc) => sum + (jc.hours || 0), 0)
      const variance = estimatedCost - actualCost
      const variancePercent = estimatedCost > 0 ? (variance / estimatedCost) * 100 : 0

      // Build activity breakdown
      const activityCodesForJob = [...new Set(jobCosts.map(jc => jc.activityCode))]
      const activityBreakdown: ActivityBreakdown[] = activityCodesForJob.map(code => {
        const codeJobCosts = jobCosts.filter(jc => jc.activityCode === code)
        const estCost = codeJobCosts.filter(isEstimate).reduce((sum, jc) => sum + (jc.cost || 0), 0)
        const actCost = codeJobCosts.filter(isActual).reduce((sum, jc) => sum + (jc.cost || 0), 0)

        return {
          activityCode: code,
          description: activityCodeMap.get(code) || code,
          estimatedCost: estCost,
          actualCost: actCost,
          estimatedHours: codeJobCosts.filter(isEstimate).reduce((sum, jc) => sum + (jc.hours || 0), 0),
          actualHours: codeJobCosts.filter(isActual).reduce((sum, jc) => sum + (jc.hours || 0), 0),
          variance: estCost - actCost,
        }
      }).sort((a, b) => b.actualCost - a.actualCost)

      return {
        id: job.id,
        job: job.job,
        description: job.description || '',
        customer: job.customer,
        customerName: customerMap.get(job.customer) || job.customer,
        adminStatus: job.adminStatus,
        adminStatusDescription: statusMap.get(job.adminStatus) || job.adminStatus,
        dateSetup: job.dateSetup,
        csr: job.csr,
        csrName: csrMap.get(job.csr) || job.csr,
        jobType: job.jobType,
        jobTypeDescription: jobTypeMap.get(job.jobType) || job.jobType,
        estimatedCost,
        actualCost,
        estimatedHours,
        actualHours,
        variance,
        variancePercent,
        activityCodeCount: activityCodesForJob.length,
        activityBreakdown,
      }
    })

    // Filter to only jobs that have activity costs (estimate or actual > 0)
    const jobsWithActivityCosts = jobsWithCosts.filter(
      job => job.estimatedCost > 0 || job.actualCost > 0
    )

    // Sort by actual cost descending
    jobsWithActivityCosts.sort((a, b) => b.actualCost - a.actualCost)

    // Calculate overall summary
    const totalEstimatedCost = jobsWithActivityCosts.reduce((sum, j) => sum + j.estimatedCost, 0)
    const totalActualCost = jobsWithActivityCosts.reduce((sum, j) => sum + j.actualCost, 0)
    const totalVariance = totalEstimatedCost - totalActualCost

    console.log(`Returning ${jobsWithActivityCosts.length} jobs with activity costs`)

    return NextResponse.json({
      success: true,
      data: {
        items: jobsWithActivityCosts,
        total: jobsWithActivityCosts.length,
        totalOpenJobs: jobs.length,
        summary: {
          totalEstimatedCost,
          totalActualCost,
          totalVariance,
          totalEstimatedHours: jobsWithActivityCosts.reduce((sum, j) => sum + j.estimatedHours, 0),
          totalActualHours: jobsWithActivityCosts.reduce((sum, j) => sum + j.actualHours, 0),
        },
        activityCodesFilter: hasActivityCodes ? activityCodesParam : null,
      },
    })
  } catch (error) {
    console.error('Open jobs with costs error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
