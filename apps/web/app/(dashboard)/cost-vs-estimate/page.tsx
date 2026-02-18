'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'

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

type Totals = Omit<CostCenterRow, 'costCenterId' | 'costCenterDescription' | 'jobs'>

type DepartmentGroup = {
  departmentId: string
  departmentDescription: string
  costCenters: CostCenterRow[]
  subtotals: Totals
}

type DateField = 'dateSetup' | 'invoiceDate' | 'earliestInvoice' | 'latestInvoice'

type ReportData = {
  dateRange: { startDate: string; endDate: string; dateField: string }
  departments: DepartmentGroup[]
  grandTotals: Totals
  meta: {
    jobCount: number
    jobCostRecordCount: number
    uniqueActivityCodes: number
    uniqueCostCenters: number
  }
}

type JobDetail = {
  job: string
  description: string
  customer: string
  customerName: string
  dateSetup: string
}

type ModalData = {
  costCenterId: string
  costCenterDescription: string
  jobs: JobBreakdown[]
}

type JobStatus = {
  id: string
  description: string
}

type DatePreset = 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'ytd' | 'lastYear' | 'custom'

function getDatePresetRange(preset: DatePreset): { startDate: string; endDate: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  switch (preset) {
    case 'thisMonth': {
      const start = new Date(year, month, 1)
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
      }
    }
    case 'lastMonth': {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 0)
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      }
    }
    case 'thisQuarter': {
      const quarterStart = Math.floor(month / 3) * 3
      const start = new Date(year, quarterStart, 1)
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
      }
    }
    case 'lastQuarter': {
      const currentQuarterStart = Math.floor(month / 3) * 3
      const start = new Date(year, currentQuarterStart - 3, 1)
      const end = new Date(year, currentQuarterStart, 0)
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      }
    }
    case 'ytd': {
      const start = new Date(year, 0, 1)
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
      }
    }
    case 'lastYear': {
      const start = new Date(year - 1, 0, 1)
      const end = new Date(year - 1, 11, 31)
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      }
    }
    default:
      return {
        startDate: new Date(year, month, 1).toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
      }
  }
}

