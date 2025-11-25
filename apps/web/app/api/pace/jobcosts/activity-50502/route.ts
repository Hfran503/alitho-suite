import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// GET /api/pace/jobcosts/activity-50502 - Fetch all jobs from 2025 with JobCost activityCode filtering
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

    // Parse activity codes from query parameters
    const { searchParams } = new URL(request.url)
    const activityCodesParam = searchParams.getAll('activityCodes')

    // Use provided activity codes or default to all
    const activityCodes = activityCodesParam.length > 0
      ? activityCodesParam
      : ['50502', '15210', '15209', '15207']

    if (activityCodes.length === 0) {
      return NextResponse.json(
        { error: 'At least one activity code must be provided' },
        { status: 400 }
      )
    }

    // Get PACE API credentials from AWS Secrets Manager or environment
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

    // Step 1: Find all JobCosts with specified activity codes
    // We'll filter by year after fetching job details since Job date fields aren't queryable
    console.log(`Finding JobCosts with activityCodes: ${activityCodes.join(', ')}...`)

    // Build XPath with OR conditions for multiple activity codes
    const activityCodeConditions = activityCodes.map(code => `@activityCode = "${code}"`).join(' or ')
    const xpath = `(${activityCodeConditions})`

    const jobCostQueryParams = new URLSearchParams({
      type: 'JobCost',
      xpath: xpath,
      offset: '0',
      limit: '10000',
    })

    const jobCostQueryUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${jobCostQueryParams.toString()}`

    const jobCostQueryResponse = await fetch(jobCostQueryUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([]),
    })

    if (!jobCostQueryResponse.ok) {
      const errorText = await jobCostQueryResponse.text()
      console.error('JobCost query API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch JobCosts from PACE API', details: errorText },
        { status: jobCostQueryResponse.status }
      )
    }

    const allJobCostIds: string[] = await jobCostQueryResponse.json()
    console.log(`Found ${allJobCostIds.length} JobCost records with specified activity codes`)

    if (allJobCostIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          total: 0,
        },
      })
    }

    // Step 2: Fetch all JobCost details and group by job
    console.log(`Fetching details for ${allJobCostIds.length} JobCost records...`)

    // Fetch JobCost details in batches
    const batchSize = 50
    const batches: string[][] = []
    for (let i = 0; i < allJobCostIds.length; i += batchSize) {
      batches.push(allJobCostIds.slice(i, i + batchSize))
    }

    const allJobCostDetails: any[] = []

    for (const [batchIndex, batch] of batches.entries()) {
      console.log(`Processing JobCost batch ${batchIndex + 1}/${batches.length}...`)

      const batchPromises = batch.map(async (jobCostId) => {
        try {
          const jobCostResponse = await fetch(
            `${paceApiUrl}/ReadObject/readJobCost?primaryKey=${encodeURIComponent(jobCostId)}`,
            {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Authorization': authHeader,
              },
              body: '',
            }
          )

          if (jobCostResponse.ok) {
            return await jobCostResponse.json()
          }
        } catch (err) {
          console.error(`Error fetching JobCost ${jobCostId}:`, err)
        }
        return null
      })

      const batchResults = await Promise.all(batchPromises)
      allJobCostDetails.push(...batchResults.filter(Boolean))
    }

    console.log(`Fetched ${allJobCostDetails.length} JobCost details`)

    // Step 3: Group JobCosts by job
    type JobCostData = {
      job: string
      jobNumber: string
      customer?: string | null
      customerName?: string | null
      description?: string | null
      dateTimeSetup?: string | null
      totalEstimatedCost: number
      totalEstimatedHours: number
      totalActualCost: number
      totalActualHours: number
      jobCostCount: number
      jobCosts: any[]
    }

    const jobCostsByJob = new Map<string, any[]>()

    allJobCostDetails.forEach(jc => {
      if (jc.job) {
        if (!jobCostsByJob.has(jc.job)) {
          jobCostsByJob.set(jc.job, [])
        }
        jobCostsByJob.get(jc.job)!.push(jc)
      }
    })

    console.log(`Found JobCosts for ${jobCostsByJob.size} unique jobs`)

    // Step 4: Fetch job details for unique jobs
    const uniqueJobIds = Array.from(jobCostsByJob.keys())
    const allJobsData: JobCostData[] = []

    const jobBatchSize = 25
    const jobBatches: string[][] = []
    for (let i = 0; i < uniqueJobIds.length; i += jobBatchSize) {
      jobBatches.push(uniqueJobIds.slice(i, i + jobBatchSize))
    }

    for (const [batchIndex, batch] of jobBatches.entries()) {
      console.log(`Processing job details batch ${batchIndex + 1}/${jobBatches.length}...`)

      const batchPromises = batch.map(async (jobId) => {
        try {
          // Fetch job details
          let jobDetail: any = null
          try {
            const jobResponse = await fetch(
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

            if (jobResponse.ok) {
              jobDetail = await jobResponse.json()
            }
          } catch (err) {
            console.error(`Error fetching job ${jobId}:`, err)
          }

          const jobCosts = jobCostsByJob.get(jobId) || []

          // Calculate totals - separate by chargeClass (1 = Estimate, 9 = Actual)
          // Handle both numeric and string values from PACE
          const estimateRecords = jobCosts.filter(jc => jc.chargeClass === 1 || jc.chargeClass === '1')
          const actualRecords = jobCosts.filter(jc => jc.chargeClass === 9 || jc.chargeClass === '9')

          const totalEstimatedCost = estimateRecords.reduce((sum, jc) => sum + (jc.cost || 0), 0)
          const totalEstimatedHours = estimateRecords.reduce((sum, jc) => sum + (jc.hours || 0), 0)
          const totalActualCost = actualRecords.reduce((sum, jc) => sum + (jc.cost || 0), 0)
          const totalActualHours = actualRecords.reduce((sum, jc) => sum + (jc.hours || 0), 0)

          return {
            job: jobId,
            jobNumber: jobDetail?.job || jobId,
            customer: jobDetail?.customer || null,
            customerName: null, // Will be enriched later
            description: jobDetail?.description || null,
            dateTimeSetup: jobDetail?.dateTimeSetup || null,
            totalEstimatedCost,
            totalEstimatedHours,
            totalActualCost,
            totalActualHours,
            jobCostCount: jobCosts.length,
            jobCosts: jobCosts,
          }
        } catch (err) {
          console.error(`Error processing job ${jobId}:`, err)
          return null
        }
      })

      const batchResults = await Promise.all(batchPromises)
      allJobsData.push(...batchResults.filter(Boolean) as JobCostData[])
    }

    console.log(`Processed ${allJobsData.length} jobs with JobCosts`)

    // Step 5: Filter by year 2025
    const jobsFrom2025 = allJobsData.filter(job => {
      if (!job.dateTimeSetup) return false
      const setupDate = new Date(job.dateTimeSetup)
      return setupDate.getFullYear() === 2025
    })

    console.log(`Found ${jobsFrom2025.length} jobs from 2025 with JobCosts for specified activity codes`)

    const jobsWithCosts = jobsFrom2025

    // Step 6: Enrich JobCosts with ActivityCode descriptions
    const uniqueActivityCodes = [...new Set(allJobCostDetails.map(jc => jc.activityCode).filter(Boolean))]
    console.log(`Fetching ${uniqueActivityCodes.length} unique ActivityCode descriptions...`)

    const activityCodePromises = uniqueActivityCodes.map(async (activityCode) => {
      try {
        const activityCodeResponse = await fetch(
          `${paceApiUrl}/ReadObject/readActivityCode?primaryKey=${encodeURIComponent(activityCode!)}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )

        if (activityCodeResponse.ok) {
          const activityCodeData = await activityCodeResponse.json()
          return {
            activityCode,
            description: activityCodeData.description || activityCodeData.id,
          }
        }
      } catch (err) {
        console.error(`Error fetching ActivityCode ${activityCode}:`, err)
      }
      return { activityCode, description: null }
    })

    const activityCodeResults = await Promise.all(activityCodePromises)
    const activityCodeDescriptionMap = new Map(activityCodeResults.map(r => [r.activityCode, r.description]))

    // Add ActivityCode descriptions to JobCosts
    jobsWithCosts.forEach(job => {
      job.jobCosts.forEach(jc => {
        if (jc.activityCode && activityCodeDescriptionMap.has(jc.activityCode)) {
          jc.activityCodeDescription = activityCodeDescriptionMap.get(jc.activityCode) || null
        }
      })
    })

    console.log(`✅ Enriched JobCosts with ActivityCode descriptions`)

    // Step 7: Enrich with customer names
    const uniqueCustomers = [...new Set(jobsWithCosts.map(j => j.customer).filter(Boolean))]
    console.log(`Fetching ${uniqueCustomers.length} unique customer names...`)

    const customerPromises = uniqueCustomers.map(async (customerId) => {
      try {
        const customerResponse = await fetch(
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

        if (customerResponse.ok) {
          const customerData = await customerResponse.json()
          return {
            customerId,
            customerName: customerData.custName || customerData.id,
          }
        }
      } catch (err) {
        console.error(`Error fetching customer ${customerId}:`, err)
      }
      return { customerId, customerName: null }
    })

    const customerResults = await Promise.all(customerPromises)
    const customerNameMap = new Map(customerResults.map(r => [r.customerId, r.customerName]))

    // Add customer names to jobs
    jobsWithCosts.forEach(job => {
      if (job.customer && customerNameMap.has(job.customer)) {
        job.customerName = customerNameMap.get(job.customer) || null
      }
    })

    console.log(`✅ Enriched jobs with customer data`)

    // Sort by job number descending
    jobsWithCosts.sort((a, b) => String(b.jobNumber).localeCompare(String(a.jobNumber)))

    return NextResponse.json({
      success: true,
      data: {
        items: jobsWithCosts,
        total: jobsWithCosts.length,
      },
    })
  } catch (error) {
    console.error('Get JobCosts error:', error)

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
