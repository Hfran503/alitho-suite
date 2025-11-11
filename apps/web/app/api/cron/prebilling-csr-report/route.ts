import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/database'
import { getCronSecret } from '@repo/shared'
import { getPaceApiCredentials } from '@/lib/secrets'
import { Queue } from 'bullmq'
import Redis from 'ioredis'

/**
 * Cron endpoint to send daily prebilling reports to CSRs
 *
 * This endpoint should be called at 8:10 AM California time by a cron service
 * such as Dokploy Schedule Jobs
 *
 * Example cron schedule: '10 8 * * *' (8:10 AM daily) - Note: Adjust timezone for California time
 *
 * For Dokploy Schedule Jobs:
 * - Type: "Dokploy Server Jobs"
 * - Schedule: '10 15 * * *' (8:10 AM PST = 3:10 PM UTC in winter, 10 16 * * * for PDT = 4:10 PM UTC in summer)
 * - Script: curl -X GET -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/prebilling-csr-report
 *
 * Authorization: Uses CRON_SECRET from AWS Secrets Manager (calitho-suite/cron)
 */

interface Job {
  job?: string
  customer?: string
  customerName?: string
  customerPORequired?: string
  adminStatus?: string
  adminStatusDescription?: string
  description?: string
  promiseDateTime?: string
  u_proposal_number?: string
  jobValue?: number
  proposalEstimatePrice?: number
  amountToInvoice?: number
  proposalTotalSellPrice?: number
  proposalEstimate?: string
  proposalPO?: string
  csr?: string
  csrName?: string
  csrEmail?: string
  part1Estimate?: string
  jobType?: number
  jobTypeDescription?: string
  poNum?: string
  changeOrdersWithZeroPrice?: number
  u_planner?: string
  plannerName?: string
  plannerEmail?: string
}

// Connect to Redis for queue
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
})

const emailQueue = new Queue('emails', { connection })