export default function CostVsEstimatePage() {
  const [datePreset, setDatePreset] = useState<DatePreset>('lastYear')
  const [dateField, setDateField] = useState<DateField>('dateSetup')
  const [includeUnposted, setIncludeUnposted] = useState(false)
  const [availableStatuses, setAvailableStatuses] = useState<JobStatus[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [progressMessage, setProgressMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hasRun, setHasRun] = useState(false)
  const [collapsedDepartments, setCollapsedDepartments] = useState<Set<string>>(new Set())

  // Modal state
  const [modalData, setModalData] = useState<ModalData | null>(null)
  const [jobDetails, setJobDetails] = useState<Map<string, JobDetail>>(new Map())
  const [loadingJobDetails, setLoadingJobDetails] = useState(false)
  const [modalSortField, setModalSortField] = useState<'costVariance' | 'totalActualCost' | 'jobId'>('costVariance')
  const [modalSortDir, setModalSortDir] = useState<'asc' | 'desc'>('asc')
  const modalRef = useRef<HTMLDivElement>(null)

  // Fetch available job statuses on mount
  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const res = await fetch('/api/pace/job-statuses')
        if (res.ok) {
          const result = await res.json()
          if (result.success) setAvailableStatuses(result.data)
        }
      } catch {
        console.error('Failed to fetch job statuses')
      }
    }
    fetchStatuses()
  }, [])

  // Close status dropdown on outside click
  useEffect(() => {
    if (!statusDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [statusDropdownOpen])

  // Fetch job details when modal opens
  useEffect(() => {
    if (!modalData) return

    const jobIds = modalData.jobs.map(j => j.jobId)
    const missing = jobIds.filter(id => !jobDetails.has(id))
    if (missing.length === 0) return

    setLoadingJobDetails(true)

    // Fetch in batches of 10
    const fetchBatch = async (ids: string[]) => {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`/api/pace/jobs/${encodeURIComponent(id)}`)
            if (res.ok) {
              const job = await res.json()
              return {
                job: id,
                description: job.description || '',
                customer: job.customer || '',
                customerName: job.customerName || job.custName || job.customer || '',
                dateSetup: job.dateSetup || '',
              } as JobDetail
            }
          } catch {
            // ignore individual failures
          }
          return { job: id, description: '', customer: '', customerName: '', dateSetup: '' } as JobDetail
        })
      )
      return results
    }

    const loadAll = async () => {
      const newDetails = new Map(jobDetails)
      for (let i = 0; i < missing.length; i += 10) {
        const batch = missing.slice(i, i + 10)
        const results = await fetchBatch(batch)
        results.forEach(r => newDetails.set(r.job, r))
        // Update progressively so the UI shows results as they come in
        setJobDetails(new Map(newDetails))
      }
      setLoadingJobDetails(false)
    }

    loadAll()
  }, [modalData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close modal on Escape or click outside
  useEffect(() => {
    if (!modalData) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalData(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [modalData])

  const openCostCenterModal = (cc: CostCenterRow) => {
    setModalData({
      costCenterId: cc.costCenterId,
      costCenterDescription: cc.costCenterDescription,
      jobs: cc.jobs,
    })
  }

  const hasAnyValue = (j: JobBreakdown) =>
    j.estimatedSales !== 0 || j.estimatedCost !== 0 || j.totalActualCost !== 0 || j.costVariance !== 0

  const getSortedModalJobs = () => {
    if (!modalData) return []
    return [...modalData.jobs]
      .filter(hasAnyValue)
      .sort((a, b) => {
        let cmp = 0
        if (modalSortField === 'costVariance') cmp = a.costVariance - b.costVariance
        else if (modalSortField === 'totalActualCost') cmp = b.totalActualCost - a.totalActualCost
        else cmp = a.jobId.localeCompare(b.jobId)
        return modalSortDir === 'desc' ? -cmp : cmp
      })
  }

  const toggleModalSort = (field: typeof modalSortField) => {
    if (modalSortField === field) {
      setModalSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setModalSortField(field)
      setModalSortDir(field === 'jobId' ? 'asc' : 'asc')
    }
  }

  const getEffectiveDateRange = useCallback(() => {
    if (datePreset === 'custom') {
      return { startDate: customStartDate, endDate: customEndDate }
    }
    return getDatePresetRange(datePreset)
  }, [datePreset, customStartDate, customEndDate])

  const canRunReport = () => {
    const { startDate, endDate } = getEffectiveDateRange()
    return startDate && endDate
  }

  const fetchData = useCallback(async () => {
    const { startDate, endDate } = getEffectiveDateRange()
    if (!startDate || !endDate) {
      setError('Please select a valid date range')
      return
    }

    setLoading(true)
    setError(null)
    setHasRun(true)
    setProgressMessage('Connecting...')

    try {
      const params = new URLSearchParams({ startDate, endDate, dateField })
      if (includeUnposted) params.set('includeUnposted', 'true')
      if (selectedStatuses.length > 0) params.set('jobStatuses', selectedStatuses.join(','))
      const response = await fetch(`/api/pace/cost-vs-estimate?${params.toString()}`)

      if (!response.ok) {
        // Auth/validation errors come as plain JSON
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API Error: ${response.status}`)
      }

      // Read SSE stream
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse complete SSE events (separated by double newlines)
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const event of events) {
          const dataLine = event.split('\n').find(l => l.startsWith('data: '))
          if (!dataLine) continue

          try {
            const parsed = JSON.parse(dataLine.slice(6))
            if (parsed.type === 'progress') {
              setProgressMessage(parsed.message)
            } else if (parsed.type === 'complete') {
              if (parsed.success) {
                setData(parsed.data)
              } else {
                throw new Error('Report generation failed')
              }
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error || 'Server error')
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) {
              console.error('Failed to parse SSE event:', dataLine)
            } else {
              throw parseErr
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
      setProgressMessage('')
    }
  }, [getEffectiveDateRange, dateField, includeUnposted, selectedStatuses])

  const toggleDepartment = (deptId: string) => {
    setCollapsedDepartments(prev => {
      const next = new Set(prev)
      if (next.has(deptId)) {
        next.delete(deptId)
      } else {
        next.add(deptId)
      }
      return next
    })
  }

  const formatCurrency = (value: number) => {
    const prefix = value < 0 ? '-' : ''
    return prefix + '$' + Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatHours = (value: number) => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const getDateFieldLabel = (df: string) => {
    switch (df) {
      case 'invoiceDate': return 'Invoiced'
      case 'earliestInvoice': return 'First Invoiced'
      case 'latestInvoice': return 'Last Invoiced'
      default: return 'Jobs Created'
    }
  }

  const handleExportToExcel = () => {
    if (!data) return

    const rows: (string | number)[][] = [
      ['Cost vs. Estimate'],
      [`Cost Centers | Analysis of Job Costs vs. Estimates ${getDateFieldLabel(data.dateRange.dateField)} Within ${data.dateRange.startDate} to ${data.dateRange.endDate}`],
      [],
      ['Cost Center', 'Estimated Sales', 'Estimated Hours', 'Actual Hours', 'Estimated Cost', 'Total Actual Cost', 'Cost Variance', 'Spoilage Cost'],
    ]

    data.departments.forEach(dept => {
      rows.push([`Department  ${dept.departmentId} - ${dept.departmentDescription}`])
      dept.costCenters.forEach(cc => {
        rows.push([
          `${cc.costCenterId} - ${cc.costCenterDescription}`,
          cc.estimatedSales, cc.estimatedHours, cc.actualHours,
          cc.estimatedCost, cc.totalActualCost, cc.costVariance, cc.spoilageCost,
        ])
      })
      rows.push([
        `Totals for Department ${dept.departmentId}`,
        dept.subtotals.estimatedSales, dept.subtotals.estimatedHours, dept.subtotals.actualHours,
        dept.subtotals.estimatedCost, dept.subtotals.totalActualCost, dept.subtotals.costVariance, dept.subtotals.spoilageCost,
      ])
      rows.push([])
    })

    rows.push([
      'Grand Total',
      data.grandTotals.estimatedSales, data.grandTotals.estimatedHours, data.grandTotals.actualHours,
      data.grandTotals.estimatedCost, data.grandTotals.totalActualCost, data.grandTotals.costVariance, data.grandTotals.spoilageCost,
    ])

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Cost vs Estimate')
    XLSX.writeFile(wb, `Cost_vs_Estimate_${data.dateRange.startDate}_to_${data.dateRange.endDate}.xlsx`)
  }

  const handlePrintReport = () => {
    if (!data) return

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Cost vs. Estimate</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      color: #1f2937;
      font-size: 11px;
      line-height: 1.4;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .header h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .header .subtitle { color: #6b7280; font-size: 12px; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th {
      background: #e5e7eb;
      padding: 6px 10px;
      text-align: right;
      font-weight: 600;
      border-bottom: 2px solid #9ca3af;
    }
    th:first-child { text-align: left; }
    td {
      padding: 5px 10px;
      text-align: right;
      border-bottom: 1px solid #e5e7eb;
    }
    td:first-child { text-align: left; }
    .dept-header td {
      background: #f3f4f6;
      font-weight: 700;
      padding: 8px 10px;
      border-bottom: 1px solid #d1d5db;
    }
    .dept-total td {
      font-weight: 600;
      border-top: 2px solid #9ca3af;
      border-bottom: 2px solid #9ca3af;
      padding: 6px 10px;
    }
    .grand-total td {
      font-weight: 700;
      border-top: 3px double #374151;
      border-bottom: 3px double #374151;
      padding: 8px 10px;
      font-size: 12px;
    }
    .negative { color: #dc2626; }
    .footer {
      margin-top: 16px;
      text-align: center;
      color: #9ca3af;
      font-size: 10px;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Cost vs. Estimate</h1>
    <div class="subtitle">Cost Centers | Analysis of Job Costs vs. Estimates ${getDateFieldLabel(data.dateRange.dateField)} Within ${data.dateRange.startDate} to ${data.dateRange.endDate}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Cost Center</th>
        <th>Estimated Sales</th>
        <th>Estimated Hours</th>
        <th>Actual Hours</th>
        <th>Estimated Cost</th>
        <th>Total Actual Cost</th>
        <th>Cost Variance</th>
        <th>Spoilage Cost</th>
      </tr>
    </thead>
    <tbody>
      ${data.departments.map(dept => `
        <tr class="dept-header">
          <td colspan="8">Department  ${dept.departmentId} - ${dept.departmentDescription}</td>
        </tr>
        ${dept.costCenters.map(cc => `
          <tr>
            <td><strong>${cc.costCenterId}</strong> - ${cc.costCenterDescription}</td>
            <td>${fmtC(cc.estimatedSales)}</td>
            <td>${fmtH(cc.estimatedHours)}</td>
            <td>${fmtH(cc.actualHours)}</td>
            <td>${fmtC(cc.estimatedCost)}</td>
            <td>${fmtC(cc.totalActualCost)}</td>
            <td class="${cc.costVariance < 0 ? 'negative' : ''}">${fmtC(cc.costVariance)}</td>
            <td>${fmtC(cc.spoilageCost)}</td>
          </tr>
        `).join('')}
        <tr class="dept-total">
          <td>Totals for Department ${dept.departmentId}</td>
          <td>${fmtC(dept.subtotals.estimatedSales)}</td>
          <td>${fmtH(dept.subtotals.estimatedHours)}</td>
          <td>${fmtH(dept.subtotals.actualHours)}</td>
          <td>${fmtC(dept.subtotals.estimatedCost)}</td>
          <td>${fmtC(dept.subtotals.totalActualCost)}</td>
          <td class="${dept.subtotals.costVariance < 0 ? 'negative' : ''}">${fmtC(dept.subtotals.costVariance)}</td>
          <td>${fmtC(dept.subtotals.spoilageCost)}</td>
        </tr>
      `).join('')}
      <tr class="grand-total">
        <td>Grand Total</td>
        <td>${fmtC(data.grandTotals.estimatedSales)}</td>
        <td>${fmtH(data.grandTotals.estimatedHours)}</td>
        <td>${fmtH(data.grandTotals.actualHours)}</td>
        <td>${fmtC(data.grandTotals.estimatedCost)}</td>
        <td>${fmtC(data.grandTotals.totalActualCost)}</td>
        <td class="${data.grandTotals.costVariance < 0 ? 'negative' : ''}">${fmtC(data.grandTotals.costVariance)}</td>
        <td>${fmtC(data.grandTotals.spoilageCost)}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    Generated on ${new Date().toLocaleString()} &bull; ${data.meta.jobCount} jobs &bull; ${data.meta.jobCostRecordCount} cost records
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>
    `

    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
  }

  // Print helpers (used in template literal)
  const fmtC = (v: number) => {
    const prefix = v < 0 ? '-' : ''
    return prefix + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  const fmtH = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-4 flex-shrink-0">
        <div className="px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Cost vs. Estimate</h1>
              <p className="text-sm text-gray-500 mt-1">
                Analysis of Job Costs vs. Estimates by Cost Center
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border-b border-gray-200 py-4 flex-shrink-0">
        <div className="px-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
              >
                <option value="custom">Custom Range</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="thisQuarter">This Quarter</option>
                <option value="lastQuarter">Last Quarter</option>
                <option value="ytd">Year to Date</option>
                <option value="lastYear">Last Year</option>
              </select>
            </div>

            {/* Date Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Field</label>
              <select
                value={dateField}
                onChange={(e) => setDateField(e.target.value as DateField)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
              >
                <option value="dateSetup">Entry Date (Job Setup)</option>
                <option value="invoiceDate">Invoice Date (Any)</option>
                <option value="earliestInvoice">Earliest Invoice Date</option>
                <option value="latestInvoice">Latest Invoice Date</option>
              </select>
            </div>

            {/* Include unposted invoices toggle (only for invoice modes) */}
            {dateField !== 'dateSetup' && (
              <div className="flex items-center self-end pb-1">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeUnposted}
                    onChange={(e) => setIncludeUnposted(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Include unposted invoices
                </label>
              </div>
            )}

            {/* Job Status Filter */}
            {availableStatuses.length > 0 && (
              <div className="relative" ref={statusDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Status</label>
                <button
                  type="button"
                  onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm min-w-[180px] text-left flex items-center justify-between gap-2"
                >
                  <span className="truncate">
                    {selectedStatuses.length === 0
                      ? 'All Statuses'
                      : `${selectedStatuses.length} selected`}
                  </span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {statusDropdownOpen && (
                  <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-72 max-h-64 overflow-auto">
                    {/* Select All / Clear */}
                    <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setSelectedStatuses(availableStatuses.map(s => s.id))}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedStatuses([])}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Clear
                      </button>
                    </div>
                    {availableStatuses.map(status => (
                      <label
                        key={status.id}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes(status.id)}
                          onChange={(e) => {
                            setSelectedStatuses(prev =>
                              e.target.checked
                                ? [...prev, status.id]
                                : prev.filter(id => id !== status.id)
                            )
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-mono text-gray-500 w-8 text-right">{status.id}</span>
                        <span className="text-gray-700 truncate">{status.description}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {datePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <span className="text-gray-500 text-sm">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            )}

            {/* Run Button */}
            <button
              onClick={fetchData}
              disabled={loading || !canRunReport()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Running...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Run Report
                </>
              )}
            </button>

            {data && (
              <>
                <button
                  onClick={handleExportToExcel}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
                  title="Export to Excel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export
                </button>
                <button
                  onClick={handlePrintReport}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
                  title="Print Report"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Initial State */}
      {!hasRun && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Generate Report</h3>
            <p className="text-gray-500 mb-4">
              Select a date range and click &ldquo;Run Report&rdquo; to view Cost vs. Estimate data grouped by Cost Center and Department.
            </p>
            <p className="text-sm text-gray-400">
              Filter by Job Entry Date or Invoice Date.
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-600 font-medium">Generating Cost vs. Estimate report...</p>
            <p className="text-blue-600 text-sm mt-2 font-medium min-h-[20px]">{progressMessage}</p>
          </div>
        </div>
      )}

      {/* Report Table */}
      {!loading && hasRun && data && (
        <div className="flex-1 overflow-auto">
          <div className="p-4">
            {/* Report Header */}
            <div className="text-center mb-4">
              <p className="text-sm text-gray-500">
                Cost Centers | Analysis of Job Costs vs. Estimates {getDateFieldLabel(data.dateRange.dateField)} Within {data.dateRange.startDate} to {data.dateRange.endDate}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {data.meta.jobCount} jobs &bull; {data.meta.jobCostRecordCount} cost records &bull; {data.meta.uniqueCostCenters} cost centers
              </p>
            </div>

            {data.departments.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No cost data found for the selected date range.
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Cost Center</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Estimated Sales</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Estimated Hours</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Actual Hours</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Estimated Cost</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Total Actual Cost</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Cost Variance</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Spoilage Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.departments.map(dept => (
                      <React.Fragment key={dept.departmentId}>
                        {/* Department Header */}
                        <tr
                          className="bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => toggleDepartment(dept.departmentId)}
                        >
                          <td colSpan={8} className="px-4 py-2.5 font-bold text-gray-800">
                            <div className="flex items-center gap-2">
                              <svg
                                className={`w-4 h-4 text-gray-400 transition-transform ${collapsedDepartments.has(dept.departmentId) ? '' : 'rotate-90'}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              Department  {dept.departmentId} - {dept.departmentDescription}
                            </div>
                          </td>
                        </tr>

                        {/* Cost Center Rows */}
                        {!collapsedDepartments.has(dept.departmentId) && dept.costCenters.map(cc => (
                          <tr
                            key={cc.costCenterId}
                            className="border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer"
                            onClick={() => openCostCenterModal(cc)}
                            title="Click to see job breakdown"
                          >
                            <td className="px-4 py-2 pl-10">
                              <span className="font-semibold text-gray-800">{cc.costCenterId}</span>
                              <span className="text-gray-600"> - {cc.costCenterDescription}</span>
                              <span className="ml-2 text-xs text-gray-400">({cc.jobs.length} jobs)</span>
                            </td>
                            <td className="text-right px-4 py-2 text-gray-800">{formatCurrency(cc.estimatedSales)}</td>
                            <td className="text-right px-4 py-2 text-gray-800">{formatHours(cc.estimatedHours)}</td>
                            <td className="text-right px-4 py-2 text-gray-800">{formatHours(cc.actualHours)}</td>
                            <td className="text-right px-4 py-2 text-gray-800">{formatCurrency(cc.estimatedCost)}</td>
                            <td className="text-right px-4 py-2 text-gray-800">{formatCurrency(cc.totalActualCost)}</td>
                            <td className={`text-right px-4 py-2 font-medium ${cc.costVariance < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                              {formatCurrency(cc.costVariance)}
                            </td>
                            <td className="text-right px-4 py-2 text-gray-800">{formatCurrency(cc.spoilageCost)}</td>
                          </tr>
                        ))}

                        {/* Department Subtotal */}
                        <tr className="border-b-2 border-gray-300 bg-gray-50">
                          <td className="px-4 py-2 font-semibold text-gray-700">
                            Totals for Department {dept.departmentId}
                          </td>
                          <td className="text-right px-4 py-2 font-semibold text-gray-800">{formatCurrency(dept.subtotals.estimatedSales)}</td>
                          <td className="text-right px-4 py-2 font-semibold text-gray-800">{formatHours(dept.subtotals.estimatedHours)}</td>
                          <td className="text-right px-4 py-2 font-semibold text-gray-800">{formatHours(dept.subtotals.actualHours)}</td>
                          <td className="text-right px-4 py-2 font-semibold text-gray-800">{formatCurrency(dept.subtotals.estimatedCost)}</td>
                          <td className="text-right px-4 py-2 font-semibold text-gray-800">{formatCurrency(dept.subtotals.totalActualCost)}</td>
                          <td className={`text-right px-4 py-2 font-semibold ${dept.subtotals.costVariance < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                            {formatCurrency(dept.subtotals.costVariance)}
                          </td>
                          <td className="text-right px-4 py-2 font-semibold text-gray-800">{formatCurrency(dept.subtotals.spoilageCost)}</td>
                        </tr>
                      </React.Fragment>
                    ))}

                    {/* Grand Total */}
                    <tr className="bg-gray-800 text-white">
                      <td className="px-4 py-3 font-bold">Grand Total</td>
                      <td className="text-right px-4 py-3 font-bold">{formatCurrency(data.grandTotals.estimatedSales)}</td>
                      <td className="text-right px-4 py-3 font-bold">{formatHours(data.grandTotals.estimatedHours)}</td>
                      <td className="text-right px-4 py-3 font-bold">{formatHours(data.grandTotals.actualHours)}</td>
                      <td className="text-right px-4 py-3 font-bold">{formatCurrency(data.grandTotals.estimatedCost)}</td>
                      <td className="text-right px-4 py-3 font-bold">{formatCurrency(data.grandTotals.totalActualCost)}</td>
                      <td className={`text-right px-4 py-3 font-bold ${data.grandTotals.costVariance < 0 ? 'text-red-300' : ''}`}>
                        {formatCurrency(data.grandTotals.costVariance)}
                      </td>
                      <td className="text-right px-4 py-3 font-bold">{formatCurrency(data.grandTotals.spoilageCost)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Job Breakdown Modal */}
      {modalData && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalData(null) }}
        >
          <div
            ref={modalRef}
            className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Job Breakdown: {modalData.costCenterId} - {modalData.costCenterDescription}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {getSortedModalJobs().length} jobs with cost data
                  {modalData.jobs.length - getSortedModalJobs().length > 0 && (
                    <span className="text-gray-400"> ({modalData.jobs.length - getSortedModalJobs().length} zero-value hidden)</span>
                  )}
                  {' '}&bull; Sorted by {modalSortField === 'costVariance' ? 'variance' : modalSortField === 'totalActualCost' ? 'actual cost' : 'job #'} ({modalSortDir})
                  {loadingJobDetails && <span className="ml-2 text-blue-500">Loading job details...</span>}
                </p>
              </div>
              <button
                onClick={() => setModalData(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th
                      className="text-left px-4 py-2.5 font-semibold text-gray-700 cursor-pointer hover:text-blue-600"
                      onClick={() => toggleModalSort('jobId')}
                    >
                      Job # {modalSortField === 'jobId' && (modalSortDir === 'asc' ? '\u25B2' : '\u25BC')}
                    </th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-700">Description</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-700">Customer</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-700">Est. Sales</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-700">Est. Cost</th>
                    <th
                      className="text-right px-4 py-2.5 font-semibold text-gray-700 cursor-pointer hover:text-blue-600"
                      onClick={() => toggleModalSort('totalActualCost')}
                    >
                      Actual Cost {modalSortField === 'totalActualCost' && (modalSortDir === 'asc' ? '\u25B2' : '\u25BC')}
                    </th>
                    <th
                      className="text-right px-4 py-2.5 font-semibold text-gray-700 cursor-pointer hover:text-blue-600"
                      onClick={() => toggleModalSort('costVariance')}
                    >
                      Variance {modalSortField === 'costVariance' && (modalSortDir === 'asc' ? '\u25B2' : '\u25BC')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedModalJobs().map((job) => {
                    const detail = jobDetails.get(job.jobId)
                    return (
                      <tr key={job.jobId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono font-medium text-blue-600">{job.jobId}</td>
                        <td className="px-4 py-2 text-gray-700 max-w-[200px] truncate" title={detail?.description}>
                          {detail?.description || (loadingJobDetails ? <span className="text-gray-300">Loading...</span> : '-')}
                        </td>
                        <td className="px-4 py-2 text-gray-600 max-w-[150px] truncate" title={detail?.customerName}>
                          {detail?.customerName || (loadingJobDetails ? <span className="text-gray-300">Loading...</span> : '-')}
                        </td>
                        <td className="text-right px-4 py-2 text-gray-800">{formatCurrency(job.estimatedSales)}</td>
                        <td className="text-right px-4 py-2 text-gray-800">{formatCurrency(job.estimatedCost)}</td>
                        <td className="text-right px-4 py-2 text-gray-800">{formatCurrency(job.totalActualCost)}</td>
                        <td className={`text-right px-4 py-2 font-semibold ${job.costVariance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(job.costVariance)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Modal totals */}
                <tfoot>
                  <tr className="bg-gray-100 border-t-2 border-gray-300">
                    <td className="px-4 py-2.5 font-bold text-gray-800" colSpan={3}>
                      Total ({getSortedModalJobs().length} jobs)
                    </td>
                    <td className="text-right px-4 py-2.5 font-bold text-gray-800">
                      {formatCurrency(modalData.jobs.reduce((s, j) => s + j.estimatedSales, 0))}
                    </td>
                    <td className="text-right px-4 py-2.5 font-bold text-gray-800">
                      {formatCurrency(modalData.jobs.reduce((s, j) => s + j.estimatedCost, 0))}
                    </td>
                    <td className="text-right px-4 py-2.5 font-bold text-gray-800">
                      {formatCurrency(modalData.jobs.reduce((s, j) => s + j.totalActualCost, 0))}
                    </td>
                    <td className={`text-right px-4 py-2.5 font-bold ${
                      modalData.jobs.reduce((s, j) => s + j.costVariance, 0) < 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(modalData.jobs.reduce((s, j) => s + j.costVariance, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
