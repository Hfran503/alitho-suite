import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// GET /api/pace/jobs/prebilling - Fetch all Prebilling Jobs (Open jobs excluding certain JobTypes)
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

    // Step 1: Find all JobStatus IDs that have statusType != 5
    // We want open jobs (NOT the ones with statusType = 5)
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
    console.log(`Found ${jobStatusIds.length} JobStatus IDs with statusType != 5:`, jobStatusIds)

    if (jobStatusIds.length === 0) {
      // No JobStatus with statusType != 5, return empty result
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          total: 0,
        },
      })
    }

    // Step 2: Build XPath query for Jobs with adminStatus matching any of these JobStatus IDs
    // XPath: @adminStatus = 'id1' or @adminStatus = 'id2' or ...
    // Also exclude JobTypes: 5022, 5013, 5015, 5017
    const adminStatusConditions = jobStatusIds.map(id => `@adminStatus = '${id}'`).join(' or ')
    const adminStatusXPath = jobStatusIds.length === 1
      ? `@adminStatus = '${jobStatusIds[0]}'`
      : `(${adminStatusConditions})`

    // Add JobType exclusion for prebilling
    const jobTypeExclusion = '@jobType != 5022 and @jobType != 5013 and @jobType != 5015 and @jobType != 5017'
    const xpath = `${adminStatusXPath} and ${jobTypeExclusion}`

    // Build query parameters for PACE API FindObjects
    const queryParams = new URLSearchParams({
      type: 'Job',
      xpath: xpath,
      offset: '0',
      limit: '10000', // Fetch a large batch
    })

    // Call PACE API using findSortAndLimit
    const paceUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${queryParams.toString()}`

    console.log('PACE API Request (Open Jobs):', {
      url: paceUrl,
      xpath: xpath,
      jobStatusIds: jobStatusIds,
    })

    // Sort by job number descending (most recent first)
    // Use @job instead of @id for Job objects
    const requestBody = [{ xpath: '@job', descending: true }]

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
      console.error('PACE API error:', {
        status: response.status,
        statusText: response.statusText,
        url: paceUrl,
        response: errorText,
      })

      // Check for specific PACE errors
      try {
        const errorData = JSON.parse(errorText)
        if (errorData?.response?.message === 'System License Expired') {
          return NextResponse.json(
            {
              error: 'PACE System License Expired',
              message: 'Please contact your PACE administrator to renew the license.',
              details: errorData
            },
            { status: 503 }
          )
        }
      } catch (e) {
        // Not JSON, continue with generic error
      }

      return NextResponse.json(
        {
          error: `Failed to fetch open jobs from PACE API (${response.status} ${response.statusText})`,
          details: errorText,
          status: response.status,
        },
        { status: response.status }
      )
    }

    // PACE returns array of primary keys (Job IDs/numbers)
    const jobIds: string[] = await response.json()

    console.log(`PACE returned ${jobIds.length} open job IDs`)

    // Fetch details in parallel batches for better performance
    const batchSize = 100
    const batches: string[][] = []
    for (let i = 0; i < jobIds.length; i += batchSize) {
      batches.push(jobIds.slice(i, i + batchSize))
    }

    console.log(`Processing ${jobIds.length} jobs in ${batches.length} batches of ${batchSize}...`)

    // Function to fetch a single job's details
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
          let jobDetail
          try {
            jobDetail = await detailResponse.json()
          } catch (jsonError) {
            console.error(`JSON parse error for job ${id}:`, jsonError)
            return { id, error: 'json_parse_error' }
          }

          return { id, job: jobDetail }
        } else {
          const errorText = await detailResponse.text()
          console.error(`Failed to fetch job ${id}:`, errorText)
          return { id, error: 'fetch_error', details: errorText.substring(0, 200) }
        }
      } catch (err) {
        console.error(`Exception fetching job ${id}:`, err)
        return { id, error: 'exception', details: err instanceof Error ? err.message : 'Unknown error' }
      }
    }

    // Process each batch in parallel
    const jobs: any[] = []
    let processedCount = 0

    for (const batch of batches) {
      const batchResults = await Promise.all(batch.map(fetchJobDetail))

      for (const result of batchResults) {
        if ('job' in result && result.job) {
          jobs.push(result.job)
        }
      }

      processedCount += batch.length
      if (processedCount % 500 === 0 || processedCount === jobIds.length) {
        console.log(`Processed ${processedCount}/${jobIds.length} jobs...`)
      }
    }

    console.log(`✅ Fetched ${jobs.length} open jobs`)

    // Enrich jobs with customer names
    const uniqueCustomers = [...new Set(jobs.map(j => j.customer).filter(Boolean))]
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
            enterInvoicePORequired: customerData.enterInvoicePORequired || null
          }
        }
      } catch (err) {
        console.error(`Error fetching customer ${customerId}:`, err)
      }
      return { customerId, customerName: null, enterInvoicePORequired: null }
    })

    const customerResults = await Promise.all(customerPromises)
    const customerNameMap = new Map(customerResults.map(r => [r.customerId, r.customerName]))
    const customerPORequiredMap = new Map(customerResults.map(r => [r.customerId, r.enterInvoicePORequired]))

    // Add customer name and PO required flag to each job
    jobs.forEach(job => {
      if (job.customer && customerNameMap.has(job.customer)) {
        job.customerName = customerNameMap.get(job.customer) || null
      }
      if (job.customer && customerPORequiredMap.has(job.customer)) {
        job.customerPORequired = customerPORequiredMap.get(job.customer) || null
      }
    })

    console.log(`✅ Enriched jobs with customer data`)

    // Enrich jobs with JobStatus descriptions
    const uniqueJobStatuses = [...new Set(jobs.map(j => j.adminStatus).filter(Boolean))]
    console.log(`Fetching ${uniqueJobStatuses.length} unique JobStatus descriptions...`)

    const jobStatusPromises = uniqueJobStatuses.map(async (statusId) => {
      try {
        const statusResponse = await fetch(
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

        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          return { statusId, statusDescription: statusData.description || statusData.id }
        }
      } catch (err) {
        console.error(`Error fetching JobStatus ${statusId}:`, err)
      }
      return { statusId, statusDescription: null }
    })

    const jobStatusResults = await Promise.all(jobStatusPromises)
    const jobStatusDescriptionMap = new Map(jobStatusResults.map(r => [r.statusId, r.statusDescription]))

    // Add status description to each job
    jobs.forEach(job => {
      if (job.adminStatus && jobStatusDescriptionMap.has(job.adminStatus)) {
        job.adminStatusDescription = jobStatusDescriptionMap.get(job.adminStatus) || null
      }
    })

    console.log(`✅ Enriched jobs with JobStatus descriptions`)

    // Enrich jobs with CSR names
    const uniqueCSRs = [...new Set(jobs.map(j => j.csr).filter(Boolean))]
    console.log(`Fetching ${uniqueCSRs.length} unique CSR names...`)

    const csrPromises = uniqueCSRs.map(async (csrId) => {
      try {
        const csrResponse = await fetch(
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

        if (csrResponse.ok) {
          const csrData = await csrResponse.json()
          return { csrId, csrName: csrData.name || csrData.id }
        }
      } catch (err) {
        console.error(`Error fetching CSR ${csrId}:`, err)
      }
      return { csrId, csrName: null }
    })

    const csrResults = await Promise.all(csrPromises)
    const csrNameMap = new Map(csrResults.map(r => [r.csrId, r.csrName]))

    // Add CSR name to each job
    jobs.forEach(job => {
      if (job.csr && csrNameMap.has(job.csr)) {
        job.csrName = csrNameMap.get(job.csr) || null
      }
    })

    console.log(`✅ Enriched jobs with CSR names`)

    // Enrich jobs with Planner names and emails
    const uniquePlanners = [...new Set(jobs.map(j => j.u_planner).filter(Boolean))]
    console.log(`Fetching ${uniquePlanners.length} unique Planner names and emails...`)

    const plannerPromises = uniquePlanners.map(async (plannerId) => {
      try {
        const plannerResponse = await fetch(
          `${paceApiUrl}/ReadObject/readUDO_Planner?primaryKey=${encodeURIComponent(plannerId!)}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )

        if (plannerResponse.ok) {
          const plannerData = await plannerResponse.json()
          return {
            plannerId,
            plannerName: plannerData.name || plannerData.id,
            plannerEmail: plannerData.email || null
          }
        }
      } catch (err) {
        console.error(`Error fetching Planner ${plannerId}:`, err)
      }
      return { plannerId, plannerName: null, plannerEmail: null }
    })

    const plannerResults = await Promise.all(plannerPromises)
    const plannerNameMap = new Map(plannerResults.map(r => [r.plannerId, r.plannerName]))
    const plannerEmailMap = new Map(plannerResults.map(r => [r.plannerId, r.plannerEmail]))

    // Add Planner name and email to each job
    jobs.forEach(job => {
      if (job.u_planner && plannerNameMap.has(job.u_planner)) {
        job.plannerName = plannerNameMap.get(job.u_planner) || null
      }
      if (job.u_planner && plannerEmailMap.has(job.u_planner)) {
        job.plannerEmail = plannerEmailMap.get(job.u_planner) || null
      }
    })

    console.log(`✅ Enriched jobs with Planner names and emails`)

    // Enrich jobs with JobType descriptions
    const uniqueJobTypes = [...new Set(jobs.map(j => j.jobType).filter(Boolean))]
    console.log(`Fetching ${uniqueJobTypes.length} unique JobType descriptions...`)

    const jobTypePromises = uniqueJobTypes.map(async (jobTypeId) => {
      try {
        const jobTypeResponse = await fetch(
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

        if (jobTypeResponse.ok) {
          const jobTypeData = await jobTypeResponse.json()
          return { jobTypeId, jobTypeDescription: jobTypeData.description || null }
        }
      } catch (err) {
        console.error(`Error fetching JobType ${jobTypeId}:`, err)
      }
      return { jobTypeId, jobTypeDescription: null }
    })

    const jobTypeResults = await Promise.all(jobTypePromises)
    const jobTypeDescriptionMap = new Map(jobTypeResults.map(r => [r.jobTypeId, r.jobTypeDescription]))

    // Add JobType description to each job
    jobs.forEach(job => {
      if (job.jobType && jobTypeDescriptionMap.has(job.jobType)) {
        job.jobTypeDescription = jobTypeDescriptionMap.get(job.jobType) || null
      }
    })

    console.log(`✅ Enriched jobs with JobType descriptions`)

    // Enrich jobs with Proposal estimate prices
    const uniqueProposals = [...new Set(jobs.map(j => j.u_proposal_number).filter(Boolean))]
    console.log(`Fetching ${uniqueProposals.length} unique proposal estimate prices...`)

    const proposalPromises = uniqueProposals.map(async (proposalNumber) => {
      try {
        const proposalResponse = await fetch(
          `${paceApiUrl}/ReadObject/readUDO_proposal?primaryKey=${encodeURIComponent(proposalNumber!)}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: '',
          }
        )

        if (proposalResponse.ok) {
          const proposalData = await proposalResponse.json()
          let estimateNumber = null

          // If proposal has an estimate ID, fetch the estimate number
          if (proposalData.estimate) {
            try {
              const estimateResponse = await fetch(
                `${paceApiUrl}/ReadObject/readEstimate?primaryKey=${proposalData.estimate}`,
                {
                  method: 'POST',
                  headers: {
                    'Accept': 'application/json',
                    'Authorization': authHeader,
                  },
                  body: '',
                }
              )

              if (estimateResponse.ok) {
                const estimateData = await estimateResponse.json()
                estimateNumber = estimateData.estimateNumber || null
              }
            } catch (estimateErr) {
              console.error(`Error fetching estimate ${proposalData.estimate}:`, estimateErr)
            }
          }

          return {
            proposalNumber,
            estimatePrice: proposalData.estimate_price || null,
            totalSellPrice: proposalData.totalSellPrice || null,
            estimate: estimateNumber,
            po: proposalData.po || null
          }
        }
      } catch (err) {
        console.error(`Error fetching proposal ${proposalNumber}:`, err)
      }
      return { proposalNumber, estimatePrice: null, totalSellPrice: null, estimate: null, po: null }
    })

    const proposalResults = await Promise.all(proposalPromises)
    const proposalEstimatePriceMap = new Map(proposalResults.map(r => [r.proposalNumber, r.estimatePrice]))
    const proposalTotalSellPriceMap = new Map(proposalResults.map(r => [r.proposalNumber, r.totalSellPrice]))
    const proposalEstimateMap = new Map(proposalResults.map(r => [r.proposalNumber, r.estimate]))
    const proposalPOMap = new Map(proposalResults.map(r => [r.proposalNumber, r.po]))

    // Add proposal estimate price, total sell price, estimate, and PO to each job
    jobs.forEach(job => {
      if (job.u_proposal_number) {
        if (proposalEstimatePriceMap.has(job.u_proposal_number)) {
          job.proposalEstimatePrice = proposalEstimatePriceMap.get(job.u_proposal_number) || null
        }
        if (proposalTotalSellPriceMap.has(job.u_proposal_number)) {
          job.proposalTotalSellPrice = proposalTotalSellPriceMap.get(job.u_proposal_number) || null
        }
        if (proposalEstimateMap.has(job.u_proposal_number)) {
          job.proposalEstimate = proposalEstimateMap.get(job.u_proposal_number) || null
        }
        if (proposalPOMap.has(job.u_proposal_number)) {
          job.proposalPO = proposalPOMap.get(job.u_proposal_number) || null
        }
      }
    })

    console.log(`✅ Enriched jobs with proposal estimate prices`)

    // Fetch Part 1 estimates - batch processing for better performance
    console.log(`Fetching Part 1 estimates for ${jobs.length} jobs...`)

    // Process in smaller batches to avoid overwhelming PACE
    const estimateBatchSize = 50
    const estimateBatches: any[][] = []
    for (let i = 0; i < jobs.length; i += estimateBatchSize) {
      estimateBatches.push(jobs.slice(i, i + estimateBatchSize))
    }

    const part1EstimateMap = new Map<string, string | null>()

    for (const [batchIndex, batch] of estimateBatches.entries()) {
      console.log(`Processing estimate batch ${batchIndex + 1}/${estimateBatches.length}...`)

      const batchPromises = batch.map(async (job) => {
        try {
          // Query for JobPart where job and jobPart = '01'
          const jobPartQueryParams = new URLSearchParams({
            type: 'JobPart',
            xpath: `@job = '${job.job}' and @jobPart = '01'`,
            offset: '0',
            limit: '1',
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
            const jobPartIds = await jobPartResponse.json()

            // Log for first job to debug
            if (batchIndex === 0 && batch.indexOf(job) === 0) {
              console.log(`Sample job ${job.job}: Found ${jobPartIds.length} JobParts with jobPart='01'`)
              if (jobPartIds.length > 0) {
                console.log(`JobPart ID: ${jobPartIds[0]}`)
              }
            }

            if (jobPartIds.length > 0) {
              // Fetch the Part 1 details
              const partDetailResponse = await fetch(
                `${paceApiUrl}/ReadObject/readJobPart?primaryKey=${encodeURIComponent(jobPartIds[0])}`,
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

                // Log first part detail to see what fields are available
                if (batchIndex === 0 && batch.indexOf(job) === 0) {
                  console.log('Sample JobPart fields:', Object.keys(partDetail).slice(0, 20))
                  console.log('Estimate field value:', partDetail.estimate)
                }

                return { jobId: job.job, estimate: partDetail.estimate || null }
              } else {
                const errorText = await partDetailResponse.text()
                if (batchIndex === 0 && batch.indexOf(job) === 0) {
                  console.error(`Error reading JobPart ${jobPartIds[0]}:`, errorText.substring(0, 200))
                }
              }
            }
          } else {
            const errorText = await jobPartResponse.text()
            if (batchIndex === 0 && batch.indexOf(job) === 0) {
              console.error(`Error querying JobParts for job ${job.job}:`, errorText.substring(0, 200))
            }
          }
        } catch (err) {
          console.error(`Error fetching Part 1 for job ${job.job}:`, err)
        }
        return { jobId: job.job, estimate: null }
      })

      const batchResults = await Promise.all(batchPromises)

      // Add to map
      batchResults.forEach(result => {
        part1EstimateMap.set(result.jobId, result.estimate)
      })
    }

    // Add Part 1 estimate to each job
    jobs.forEach(job => {
      if (job.job && part1EstimateMap.has(job.job)) {
        job.part1Estimate = part1EstimateMap.get(job.job) || null
      }
    })

    console.log(`✅ Enriched ${jobs.length} jobs with Part 1 estimates`)

    // Fetch ChangeOrders for all jobs - check for type = 5001 with totalBillAmt = 0 or null
    console.log(`Fetching ChangeOrders for ${jobs.length} jobs...`)

    const changeOrderCountMap = new Map<string, number>()

    // Process in batches to avoid overwhelming PACE
    const coBatchSize = 50
    const coBatches: any[][] = []
    for (let i = 0; i < jobs.length; i += coBatchSize) {
      coBatches.push(jobs.slice(i, i + coBatchSize))
    }

    for (const [batchIndex, batch] of coBatches.entries()) {
      console.log(`Processing ChangeOrder batch ${batchIndex + 1}/${coBatches.length}...`)

      const batchPromises = batch.map(async (job) => {
        try {
          // Query for ChangeOrders where job matches and type = 5001
          const coQueryParams = new URLSearchParams({
            type: 'ChangeOrder',
            xpath: `@job = '${job.job}' and @type = 5001`,
            offset: '0',
            limit: '100',
          })

          const coQueryUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${coQueryParams.toString()}`

          const coQueryResponse = await fetch(coQueryUrl, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify([]),
          })

          if (coQueryResponse.ok) {
            const changeOrderIds: string[] = await coQueryResponse.json()

            // Fetch details for each ChangeOrder and check totalBillAmt
            let zeroAmountCount = 0

            for (const coId of changeOrderIds) {
              try {
                const coDetailResponse = await fetch(
                  `${paceApiUrl}/ReadObject/readChangeOrder?primaryKey=${encodeURIComponent(coId)}`,
                  {
                    method: 'POST',
                    headers: {
                      'Accept': 'application/json',
                      'Authorization': authHeader,
                    },
                    body: '',
                  }
                )

                if (coDetailResponse.ok) {
                  const coData = await coDetailResponse.json()
                  // Check if totalBillAmt is 0 or null/undefined
                  if (!coData.totalBillAmt || coData.totalBillAmt === 0) {
                    zeroAmountCount++
                  }
                }
              } catch (err) {
                console.error(`Error fetching ChangeOrder ${coId}:`, err)
              }
            }

            return { jobId: job.job, count: zeroAmountCount }
          }
        } catch (err) {
          console.error(`Error querying ChangeOrders for job ${job.job}:`, err)
        }
        return { jobId: job.job, count: 0 }
      })

      const batchResults = await Promise.all(batchPromises)

      // Add to map
      batchResults.forEach(result => {
        changeOrderCountMap.set(result.jobId, result.count)
      })
    }

    // Add ChangeOrder count to each job
    jobs.forEach(job => {
      if (job.job && changeOrderCountMap.has(job.job)) {
        job.changeOrdersWithZeroPrice = changeOrderCountMap.get(job.job) || 0
      } else {
        job.changeOrdersWithZeroPrice = 0
      }
    })

    console.log(`✅ Enriched ${jobs.length} jobs with ChangeOrder data`)

    // Sort by job number/ID descending for consistent ordering
    jobs.sort((a, b) => {
      const aId = a.job || ''
      const bId = b.job || ''
      return String(bId).localeCompare(String(aId))
    })

    return NextResponse.json({
      success: true,
      data: {
        items: jobs,
        total: jobs.length,
      },
    })
  } catch (error) {
    console.error('Get open jobs error:', error)

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
