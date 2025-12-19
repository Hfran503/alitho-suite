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

type PeriodData = {
  year: number
  label: string
  startDate: string
  endDate: string
  estimatedCost: number
  actualCost: number
  estimatedHours: number
  actualHours: number
  jobCount: number
  recordCount: number
}

type ActivityCodeSummary = {
  activityCode: string
  description: string
  years: PeriodData[]
}

type EmployeePeriodData = {
  year: number
  label: string
  hoursWorked: number
  estimatedHours: number
  cost: number
  jobCount: number
  efficiency: number
  avgCostPerHour: number
}

type EmployeeSummary = {
  employeeId: string
  employeeName: string
  years: EmployeePeriodData[]
}

const YEARS_TO_FETCH = 5

// GET /api/pace/activity-analysis - Analyze activity codes with 5-year comparison
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') // YYYY-MM-DD
    const endDate = searchParams.get('endDate') // YYYY-MM-DD
    const activityCodesParam = searchParams.getAll('activityCodes')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required (YYYY-MM-DD format)' },
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
        {
          error: 'PACE API not configured',
          message: error instanceof Error ? error.message : 'Failed to get PACE API credentials'
        },
        { status: 500 }
      )
    }

    const authHeader = `Basic ${Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')}`

    // Format dates for PACE XPath query
    const formatDateForXPath = (date: Date) => {
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const day = date.getDate()
      return `date(${year}, ${month}, ${day})`
    }

    // Calculate date ranges for each year
    const currentStart = new Date(startDate)
    const currentEnd = new Date(endDate)

    const yearRanges: Array<{ year: number; label: string; start: Date; end: Date; startStr: string; endStr: string }> = []

    for (let i = 0; i < YEARS_TO_FETCH; i++) {
      const yearStart = new Date(currentStart)
      yearStart.setFullYear(yearStart.getFullYear() - i)
      const yearEnd = new Date(currentEnd)
      yearEnd.setFullYear(yearEnd.getFullYear() - i)

      yearRanges.push({
        year: yearStart.getFullYear(),
        label: i === 0 ? 'Current' : `${yearStart.getFullYear()}`,
        start: yearStart,
        end: yearEnd,
        startStr: yearStart.toISOString().split('T')[0],
        endStr: yearEnd.toISOString().split('T')[0],
      })
    }

    // Fetch data for each year
    const yearDataMap = new Map<number, JobCostRecord[]>()

    for (const range of yearRanges) {
      console.log(`Fetching Jobs by dateSetup for ${range.label}: ${range.startStr} to ${range.endStr}...`)

      const jobsXPath = `@dateSetup >= ${formatDateForXPath(range.start)} and @dateSetup <= ${formatDateForXPath(range.end)}`
      const jobIds = await fetchJobIdsByXPath(paceApiUrl, authHeader, jobsXPath)
      console.log(`Found ${jobIds.length} Jobs for ${range.label}`)

      const jobCosts = await fetchJobCostsForJobs(paceApiUrl, authHeader, jobIds, activityCodesParam)
      console.log(`Found ${jobCosts.length} JobCost records for ${range.label}`)

      yearDataMap.set(range.year, jobCosts)
    }

    // Get unique activity codes and employees for enrichment
    const allActivityCodes = new Set<string>()
    const allEmployees = new Set<string>()

    yearDataMap.forEach(jobCosts => {
      jobCosts.forEach(jc => {
        if (jc.activityCode) allActivityCodes.add(jc.activityCode)
        if (jc.employee) allEmployees.add(jc.employee)
      })
    })

    // Fetch activity code descriptions
    console.log(`Fetching ${allActivityCodes.size} activity code descriptions...`)
    const activityCodeMap = await fetchActivityCodeDescriptions(
      paceApiUrl,
      authHeader,
      Array.from(allActivityCodes)
    )

    // Fetch employee names
    console.log(`Fetching ${allEmployees.size} employee names...`)
    const employeeMap = await fetchEmployeeNames(
      paceApiUrl,
      authHeader,
      Array.from(allEmployees)
    )

    // Build activity code summaries
    const activitySummaries = buildActivityCodeSummaries(yearRanges, yearDataMap, activityCodeMap)

    // Build employee summaries
    const employeeSummaries = buildEmployeeSummaries(yearRanges, yearDataMap, employeeMap)

    // Calculate overall totals for each year
    const isEstimate = (jc: JobCostRecord) => jc.chargeClass === 1 || jc.chargeClass === '1'
    const isActual = (jc: JobCostRecord) => jc.chargeClass === 9 || jc.chargeClass === '9'

    const totals: PeriodData[] = yearRanges.map(range => {
      const jobCosts = yearDataMap.get(range.year) || []
      return {
        year: range.year,
        label: range.label,
        startDate: range.startStr,
        endDate: range.endStr,
        estimatedCost: jobCosts.filter(isEstimate).reduce((sum, jc) => sum + (jc.cost || 0), 0),
        actualCost: jobCosts.filter(isActual).reduce((sum, jc) => sum + (jc.cost || 0), 0),
        estimatedHours: jobCosts.filter(isEstimate).reduce((sum, jc) => sum + (jc.hours || 0), 0),
        actualHours: jobCosts.filter(isActual).reduce((sum, jc) => sum + (jc.hours || 0), 0),
        jobCount: new Set(jobCosts.map(jc => jc.job)).size,
        recordCount: jobCosts.length,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        dateRange: {
          current: { startDate, endDate },
          years: yearRanges.map(r => ({
            year: r.year,
            label: r.label,
            startDate: r.startStr,
            endDate: r.endStr,
          })),
        },
        totals,
        activitySummaries,
        employeeSummaries,
      },
    })
  } catch (error) {
    console.error('Activity analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to fetch Job IDs by XPath (using dateSetup)
async function fetchJobIdsByXPath(
  paceApiUrl: string,
  authHeader: string,
  xpath: string
): Promise<string[]> {
  const queryParams = new URLSearchParams({
    type: 'Job',
    xpath: xpath,
    offset: '0',
    limit: '10000',
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
    console.error('Job query error:', errorText)
    throw new Error(`Failed to fetch Jobs: ${response.status}`)
  }

  const jobIds: string[] = await response.json()
  return jobIds
}

// Helper function to fetch JobCosts for specific jobs with optional activity code filter
// Batches job IDs to avoid URL length limits
async function fetchJobCostsForJobs(
  paceApiUrl: string,
  authHeader: string,
  jobIds: string[],
  activityCodes: string[]
): Promise<JobCostRecord[]> {
  if (jobIds.length === 0) {
    return []
  }

  // Batch job IDs to avoid URL length limits (50 jobs per batch)
  const jobBatchSize = 50
  const allJobCostIds: string[] = []

  for (let i = 0; i < jobIds.length; i += jobBatchSize) {
    const jobBatch = jobIds.slice(i, i + jobBatchSize)

    // Build XPath query for this batch of job IDs
    const jobConditions = jobBatch.map(id => `@job = "${id}"`).join(' or ')
    let xpath = `(${jobConditions})`

    // Add activity code filter if specified
    if (activityCodes.length > 0) {
      const activityConditions = activityCodes.map(code => `@activityCode = "${code}"`).join(' or ')
      xpath = `${xpath} and (${activityConditions})`
    }

    const queryParams = new URLSearchParams({
      type: 'JobCost',
      xpath: xpath,
      offset: '0',
      limit: '50000',
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
      console.error('JobCost query error:', errorText)
      throw new Error(`Failed to fetch JobCosts: ${response.status}`)
    }

    const batchJobCostIds: string[] = await response.json()
    allJobCostIds.push(...batchJobCostIds)
  }

  if (allJobCostIds.length === 0) {
    return []
  }

  console.log(`Fetching details for ${allJobCostIds.length} JobCost records...`)

  // Fetch details in batches
  const detailBatchSize = 50
  const allDetails: JobCostRecord[] = []

  for (let i = 0; i < allJobCostIds.length; i += detailBatchSize) {
    const batch = allJobCostIds.slice(i, i + detailBatchSize)

    const batchPromises = batch.map(async (jobCostId) => {
      try {
        const detailResponse = await fetch(
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

        if (detailResponse.ok) {
          return await detailResponse.json()
        }
      } catch (err) {
        console.error(`Error fetching JobCost ${jobCostId}:`, err)
      }
      return null
    })

    const batchResults = await Promise.all(batchPromises)
    allDetails.push(...batchResults.filter(Boolean))
  }

  return allDetails
}

// Helper function to fetch activity code descriptions
async function fetchActivityCodeDescriptions(
  paceApiUrl: string,
  authHeader: string,
  activityCodes: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()

  const promises = activityCodes.map(async (code) => {
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

  const results = await Promise.all(promises)
  results.forEach(r => map.set(r.code, r.description))

  return map
}

// Helper function to fetch employee names
async function fetchEmployeeNames(
  paceApiUrl: string,
  authHeader: string,
  employeeIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()

  const promises = employeeIds.map(async (empId) => {
    try {
      const response = await fetch(
        `${paceApiUrl}/ReadObject/readEmployee?primaryKey=${encodeURIComponent(empId)}`,
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
        const name = data.name || data.firstName
          ? `${data.firstName || ''} ${data.lastName || ''}`.trim()
          : empId
        return { empId, name: name || empId }
      }
    } catch (err) {
      console.error(`Error fetching Employee ${empId}:`, err)
    }
    return { empId, name: empId }
  })

  const results = await Promise.all(promises)
  results.forEach(r => map.set(r.empId, r.name))

  return map
}

// Helper function to build activity code summaries for all years
function buildActivityCodeSummaries(
  yearRanges: Array<{ year: number; label: string; startStr: string; endStr: string }>,
  yearDataMap: Map<number, JobCostRecord[]>,
  activityCodeMap: Map<string, string>
): ActivityCodeSummary[] {
  const isEstimate = (jc: JobCostRecord) => jc.chargeClass === 1 || jc.chargeClass === '1'
  const isActual = (jc: JobCostRecord) => jc.chargeClass === 9 || jc.chargeClass === '9'

  // Get all unique activity codes across all years
  const allCodes = new Set<string>()
  yearDataMap.forEach(jobCosts => {
    jobCosts.forEach(jc => {
      if (jc.activityCode) allCodes.add(jc.activityCode)
    })
  })

  const summaries: ActivityCodeSummary[] = []

  allCodes.forEach(code => {
    const years: PeriodData[] = yearRanges.map(range => {
      const jobCosts = yearDataMap.get(range.year) || []
      const codeJobCosts = jobCosts.filter(jc => jc.activityCode === code)

      return {
        year: range.year,
        label: range.label,
        startDate: range.startStr,
        endDate: range.endStr,
        estimatedCost: codeJobCosts.filter(isEstimate).reduce((sum, jc) => sum + (jc.cost || 0), 0),
        actualCost: codeJobCosts.filter(isActual).reduce((sum, jc) => sum + (jc.cost || 0), 0),
        estimatedHours: codeJobCosts.filter(isEstimate).reduce((sum, jc) => sum + (jc.hours || 0), 0),
        actualHours: codeJobCosts.filter(isActual).reduce((sum, jc) => sum + (jc.hours || 0), 0),
        jobCount: new Set(codeJobCosts.map(jc => jc.job)).size,
        recordCount: codeJobCosts.length,
      }
    })

    summaries.push({
      activityCode: code,
      description: activityCodeMap.get(code) || code,
      years,
    })
  })

  // Sort by current year actual cost descending
  return summaries.sort((a, b) => {
    const aCurrent = a.years.find(y => y.label === 'Current')?.actualCost || 0
    const bCurrent = b.years.find(y => y.label === 'Current')?.actualCost || 0
    return bCurrent - aCurrent
  })
}

// Helper function to build employee summaries for all years
function buildEmployeeSummaries(
  yearRanges: Array<{ year: number; label: string; startStr: string; endStr: string }>,
  yearDataMap: Map<number, JobCostRecord[]>,
  employeeMap: Map<string, string>
): EmployeeSummary[] {
  const isEstimate = (jc: JobCostRecord) => jc.chargeClass === 1 || jc.chargeClass === '1'
  const isActual = (jc: JobCostRecord) => jc.chargeClass === 9 || jc.chargeClass === '9'

  // Get all unique employees across all years
  const allEmployees = new Set<string>()
  yearDataMap.forEach(jobCosts => {
    jobCosts.forEach(jc => {
      if (jc.employee) allEmployees.add(jc.employee)
    })
  })

  const summaries: EmployeeSummary[] = []

  allEmployees.forEach(empId => {
    const years: EmployeePeriodData[] = yearRanges.map(range => {
      const jobCosts = yearDataMap.get(range.year) || []
      const empJobCosts = jobCosts.filter(jc => jc.employee === empId)

      const hoursWorked = empJobCosts.filter(isActual).reduce((sum, jc) => sum + (jc.hours || 0), 0)
      const estimatedHours = empJobCosts.filter(isEstimate).reduce((sum, jc) => sum + (jc.hours || 0), 0)
      const cost = empJobCosts.filter(isActual).reduce((sum, jc) => sum + (jc.cost || 0), 0)
      const jobCount = new Set(empJobCosts.filter(isActual).map(jc => jc.job)).size

      return {
        year: range.year,
        label: range.label,
        hoursWorked,
        estimatedHours,
        cost,
        jobCount,
        efficiency: hoursWorked > 0 && estimatedHours > 0 ? (estimatedHours / hoursWorked) * 100 : 0,
        avgCostPerHour: hoursWorked > 0 ? cost / hoursWorked : 0,
      }
    })

    // Only include if they have any hours in any year
    const hasAnyHours = years.some(y => y.hoursWorked > 0)
    if (hasAnyHours) {
      summaries.push({
        employeeId: empId,
        employeeName: employeeMap.get(empId) || empId,
        years,
      })
    }
  })

  // Sort by current year hours worked descending
  return summaries.sort((a, b) => {
    const aCurrent = a.years.find(y => y.label === 'Current')?.hoursWorked || 0
    const bCurrent = b.years.find(y => y.label === 'Current')?.hoursWorked || 0
    return bCurrent - aCurrent
  })
}