async function fetchPrebillingJobs(_tenantId: string) {
  // This function replicates the logic from /api/pace/jobs/prebilling
  // to ensure we get the exact same enriched data for issue detection

  const credentials = await getPaceApiCredentials()
  const paceApiUrl = credentials.url
  const paceUsername = credentials.username
  const pacePassword = credentials.password

  const authHeader = `Basic ${Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')}`

  // Step 1: Find JobStatus IDs with statusType != 5
  const jobStatusQueryParams = new URLSearchParams({
    type: 'JobStatus',
    xpath: '@statusType != 5',
    offset: '0',
    limit: '100',
  })

  const jobStatusResponse = await fetch(`${paceApiUrl}/FindObjects/findSortAndLimit?${jobStatusQueryParams}`, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify([]),
  })

  if (!jobStatusResponse.ok) throw new Error('Failed to fetch JobStatus')

  const jobStatusIds: string[] = await jobStatusResponse.json()
  if (jobStatusIds.length === 0) return []

  // Step 2: Query for Jobs
  const adminStatusConditions = jobStatusIds.map(id => `@adminStatus = '${id}'`).join(' or ')
  const adminStatusXPath = jobStatusIds.length === 1 ? `@adminStatus = '${jobStatusIds[0]}'` : `(${adminStatusConditions})`
  const jobTypeExclusion = '@jobType != 5022 and @jobType != 5013 and @jobType != 5015 and @jobType != 5017'
  const xpath = `${adminStatusXPath} and ${jobTypeExclusion}`

  const jobsResponse = await fetch(`${paceApiUrl}/FindObjects/findSortAndLimit?${new URLSearchParams({ type: 'Job', xpath, offset: '0', limit: '10000' })}`, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ xpath: '@job', descending: true }]),
  })

  if (!jobsResponse.ok) throw new Error('Failed to fetch jobs')

  const jobIds: string[] = await jobsResponse.json()

  // Fetch job details
  const jobs: any[] = []
  for (let i = 0; i < jobIds.length; i += 100) {
    const batch = jobIds.slice(i, i + 100)
    const results = await Promise.all(batch.map(async (id) => {
      try {
        const res = await fetch(`${paceApiUrl}/ReadObject/readJob?primaryKey=${encodeURIComponent(id)}`, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Authorization': authHeader },
          body: '',
        })
        return res.ok ? await res.json() : null
      } catch {
        return null
      }
    }))
    jobs.push(...results.filter(Boolean))
  }

  // Enrich with CSR data
  const uniqueCSRs = [...new Set(jobs.map(j => j.csr).filter(Boolean))]
  const csrResults = await Promise.all(uniqueCSRs.map(async (csrId) => {
    try {
      const res = await fetch(`${paceApiUrl}/ReadObject/readCSR?primaryKey=${encodeURIComponent(csrId!)}`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Authorization': authHeader },
        body: '',
      })
      if (res.ok) {
        const data = await res.json()
        return { csrId, csrName: data.name || data.id, csrEmail: data.email || null }
      }
    } catch {}
    return { csrId, csrName: null, csrEmail: null }
  }))

  const csrNameMap = new Map(csrResults.map(r => [r.csrId, r.csrName]))
  const csrEmailMap = new Map(csrResults.map(r => [r.csrId, r.csrEmail]))

  jobs.forEach(job => {
    if (job.csr) {
      job.csrName = csrNameMap.get(job.csr) || null
      job.csrEmail = csrEmailMap.get(job.csr) || null
    }
  })

  // Enrich with customer data
  const uniqueCustomers = [...new Set(jobs.map(j => j.customer).filter(Boolean))]
  const customerResults = await Promise.all(uniqueCustomers.map(async (customerId) => {
    try {
      const res = await fetch(`${paceApiUrl}/ReadObject/readCustomer?primaryKey=${encodeURIComponent(customerId!)}`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Authorization': authHeader },
        body: '',
      })
      if (res.ok) {
        const data = await res.json()
        return { customerId, customerName: data.custName || data.id, enterInvoicePORequired: data.enterInvoicePORequired || null }
      }
    } catch {}
    return { customerId, customerName: null, enterInvoicePORequired: null }
  }))

  const customerNameMap = new Map(customerResults.map(r => [r.customerId, r.customerName]))
  const customerPORequiredMap = new Map(customerResults.map(r => [r.customerId, r.enterInvoicePORequired]))

  jobs.forEach(job => {
    if (job.customer) {
      job.customerName = customerNameMap.get(job.customer) || null
      job.customerPORequired = customerPORequiredMap.get(job.customer) || null
    }
  })

  // Enrich with Proposal data (critical for issue detection)
  const uniqueProposals = [...new Set(jobs.map(j => j.u_proposal_number).filter(Boolean))]
  const proposalResults = await Promise.all(uniqueProposals.map(async (proposalNumber) => {
    try {
      const res = await fetch(`${paceApiUrl}/ReadObject/readUDO_proposal?primaryKey=${encodeURIComponent(proposalNumber!)}`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Authorization': authHeader },
        body: '',
      })
      if (res.ok) {
        const data = await res.json()
        let estimateNumber = null
        if (data.estimate) {
          try {
            const estRes = await fetch(`${paceApiUrl}/ReadObject/readEstimate?primaryKey=${data.estimate}`, {
              method: 'POST',
              headers: { 'Accept': 'application/json', 'Authorization': authHeader },
              body: '',
            })
            if (estRes.ok) {
              const estData = await estRes.json()
              estimateNumber = estData.estimateNumber || null
            }
          } catch {}
        }
        return {
          proposalNumber,
          estimatePrice: data.estimate_price || null,
          totalSellPrice: data.totalSellPrice || null,
          estimate: estimateNumber,
          po: data.po || null
        }
      }
    } catch {}
    return { proposalNumber, estimatePrice: null, totalSellPrice: null, estimate: null, po: null }
  }))

  const proposalEstimatePriceMap = new Map(proposalResults.map(r => [r.proposalNumber, r.estimatePrice]))
  const proposalTotalSellPriceMap = new Map(proposalResults.map(r => [r.proposalNumber, r.totalSellPrice]))
  const proposalEstimateMap = new Map(proposalResults.map(r => [r.proposalNumber, r.estimate]))
  const proposalPOMap = new Map(proposalResults.map(r => [r.proposalNumber, r.po]))

  jobs.forEach(job => {
    if (job.u_proposal_number) {
      job.proposalEstimatePrice = proposalEstimatePriceMap.get(job.u_proposal_number) || null
      job.proposalTotalSellPrice = proposalTotalSellPriceMap.get(job.u_proposal_number) || null
      job.proposalEstimate = proposalEstimateMap.get(job.u_proposal_number) || null
      job.proposalPO = proposalPOMap.get(job.u_proposal_number) || null
    }
  })

  // Enrich with Part 1 estimates in batches (critical for issue detection)
  const part1EstimateMap = new Map<string, string | null>()
  for (let i = 0; i < jobs.length; i += 50) {
    const batch = jobs.slice(i, i + 50)
    await Promise.all(batch.map(async (job) => {
      try {
        const res = await fetch(`${paceApiUrl}/FindObjects/findSortAndLimit?${new URLSearchParams({
          type: 'JobPart',
          xpath: `@job = '${job.job}' and @jobPart = '01'`,
          offset: '0',
          limit: '1',
        })}`, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Authorization': authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify([]),
        })
        if (res.ok) {
          const jobPartIds = await res.json()
          if (jobPartIds.length > 0) {
            const partRes = await fetch(`${paceApiUrl}/ReadObject/readJobPart?primaryKey=${encodeURIComponent(jobPartIds[0])}`, {
              method: 'POST',
              headers: { 'Accept': 'application/json', 'Authorization': authHeader },
              body: '',
            })
            if (partRes.ok) {
              const partData = await partRes.json()
              part1EstimateMap.set(job.job, partData.estimate || null)
            }
          }
        }
      } catch {}
    }))
  }

  jobs.forEach(job => {
    job.part1Estimate = part1EstimateMap.get(job.job) || null
  })

  // Enrich with ChangeOrder data in batches (critical for issue detection)
  const changeOrderCountMap = new Map<string, number>()
  for (let i = 0; i < jobs.length; i += 50) {
    const batch = jobs.slice(i, i + 50)
    await Promise.all(batch.map(async (job) => {
      try {
        const res = await fetch(`${paceApiUrl}/FindObjects/findSortAndLimit?${new URLSearchParams({
          type: 'ChangeOrder',
          xpath: `@job = '${job.job}' and @type = 5001`,
          offset: '0',
          limit: '100',
        })}`, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Authorization': authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify([]),
        })
        if (res.ok) {
          const changeOrderIds = await res.json()
          let zeroCount = 0
          for (const coId of changeOrderIds) {
            try {
              const coRes = await fetch(`${paceApiUrl}/ReadObject/readChangeOrder?primaryKey=${encodeURIComponent(coId)}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Authorization': authHeader },
                body: '',
              })
              if (coRes.ok) {
                const coData = await coRes.json()
                if (!coData.totalBillAmt || coData.totalBillAmt === 0) {
                  zeroCount++
                }
              }
            } catch {}
          }
          changeOrderCountMap.set(job.job, zeroCount)
        }
      } catch {}
    }))
  }

  jobs.forEach(job => {
    job.changeOrdersWithZeroPrice = changeOrderCountMap.get(job.job) || 0
  })

  console.log(`✅ Enriched ${jobs.length} jobs with all critical data for issue detection`)

  return jobs
}

function jobHasIssues(job: Job): boolean {
  // Check estimate number issues
  if (!job.proposalEstimate && !job.part1Estimate) {
    return true // No estimate data
  }
  if (!job.proposalEstimate || !job.part1Estimate) {
    return true // Missing one estimate
  }
  if (job.proposalEstimate !== job.part1Estimate) {
    return true // Estimate mismatch (exact match required, versions matter)
  }

  // Check estimate price issues
  if (!job.proposalEstimatePrice && !job.jobValue) {
    return true // No data
  }
  if (!job.proposalEstimatePrice || !job.jobValue) {
    return true // Missing one value
  }
  if (Math.abs(job.jobValue - job.proposalEstimatePrice) > 100) {
    return true // Price difference
  }

  // Check sell price issues
  if (!job.proposalTotalSellPrice && !job.amountToInvoice) {
    return true // No data
  }
  if (!job.proposalTotalSellPrice || !job.amountToInvoice) {
    return true // Missing one value
  }
  if (Math.abs(job.amountToInvoice - job.proposalTotalSellPrice) > 0.01) {
    return true // Invoice difference
  }

  // Check PO issues (only if customer requires PO)
  if (job.customerPORequired === '1') {
    const jobPO = job.poNum?.trim()
    const proposalPO = job.proposalPO?.trim()

    // Both are empty - ISSUE
    if (!jobPO && !proposalPO) {
      return true
    }

    // Both have values but don't match - ISSUE
    if (jobPO && proposalPO && jobPO !== proposalPO) {
      return true
    }
  }

  // Check if past due by more than 14 days
  if (job.promiseDateTime) {
    const dueDate = new Date(job.promiseDateTime)
    const now = new Date()
    const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > 14) {
      return true // Past due by more than 14 days
    }
  }

  // Check if there are ChangeOrders (type 5001) with zero or missing price
  if (job.changeOrdersWithZeroPrice && job.changeOrdersWithZeroPrice > 0) {
    return true // Has ChangeOrders with zero/missing price
  }

  return false // No issues
}

function identifyJobIssues(job: Job): string[] {
  const issues: string[] = []

  // Check estimate number issues
  if (!job.proposalEstimate && !job.part1Estimate) {
    issues.push('Missing estimate numbers')
  } else if (!job.proposalEstimate) {
    issues.push('Missing proposal estimate')
  } else if (!job.part1Estimate) {
    issues.push('Missing job estimate')
  } else if (job.proposalEstimate !== job.part1Estimate) {
    issues.push(`Estimate mismatch (Proposal: ${job.proposalEstimate}, Job: ${job.part1Estimate})`)
  }

  // Check estimate price issues
  if (!job.proposalEstimatePrice && !job.jobValue) {
    issues.push('Missing estimate price and job value')
  } else if (!job.proposalEstimatePrice) {
    issues.push('Missing proposal estimate price')
  } else if (!job.jobValue) {
    issues.push('Missing job value')
  } else if (Math.abs(job.jobValue - job.proposalEstimatePrice) > 100) {
    issues.push(`Price difference: Job Value $${job.jobValue.toFixed(2)} vs Estimate $${job.proposalEstimatePrice.toFixed(2)}`)
  }

  // Check sell price issues
  if (!job.proposalTotalSellPrice && !job.amountToInvoice) {
    issues.push('Missing sell price and invoice amount')
  } else if (!job.proposalTotalSellPrice) {
    issues.push('Missing proposal sell price')
  } else if (!job.amountToInvoice) {
    issues.push('Missing invoice amount')
  } else if (Math.abs(job.amountToInvoice - job.proposalTotalSellPrice) > 0.01) {
    issues.push(`Invoice mismatch: $${job.amountToInvoice.toFixed(2)} vs $${job.proposalTotalSellPrice.toFixed(2)}`)
  }

  // Check PO issues (only if customer requires PO)
  if (job.customerPORequired === '1') {
    const jobPO = job.poNum?.trim()
    const proposalPO = job.proposalPO?.trim()

    if (!jobPO && !proposalPO) {
      issues.push('Missing PO (Customer requires PO)')
    } else if (jobPO && proposalPO && jobPO !== proposalPO) {
      issues.push(`PO mismatch (Job: ${jobPO}, Proposal: ${proposalPO})`)
    }
  }

  // Check if past due by more than 14 days
  if (job.promiseDateTime) {
    const dueDate = new Date(job.promiseDateTime)
    const now = new Date()
    const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > 14) {
      issues.push(`Past due by ${daysDiff} days`)
    }
  }

  // Check for change orders with zero price
  if (job.changeOrdersWithZeroPrice && job.changeOrdersWithZeroPrice > 0) {
    issues.push(`${job.changeOrdersWithZeroPrice} Change Order(s) with $0 price`)
  }

  return issues
}

function generateEmailHTML(csrName: string, jobs: Job[]): string {
  // Filter jobs with issues using the same logic as the prebilling-jobs page
  const jobsWithIssues = jobs
    .filter(job => jobHasIssues(job))
    .map(job => ({
      job,
      issues: identifyJobIssues(job)
    }))

  if (jobsWithIssues.length === 0) {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #10b981;">Good Morning, ${csrName}!</h2>
          <p>Great news! You have no prebilling issues to address today.</p>
          <p style="margin-top: 20px;">All your open jobs are in good standing.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 12px; color: #6b7280;">
            This is an automated report sent daily at 8:10 AM California time.<br>
            Generated by Calitho Suite
          </p>
        </body>
      </html>
    `
  }

  const jobRows = jobsWithIssues.map(({ job, issues }) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px 8px; font-weight: 600;">${job.job || '-'}</td>
      <td style="padding: 12px 8px;">${job.customerName || job.customer || '-'}</td>
      <td style="padding: 12px 8px;">${job.u_proposal_number || '-'}</td>
      <td style="padding: 12px 8px;">
        <ul style="margin: 0; padding-left: 20px; color: #dc2626;">
          ${issues.map(issue => `<li>${issue}</li>`).join('')}
        </ul>
      </td>
    </tr>
  `).join('')

  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #1f2937;">Good Morning, ${csrName}!</h2>
        <p>Here's your daily prebilling report. You have <strong>${jobsWithIssues.length}</strong> job(s) requiring attention:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <thead>
            <tr style="background: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
              <th style="padding: 12px 8px; text-align: left; font-weight: 600;">Job #</th>
              <th style="padding: 12px 8px; text-align: left; font-weight: 600;">Customer</th>
              <th style="padding: 12px 8px; text-align: left; font-weight: 600;">Proposal #</th>
              <th style="padding: 12px 8px; text-align: left; font-weight: 600;">Issues</th>
            </tr>
          </thead>
          <tbody>
            ${jobRows}
          </tbody>
        </table>

        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; font-weight: 600; color: #1e40af;">Action Required:</p>
          <p style="margin: 8px 0 0 0;">Please review and resolve these issues to ensure jobs can be billed properly.</p>
        </div>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 12px; color: #6b7280;">
          This is an automated report sent daily at 8:10 AM California time.<br>
          Generated by Calitho Suite
        </p>
      </body>
    </html>
  `
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret from AWS Secrets Manager
    const authHeader = request.headers.get('authorization')
    const isDevelopment = process.env.NODE_ENV === 'development'

    // In development, allow bypass with special header or skip auth entirely
    if (!isDevelopment) {
      let cronSecret: string | undefined
      try {
        cronSecret = await getCronSecret()
      } catch (error) {
        console.error('Failed to fetch CRON_SECRET from AWS Secrets Manager:', error)
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        )
      }

      if (cronSecret) {
        if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
          console.warn('Prebilling CSR report cron called with invalid/missing authorization')
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
      }
    } else {
      console.log('🧪 Development mode: Skipping authentication')
    }

    // Get all active tenants
    const tenants = await db.tenant.findMany({
      where: {
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    })

    if (tenants.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active tenants found',
        sent: 0,
      })
    }

    const results = []

    // Process each tenant
    for (const tenant of tenants) {
      try {
        console.log(`Fetching prebilling jobs for tenant ${tenant.name} (${tenant.id})...`)

        // Fetch prebilling jobs
        const jobs = await fetchPrebillingJobs(tenant.id)

        console.log(`Found ${jobs.length} prebilling jobs for tenant ${tenant.name}`)

        // Group jobs by CSR
        const jobsByCSR = new Map<string, { csrName: string; csrEmail: string | null; jobs: Job[] }>()

        jobs.forEach((job: Job) => {
          if (job.csr && job.csrName) {
            if (!jobsByCSR.has(job.csr)) {
              jobsByCSR.set(job.csr, {
                csrName: job.csrName,
                csrEmail: job.csrEmail || null,
                jobs: []
              })
            }
            jobsByCSR.get(job.csr)!.jobs.push(job)
          }
        })

        console.log(`Grouped jobs into ${jobsByCSR.size} CSRs`)

        // Send email to each CSR
        let emailsSent = 0
        const bccEmail = 'Hector.franco@calitho.com' // BCC all emails to Hector

        for (const [_csrId, csrData] of jobsByCSR.entries()) {
          const { csrName, csrEmail, jobs: csrJobs } = csrData

          // Generate email HTML
          const emailHTML = generateEmailHTML(csrName, csrJobs)

          // Send to CSR email, or skip if no email
          if (!csrEmail) {
            console.log(`Skipping CSR ${csrName} - no email address`)
            continue
          }

          try {
            // Queue email job
            await emailQueue.add('send-email', {
              to: csrEmail,
              bcc: bccEmail,
              subject: `Daily Prebilling Report - ${new Date().toLocaleDateString()}`,
              html: emailHTML,
              text: `Prebilling report for ${csrName}. Please view this email in HTML format.`,
              tenantId: tenant.id
            })

            emailsSent++
            console.log(`✓ Queued email for ${csrName} (${csrEmail}, BCC: ${bccEmail})`)
          } catch (error) {
            console.error(`Failed to queue email for ${csrName}:`, error)
          }
        }

        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          jobsFound: jobs.length,
          csrCount: jobsByCSR.size,
          emailsSent,
          status: 'success',
        })

        console.log(`✓ Completed prebilling report for tenant ${tenant.name}`)
      } catch (error) {
        console.error(`Failed to process tenant ${tenant.name}:`, error)
        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length
    const totalEmailsSent = results.reduce((sum, r) => sum + (r.emailsSent || 0), 0)

    return NextResponse.json({
      success: true,
      message: `Sent prebilling reports to ${totalEmailsSent} CSR(s) across ${successCount} tenant(s)`,
      totalEmails: totalEmailsSent,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in prebilling CSR report cron:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// Handle POST for manual triggers (useful for testing)
export async function POST(request: NextRequest) {
  return GET(request)
}
