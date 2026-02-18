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
  estimatedSell: number
  syReasonId: number | string | null
  transType: number | string | null
  postedDate?: string
}

type JobBreakdown = {
  jobId: string
  estimatedSales: number
  estimatedHours: number
  actualHours: number
  estimatedCost: number
  totalActualCost: number
  costVariance: number
}

type CostCenterRow = {
  costCenterId: string
  costCenterDescription: string
  estimatedSales: number
  estimatedHours: number
  actualHours: number
  estimatedCost: number
  totalActualCost: number
  costVariance: number
  spoilageCost: number
  jobs: JobBreakdown[]
}

type DepartmentGroup = {
  departmentId: string
  departmentDescription: string
  costCenters: CostCenterRow[]
  subtotals: Omit<CostCenterRow, 'costCenterId' | 'costCenterDescription' | 'jobs'>
}

// GET /api/pace/cost-vs-estimate - Cost vs Estimate report grouped by Cost Center and Department
export async function GET(request: Request) {
  // Auth & validation checks (return normal JSON errors)
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

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const dateField = searchParams.get('dateField') || 'dateSetup'
  const includeUnposted = searchParams.get('includeUnposted') === 'true'
  const jobStatuses = searchParams.get('jobStatuses') // comma-separated status IDs, empty = all

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'startDate and endDate are required (YYYY-MM-DD format)' },
      { status: 400 }
    )
  }

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

  // Stream the report generation with progress events
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }
      const progress = (message: string) => {
        send({ type: 'progress', message })
      }

      try {
        // Step 1: Find Jobs
        const [sYear, sMonth, sDay] = startDate.split('-').map(Number)
        const [eYear, eMonth, eDay] = endDate.split('-').map(Number)

        // Build job status filter XPath condition
        const statusFilter = jobStatuses
          ? jobStatuses.split(',').filter(Boolean).map(s => `@adminStatus = "${s.trim()}"`).join(' or ')
          : ''
        const statusXPath = statusFilter ? ` and (${statusFilter})` : ''

        let jobIds: string[]

        if (dateField === 'invoiceDate' || dateField === 'earliestInvoice' || dateField === 'latestInvoice') {
          const postedFilter = includeUnposted ? '' : ' and @posted = "true"'
          progress('Finding invoices in date range...')
          const invoiceXPath = `@invoiceDate >= date(${sYear}, ${sMonth}, ${sDay}) and @invoiceDate <= date(${eYear}, ${eMonth}, ${eDay})${postedFilter}`
          const invoiceIds = await fetchObjectIds(paceApiUrl, authHeader, 'Invoice', invoiceXPath, 50000)

          progress(`Found ${invoiceIds.length} invoices, reading job references...`)
          const jobIdSet = new Set<string>()
          const invBatchSize = 50
          for (let i = 0; i < invoiceIds.length; i += invBatchSize) {
            const batch = invoiceIds.slice(i, i + invBatchSize)
            const promises = batch.map(async (invId) => {
              try {
                const res = await fetch(
                  `${paceApiUrl}/ReadObject/readInvoice?primaryKey=${encodeURIComponent(invId)}`,
                  {
                    method: 'POST',
                    headers: { 'Accept': 'application/json', 'Authorization': authHeader },
                    body: '',
                  }
                )
                if (res.ok) {
                  const data = await res.json()
                  if (data.job) jobIdSet.add(String(data.job))
                }
              } catch (err) {
                console.error(`[Cost vs Estimate] Error reading Invoice ${invId}:`, err)
              }
            })
            await Promise.all(promises)
            if ((i + invBatchSize) % 200 === 0 || i + invBatchSize >= invoiceIds.length) {
              progress(`Reading invoices... ${Math.min(i + invBatchSize, invoiceIds.length)}/${invoiceIds.length} (${jobIdSet.size} jobs found)`)
            }
          }

          let candidateJobs = [...jobIdSet]
          console.log(`[Cost vs Estimate] Found ${candidateJobs.length} unique jobs from ${invoiceIds.length} invoices`)

          if ((dateField === 'earliestInvoice' || dateField === 'latestInvoice') && candidateJobs.length > 0) {
            const boundaryXPath = dateField === 'earliestInvoice'
              ? `@invoiceDate < date(${sYear}, ${sMonth}, ${sDay})${postedFilter}`
              : `@invoiceDate > date(${eYear}, ${eMonth}, ${eDay})${postedFilter}`

            progress(`Checking ${dateField === 'earliestInvoice' ? 'earliest' : 'latest'} invoice boundaries for ${candidateJobs.length} jobs...`)
            const jobsToExclude = new Set<string>()

            const boundaryBatchSize = 50
            for (let i = 0; i < candidateJobs.length; i += boundaryBatchSize) {
              const batch = candidateJobs.slice(i, i + boundaryBatchSize)
              const jobConditions = batch.map(id => `@job = "${id}"`).join(' or ')
              const xpath = `(${jobConditions}) and ${boundaryXPath}`

              try {
                const boundaryInvoiceIds = await fetchObjectIds(paceApiUrl, authHeader, 'Invoice', xpath, 50000)
                for (let j = 0; j < boundaryInvoiceIds.length; j += invBatchSize) {
                  const detailBatch = boundaryInvoiceIds.slice(j, j + invBatchSize)
                  const readPromises = detailBatch.map(async (bInvId) => {
                    try {
                      const res = await fetch(
                        `${paceApiUrl}/ReadObject/readInvoice?primaryKey=${encodeURIComponent(bInvId)}`,
                        {
                          method: 'POST',
                          headers: { 'Accept': 'application/json', 'Authorization': authHeader },
                          body: '',
                        }
                      )
                      if (res.ok) {
                        const data = await res.json()
                        if (data.job) jobsToExclude.add(String(data.job))
                      }
                    } catch {
                      // ignore individual read errors
                    }
                  })
                  await Promise.all(readPromises)
                }
              } catch (err) {
                console.error(`[Cost vs Estimate] Boundary check error for batch ${i}:`, err)
              }
            }

            const beforeCount = candidateJobs.length
            candidateJobs = candidateJobs.filter(id => !jobsToExclude.has(id))
            progress(`Boundary check done: ${beforeCount - candidateJobs.length} jobs excluded, ${candidateJobs.length} remaining`)
          }

          // Filter by job status if specified
          if (statusXPath && candidateJobs.length > 0) {
            progress(`Filtering ${candidateJobs.length} jobs by status...`)
            const validJobIds = new Set<string>()
            const statusBatchSize = 50

            for (let i = 0; i < candidateJobs.length; i += statusBatchSize) {
              const batch = candidateJobs.slice(i, i + statusBatchSize)
              const jobConditions = batch.map(id => `@id = "${id}"`).join(' or ')
              const xpath = `(${jobConditions})${statusXPath}`

              try {
                const matchedIds = await fetchObjectIds(paceApiUrl, authHeader, 'Job', xpath, 50000)
                matchedIds.forEach(id => validJobIds.add(id))
              } catch (err) {
                console.error(`[Cost vs Estimate] Status filter error for batch ${i}:`, err)
              }
            }

            const beforeCount = candidateJobs.length
            candidateJobs = candidateJobs.filter(id => validJobIds.has(id))
            progress(`Status filter: ${beforeCount - candidateJobs.length} jobs excluded, ${candidateJobs.length} remaining`)
          }

          jobIds = candidateJobs
        } else {
          progress('Finding jobs by entry date...')
          const jobsXPath = `@dateSetup >= date(${sYear}, ${sMonth}, ${sDay}) and @dateSetup <= date(${eYear}, ${eMonth}, ${eDay})${statusXPath}`
          jobIds = await fetchObjectIds(paceApiUrl, authHeader, 'Job', jobsXPath, 10000)
        }

        progress(`Found ${jobIds.length} jobs`)

        if (jobIds.length === 0) {
          send({
            type: 'complete',
            success: true,
            data: {
              dateRange: { startDate, endDate, dateField },
              departments: [],
              grandTotals: emptyTotals(),
              meta: { jobCount: 0, jobCostRecordCount: 0, uniqueActivityCodes: 0, uniqueCostCenters: 0 },
            },
          })
          controller.close()
          return
        }

        // Step 2: Fetch ALL JobCost records for those jobs
        let firstRawRecord: Record<string, unknown> | null = null
        const allJobCosts: JobCostRecord[] = []
        const jobBatchSize = 50
        const totalJobBatches = Math.ceil(jobIds.length / jobBatchSize)

        for (let i = 0; i < jobIds.length; i += jobBatchSize) {
          const currentBatch = Math.floor(i / jobBatchSize) + 1
          progress(`Fetching job cost records... batch ${currentBatch}/${totalJobBatches} (${allJobCosts.length} records so far)`)

          const jobBatch = jobIds.slice(i, i + jobBatchSize)
          const jobConditions = jobBatch.map(id => `@job = "${id}"`).join(' or ')
          const xpath = `(${jobConditions})`

          const queryParams = new URLSearchParams({
            type: 'JobCost',
            xpath,
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

            if (!response.ok) {
              console.error(`[Cost vs Estimate] JobCost query error for batch ${i}:`, await response.text())
              continue
            }

            const jobCostIds: string[] = await response.json()

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
                    const data = await detailResponse.json()

                    if (firstRawRecord === null) {
                      firstRawRecord = data
                      console.log('[Cost vs Estimate] === FIRST RAW JobCost RECORD ===')
                      console.log(JSON.stringify(data, null, 2))
                      console.log('[Cost vs Estimate] === END RAW RECORD ===')
                    }

                    return {
                      id: data.id,
                      job: data.job,
                      jobPart: data.jobPart,
                      activityCode: data.activityCode,
                      employee: data.employee,
                      chargeClass: data.chargeClass,
                      cost: data.cost || 0,
                      hours: data.hours || 0,
                      estimatedSell: data.estimatedSell || 0,
                      syReasonId: data.syReasonId ?? data.reasonId ?? null,
                      transType: data.jcttranstype ?? data.transType ?? data.jctTransType ?? null,
                      postedDate: data.postedDate,
                    } as JobCostRecord
                  }
                } catch (err) {
                  console.error(`[Cost vs Estimate] Error reading JobCost ${jcId}:`, err)
                }
                return null
              })

              const results = await Promise.all(detailPromises)
              allJobCosts.push(...(results.filter(Boolean) as JobCostRecord[]))
            }
          } catch (err) {
            console.error(`[Cost vs Estimate] Error fetching JobCost batch ${i}:`, err)
          }
        }

        progress(`Filtering ${allJobCosts.length} cost records...`)

        // Filter out records with transType = 13
        const isExcludedTransType = (jc: JobCostRecord) => jc.transType === 13 || jc.transType === '13'
        const excludedCount = allJobCosts.filter(isExcludedTransType).length
        const filteredJobCosts = allJobCosts.filter(jc => !isExcludedTransType(jc))
        console.log(`[Cost vs Estimate] Excluded ${excludedCount} records with transType=13, ${filteredJobCosts.length} records remaining`)

        // Step 3: Fetch ActivityCode details
        const uniqueActivityCodes = [...new Set(filteredJobCosts.map(jc => jc.activityCode).filter(Boolean))]
        progress(`Mapping ${uniqueActivityCodes.length} activity codes to cost centers...`)

        const activityCodeMap = new Map<string, { description: string; costCenter: string }>()

        const acBatchSize = 50
        for (let i = 0; i < uniqueActivityCodes.length; i += acBatchSize) {
          const batch = uniqueActivityCodes.slice(i, i + acBatchSize)
          const promises = batch.map(async (code) => {
            try {
              const response = await fetch(
                `${paceApiUrl}/ReadObject/readActivityCode?primaryKey=${encodeURIComponent(code)}`,
                {
                  method: 'POST',
                  headers: { 'Accept': 'application/json', 'Authorization': authHeader },
                  body: '',
                }
              )
              if (response.ok) {
                const data = await response.json()
                return { code, description: data.description || code, costCenter: data.costCenter || '' }
              }
            } catch (err) {
              console.error(`[Cost vs Estimate] Error reading ActivityCode ${code}:`, err)
            }
            return { code, description: code, costCenter: '' }
          })

          const results = await Promise.all(promises)
          results.forEach(r => activityCodeMap.set(r.code, { description: r.description, costCenter: r.costCenter }))
        }

        // Step 4: Fetch CostCenter details
        const uniqueCostCenters = [...new Set(
          [...activityCodeMap.values()].map(ac => ac.costCenter).filter(Boolean)
        )]
        progress(`Fetching ${uniqueCostCenters.length} cost center details...`)

        const costCenterMap = new Map<string, { description: string; department: string }>()

        const ccPromises = uniqueCostCenters.map(async (ccId) => {
          try {
            const response = await fetch(
              `${paceApiUrl}/ReadObject/readCostCenter?primaryKey=${encodeURIComponent(ccId)}`,
              {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Authorization': authHeader },
                body: '',
              }
            )
            if (response.ok) {
              const data = await response.json()
              return { id: ccId, description: data.description || ccId, department: data.department || '' }
            }
          } catch (err) {
            console.error(`[Cost vs Estimate] Error reading CostCenter ${ccId}:`, err)
          }
          return { id: ccId, description: ccId, department: '' }
        })

        const ccResults = await Promise.all(ccPromises)
        ccResults.forEach(r => costCenterMap.set(r.id, { description: r.description, department: r.department }))

        // Step 5: Fetch Department descriptions
        const uniqueDepartments = [...new Set(
          [...costCenterMap.values()].map(cc => cc.department).filter(Boolean)
        )]
        progress(`Fetching ${uniqueDepartments.length} department details...`)

        const departmentMap = new Map<string, string>()

        const deptPromises = uniqueDepartments.map(async (deptId) => {
          try {
            const response = await fetch(
              `${paceApiUrl}/ReadObject/readDepartment?primaryKey=${encodeURIComponent(deptId)}`,
              {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Authorization': authHeader },
                body: '',
              }
            )
            if (response.ok) {
              const data = await response.json()
              return { id: deptId, description: data.description || deptId }
            }
          } catch (err) {
            console.error(`[Cost vs Estimate] Error reading Department ${deptId}:`, err)
          }
          return { id: deptId, description: deptId }
        })

        const deptResults = await Promise.all(deptPromises)
        deptResults.forEach(r => departmentMap.set(r.id, r.description))

        // Step 6: Group and aggregate
        progress('Building report...')

        const isEstimate = (jc: JobCostRecord) => jc.chargeClass === 1 || jc.chargeClass === '1'
        const isActual = (jc: JobCostRecord) => jc.chargeClass === 9 || jc.chargeClass === '9'
        const isSpoilage = (jc: JobCostRecord) => jc.syReasonId === 1 || jc.syReasonId === '1'

        const costCenterRecords = new Map<string, JobCostRecord[]>()

        for (const jc of filteredJobCosts) {
          const acInfo = activityCodeMap.get(jc.activityCode)
          const ccId = acInfo?.costCenter || 'UNKNOWN'
          if (!costCenterRecords.has(ccId)) costCenterRecords.set(ccId, [])
          costCenterRecords.get(ccId)!.push(jc)
        }

        const departmentGroups = new Map<string, { description: string; costCenters: CostCenterRow[] }>()

        for (const [ccId, records] of costCenterRecords) {
          const ccInfo = costCenterMap.get(ccId)
          const deptId = ccInfo?.department || 'UNKNOWN'
          const deptDescription = departmentMap.get(deptId) || deptId

          const estimates = records.filter(isEstimate)
          const actuals = records.filter(isActual)

          const estimatedCost = estimates.reduce((sum, jc) => sum + (jc.cost || 0), 0)
          const totalActualCost = actuals.reduce((sum, jc) => sum + (jc.cost || 0), 0)

          const jobMap = new Map<string, { estimates: JobCostRecord[]; actuals: JobCostRecord[] }>()
          for (const jc of records) {
            if (!jobMap.has(jc.job)) jobMap.set(jc.job, { estimates: [], actuals: [] })
            const entry = jobMap.get(jc.job)!
            if (isEstimate(jc)) entry.estimates.push(jc)
            else if (isActual(jc)) entry.actuals.push(jc)
          }

          const jobs: JobBreakdown[] = [...jobMap.entries()].map(([jobId, { estimates: jobEst, actuals: jobAct }]) => {
            const jEstCost = jobEst.reduce((s, jc) => s + (jc.cost || 0), 0)
            const jActCost = jobAct.reduce((s, jc) => s + (jc.cost || 0), 0)
            return {
              jobId,
              estimatedSales: jobEst.reduce((s, jc) => s + (jc.estimatedSell || 0), 0),
              estimatedHours: jobEst.reduce((s, jc) => s + (jc.hours || 0), 0),
              actualHours: jobAct.reduce((s, jc) => s + (jc.hours || 0), 0),
              estimatedCost: jEstCost,
              totalActualCost: jActCost,
              costVariance: jEstCost - jActCost,
            }
          }).sort((a, b) => a.costVariance - b.costVariance)

          const row: CostCenterRow = {
            costCenterId: ccId,
            costCenterDescription: ccInfo?.description || ccId,
            estimatedSales: estimates.reduce((sum, jc) => sum + (jc.estimatedSell || 0), 0),
            estimatedHours: estimates.reduce((sum, jc) => sum + (jc.hours || 0), 0),
            actualHours: actuals.reduce((sum, jc) => sum + (jc.hours || 0), 0),
            estimatedCost,
            totalActualCost,
            costVariance: estimatedCost - totalActualCost,
            spoilageCost: records.filter(isSpoilage).reduce((sum, jc) => sum + (jc.cost || 0), 0),
            jobs,
          }

          if (!departmentGroups.has(deptId)) {
            departmentGroups.set(deptId, { description: deptDescription, costCenters: [] })
          }
          departmentGroups.get(deptId)!.costCenters.push(row)
        }

        const departments: DepartmentGroup[] = [...departmentGroups.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([deptId, group]) => {
            group.costCenters.sort((a, b) => a.costCenterId.localeCompare(b.costCenterId))

            const subtotals = {
              estimatedSales: group.costCenters.reduce((s, cc) => s + cc.estimatedSales, 0),
              estimatedHours: group.costCenters.reduce((s, cc) => s + cc.estimatedHours, 0),
              actualHours: group.costCenters.reduce((s, cc) => s + cc.actualHours, 0),
              estimatedCost: group.costCenters.reduce((s, cc) => s + cc.estimatedCost, 0),
              totalActualCost: group.costCenters.reduce((s, cc) => s + cc.totalActualCost, 0),
              costVariance: group.costCenters.reduce((s, cc) => s + cc.costVariance, 0),
              spoilageCost: group.costCenters.reduce((s, cc) => s + cc.spoilageCost, 0),
            }

            return {
              departmentId: deptId,
              departmentDescription: group.description,
              costCenters: group.costCenters,
              subtotals,
            }
          })

        const grandTotals = {
          estimatedSales: departments.reduce((s, d) => s + d.subtotals.estimatedSales, 0),
          estimatedHours: departments.reduce((s, d) => s + d.subtotals.estimatedHours, 0),
          actualHours: departments.reduce((s, d) => s + d.subtotals.actualHours, 0),
          estimatedCost: departments.reduce((s, d) => s + d.subtotals.estimatedCost, 0),
          totalActualCost: departments.reduce((s, d) => s + d.subtotals.totalActualCost, 0),
          costVariance: departments.reduce((s, d) => s + d.subtotals.costVariance, 0),
          spoilageCost: departments.reduce((s, d) => s + d.subtotals.spoilageCost, 0),
        }

        console.log(`[Cost vs Estimate] Done: ${departments.length} departments, ${uniqueCostCenters.length} cost centers`)

        send({
          type: 'complete',
          success: true,
          data: {
            dateRange: { startDate, endDate, dateField },
            departments,
            grandTotals,
            meta: {
              jobCount: jobIds.length,
              jobCostRecordCount: filteredJobCosts.length,
              excludedTransType13Count: excludedCount,
              uniqueActivityCodes: uniqueActivityCodes.length,
              uniqueCostCenters: uniqueCostCenters.length,
              ...(process.env.NODE_ENV === 'development' && firstRawRecord
                ? { _sampleJobCostRecord: firstRawRecord }
                : {}),
            },
          },
        })
      } catch (error) {
        console.error('[Cost vs Estimate] Error:', error)
        send({ type: 'error', error: error instanceof Error ? error.message : 'Internal server error' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

function emptyTotals() {
  return {
    estimatedSales: 0,
    estimatedHours: 0,
    actualHours: 0,
    estimatedCost: 0,
    totalActualCost: 0,
    costVariance: 0,
    spoilageCost: 0,
  }
}

async function fetchObjectIds(
  paceApiUrl: string,
  authHeader: string,
  type: string,
  xpath: string,
  limit: number = 10000
): Promise<string[]> {
  const queryParams = new URLSearchParams({
    type,
    xpath,
    offset: '0',
    limit: String(limit),
  })

  const queryUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${queryParams.toString()}`

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
    const errorText = await response.text()
    console.error(`[Cost vs Estimate] ${type} query error:`, errorText)
    throw new Error(`Failed to fetch ${type}: ${response.status}`)
  }

  return await response.json()
}
