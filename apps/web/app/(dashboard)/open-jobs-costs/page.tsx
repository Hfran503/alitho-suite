'use client'

import React, { useState, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx'

type ActivityBreakdown = {
  activityCode: string
  description: string
  estimatedCost: number
  actualCost: number
  estimatedHours: number
  actualHours: number
  variance: number
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
  estimatedCost: number
  actualCost: number
  estimatedHours: number
  actualHours: number
  variance: number
  variancePercent: number
  activityCodeCount: number
  activityBreakdown: ActivityBreakdown[]
}

type Summary = {
  totalEstimatedCost: number
  totalActualCost: number
  totalVariance: number
  totalEstimatedHours: number
  totalActualHours: number
}

type DataResponse = {
  items: OpenJobWithCosts[]
  total: number
  totalOpenJobs: number
  summary: Summary
  activityCodesFilter: string[] | null
}

export default function OpenJobsCostsPage() {
  // Activity code input state
  const [activityCodeInput, setActivityCodeInput] = useState('')
  const [selectedActivityCodes, setSelectedActivityCodes] = useState<string[]>([])

  // Data state
  const [data, setData] = useState<DataResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Expanded states for job rows
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())

  // Search/filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<'actualCost' | 'variance' | 'job'>('actualCost')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Add activity code to selection
  const addActivityCode = () => {
    const code = activityCodeInput.trim().toUpperCase()
    if (code && !selectedActivityCodes.includes(code)) {
      setSelectedActivityCodes([...selectedActivityCodes, code])
      setActivityCodeInput('')
    }
  }

  // Remove activity code from selection
  const removeActivityCode = (code: string) => {
    setSelectedActivityCodes(selectedActivityCodes.filter(c => c !== code))
  }

  // Handle Enter key in activity code input
  const handleActivityCodeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addActivityCode()
    }
  }

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()

      // Add activity codes to query (optional filter)
      selectedActivityCodes.forEach(code => {
        params.append('activityCodes', code)
      })

      const url = selectedActivityCodes.length > 0
        ? `/api/pace/jobs/open-with-costs?${params.toString()}`
        : '/api/pace/jobs/open-with-costs'

      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API Error: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        throw new Error('API returned unsuccessful response')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedActivityCodes])

  // Load data on mount
  useEffect(() => {
    fetchData()
  }, [])

  // Format currency
  const formatCurrency = (value: number) => {
    return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Format hours
  const formatHours = (value: number) => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  }

  // Format percentage
  const formatPercent = (value: number) => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
  }

  // Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  // Toggle job expansion
  const toggleJob = (jobId: string) => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(jobId)) {
        newSet.delete(jobId)
      } else {
        newSet.add(jobId)
      }
      return newSet
    })
  }

  // Handle sort
  const handleSort = (field: 'actualCost' | 'variance' | 'job') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Filter and sort jobs
  const filteredJobs = data?.items
    .filter(job => {
      if (!searchTerm) return true
      const term = searchTerm.toLowerCase()
      return (
        job.job.toLowerCase().includes(term) ||
        job.description.toLowerCase().includes(term) ||
        job.customerName.toLowerCase().includes(term) ||
        job.csrName?.toLowerCase().includes(term)
      )
    })
    .sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'actualCost':
          comparison = a.actualCost - b.actualCost
          break
        case 'variance':
          comparison = a.variance - b.variance
          break
        case 'job':
          comparison = a.job.localeCompare(b.job)
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    }) || []

  // Export to Excel
  const handleExportToExcel = () => {
    if (!data) return

    const wb = XLSX.utils.book_new()
    const hasActivityFilter = data.activityCodesFilter && data.activityCodesFilter.length > 0

    // Sheet 1: Summary
    const summaryData: (string | number)[][] = [
      ['Open Jobs with Activity Costs Report'],
      [''],
      ['Generated', new Date().toLocaleString()],
      ['Total Open Jobs', data.totalOpenJobs],
      ['Jobs with Activity Costs', data.total],
    ]

    // Add filter info if active
    if (hasActivityFilter) {
      summaryData.push([''])
      summaryData.push(['ACTIVITY CODE FILTER'])
      summaryData.push(['Filtered Activity Codes', data.activityCodesFilter!.join(', ')])
    }

    summaryData.push([''])
    summaryData.push(['COST SUMMARY'])
    summaryData.push(['Total Estimated Cost', data.summary.totalEstimatedCost])
    summaryData.push(['Total Actual Cost', data.summary.totalActualCost])
    summaryData.push(['Total Variance', data.summary.totalVariance])
    summaryData.push(['Total Estimated Hours', data.summary.totalEstimatedHours])
    summaryData.push(['Total Actual Hours', data.summary.totalActualHours])

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

    // Sheet 2: Jobs Detail - Include activity code details when filter is active
    let jobHeaders: string[]
    let jobData: (string | number)[][]

    if (hasActivityFilter) {
      // When filtering, include activity code columns with names and costs (one row per job)
      jobHeaders = [
        'Job #', 'Description', 'Customer', 'Status', 'CSR', 'Job Type', 'Date Setup',
        'Activity Codes', 'Activity Descriptions',
        'Estimated Cost', 'Actual Cost', 'Variance', 'Variance %'
      ]

      jobData = [jobHeaders]
      data.items.forEach(job => {
        // Combine activity codes and descriptions into single strings
        const activityCodes = job.activityBreakdown.map(ab => ab.activityCode).join(' + ') || '-'
        const activityDescriptions = job.activityBreakdown.map(ab => ab.description).join(' + ') || 'No matching activities'

        jobData.push([
          job.job,
          job.description,
          job.customerName,
          job.adminStatusDescription,
          job.csrName,
          job.jobTypeDescription,
          job.dateSetup,
          activityCodes,
          activityDescriptions,
          job.estimatedCost,
          job.actualCost,
          job.variance,
          job.variancePercent.toFixed(1) + '%',
        ])
      })
    } else {
      // Standard export without activity filter
      jobHeaders = [
        'Job #', 'Description', 'Customer', 'Status', 'CSR', 'Job Type', 'Date Setup',
        'Estimated Cost', 'Actual Cost', 'Variance', 'Variance %',
        'Estimated Hours', 'Actual Hours', 'Activity Codes'
      ]

      jobData = [
        jobHeaders,
        ...data.items.map(job => [
          job.job,
          job.description,
          job.customerName,
          job.adminStatusDescription,
          job.csrName,
          job.jobTypeDescription,
          job.dateSetup,
          job.estimatedCost,
          job.actualCost,
          job.variance,
          job.variancePercent.toFixed(1) + '%',
          job.estimatedHours,
          job.actualHours,
          job.activityCodeCount,
        ])
      ]
    }

    const ws2 = XLSX.utils.aoa_to_sheet(jobData)
    XLSX.utils.book_append_sheet(wb, ws2, 'Jobs')

    // Sheet 3: Activity Breakdown (always included)
    const activityHeaders = [
      'Job #', 'Job Description', 'Customer', 'Activity Code', 'Activity Description',
      'Estimated Cost', 'Actual Cost', 'Variance',
      'Estimated Hours', 'Actual Hours'
    ]

    const activityData: (string | number)[][] = [activityHeaders]
    data.items.forEach(job => {
      job.activityBreakdown.forEach(ab => {
        activityData.push([
          job.job,
          job.description,
          job.customerName,
          ab.activityCode,
          ab.description,
          ab.estimatedCost,
          ab.actualCost,
          ab.variance,
          ab.estimatedHours,
          ab.actualHours,
        ])
      })
    })
    const ws3 = XLSX.utils.aoa_to_sheet(activityData)
    XLSX.utils.book_append_sheet(wb, ws3, 'Activity Breakdown')

    // Generate filename with filter info
    const filterSuffix = hasActivityFilter ? `_${data.activityCodesFilter!.join('-')}` : ''
    const filename = `Open_Jobs_Activity_Costs${filterSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  // Print Report
  const handlePrintReport = () => {
    if (!data) return

    const hasActivityFilter = data.activityCodesFilter && data.activityCodesFilter.length > 0

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Open Jobs - Activity Costs Report</title>
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
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e5e7eb;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 4px;
    }
    .header .subtitle {
      color: #6b7280;
      font-size: 12px;
    }
    .header .filter-info {
      margin-top: 8px;
      padding: 8px 16px;
      background: #eff6ff;
      border-radius: 6px;
      display: inline-block;
      color: #1d4ed8;
      font-weight: 500;
    }
    .positive { color: #059669; }
    .negative { color: #dc2626; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 10px;
    }
    th {
      background: #f3f4f6;
      padding: 8px 6px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #d1d5db;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    th.right { text-align: right; }
    td {
      padding: 8px 6px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }
    td.right { text-align: right; }
    td.mono { font-family: 'SF Mono', Monaco, monospace; font-weight: 600; color: #2563eb; }
    tr:nth-child(even) { background: #fafafa; }
    .activity-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .activity-item {
      background: #f3f4f6;
      padding: 6px 8px;
      margin-bottom: 4px;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .activity-item:last-child { margin-bottom: 0; }
    .activity-code {
      font-family: 'SF Mono', Monaco, monospace;
      font-weight: 600;
      color: #2563eb;
    }
    .activity-desc {
      color: #6b7280;
      flex: 1;
    }
    .activity-costs {
      display: flex;
      gap: 12px;
      font-size: 9px;
    }
    .activity-costs span {
      text-align: right;
    }
    .activity-costs .label {
      color: #9ca3af;
      display: block;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 500;
      background: #dbeafe;
      color: #1d4ed8;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 10px;
    }
    @media print {
      body { padding: 0; }
      .summary-grid { page-break-inside: avoid; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Open Jobs - Activity Costs Report</h1>
    <div class="subtitle">Generated on ${new Date().toLocaleString()} &bull; ${data.total} jobs</div>
    ${hasActivityFilter ? `<div class="filter-info">Filtered by: ${data.activityCodesFilter!.join(', ')}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Job #</th>
        <th>Description</th>
        <th>Customer</th>
        <th>Status</th>
        ${hasActivityFilter ? '<th>Activity Codes</th>' : ''}
        <th class="right">Estimated</th>
        <th class="right">Actual</th>
        <th class="right">Variance</th>
      </tr>
    </thead>
    <tbody>
      ${data.items.map(job => `
        <tr>
          <td class="mono">${job.job}</td>
          <td>${job.description || '-'}</td>
          <td>${job.customerName}</td>
          <td><span class="status-badge">${job.adminStatusDescription}</span></td>
          ${hasActivityFilter ? `
            <td>
              <ul class="activity-list">
                ${job.activityBreakdown.map(ab => `
                  <li class="activity-item">
                    <span class="activity-code">${ab.activityCode}</span>
                    <span class="activity-desc">${ab.description}</span>
                    <div class="activity-costs">
                      <span><span class="label">Est</span>${formatCurrency(ab.estimatedCost)}</span>
                      <span><span class="label">Act</span>${formatCurrency(ab.actualCost)}</span>
                      <span class="${ab.variance >= 0 ? 'positive' : 'negative'}"><span class="label">Var</span>${formatCurrency(ab.variance)}</span>
                    </div>
                  </li>
                `).join('')}
                ${job.activityBreakdown.length === 0 ? '<li class="activity-item" style="color: #9ca3af;">No matching activities</li>' : ''}
              </ul>
            </td>
          ` : ''}
          <td class="right">${formatCurrency(job.estimatedCost)}</td>
          <td class="right">${formatCurrency(job.actualCost)}</td>
          <td class="right ${job.variance >= 0 ? 'positive' : 'negative'}" style="font-weight: 600;">
            ${formatCurrency(job.variance)}<br>
            <span style="font-size: 9px; font-weight: 400;">${formatPercent(job.variancePercent)}</span>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    Open Jobs Activity Costs Report &bull; ${data.total} jobs with activity costs &bull; ${data.totalOpenJobs} total open jobs
  </div>

  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-4 flex-shrink-0">
        <div className="px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Open Jobs - Activity Costs</h1>
              <p className="text-sm text-gray-500 mt-1">
                View all open jobs with estimated and actual activity costs
              </p>
            </div>
            {data && (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-gray-500">Jobs with Costs</div>
                  <div className="text-xl font-bold text-gray-900">{data.total}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Total Open Jobs</div>
                  <div className="text-xl font-bold text-gray-500">{data.totalOpenJobs}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white border-b border-gray-200 py-4 flex-shrink-0">
        <div className="px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Activity Code Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Activity Codes (optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={activityCodeInput}
                  onChange={(e) => setActivityCodeInput(e.target.value)}
                  onKeyDown={handleActivityCodeKeyDown}
                  placeholder="Enter activity code"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={addActivityCode}
                  disabled={!activityCodeInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  Add
                </button>
              </div>
              {selectedActivityCodes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedActivityCodes.map(code => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                    >
                      {code}
                      <button
                        onClick={() => removeActivityCode(code)}
                        className="ml-1 hover:text-blue-600"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Jobs
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by job #, description, customer..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Actions */}
            <div className="flex items-end gap-2">
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex-1 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </>
                )}
              </button>

              {data && (
                <>
                  <button
                    onClick={handleExportToExcel}
                    disabled={loading}
                    className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
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
                    className="px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
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
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-600 font-medium">Loading open jobs...</p>
            <p className="text-gray-400 text-sm mt-1">Fetching activity cost data from PACE</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && data && (
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-1">Total Estimated</div>
              <div className="text-xl font-bold text-gray-900">{formatCurrency(data.summary.totalEstimatedCost)}</div>
              <div className="text-xs text-gray-400 mt-1">{formatHours(data.summary.totalEstimatedHours)} hrs</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-1">Total Actual</div>
              <div className="text-xl font-bold text-gray-900">{formatCurrency(data.summary.totalActualCost)}</div>
              <div className="text-xs text-gray-400 mt-1">{formatHours(data.summary.totalActualHours)} hrs</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-1">Total Variance</div>
              <div className={`text-xl font-bold ${data.summary.totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.summary.totalVariance)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {data.summary.totalEstimatedCost > 0
                  ? formatPercent((data.summary.totalVariance / data.summary.totalEstimatedCost) * 100)
                  : '0%'
                }
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-1">Jobs Over Budget</div>
              <div className="text-xl font-bold text-red-600">
                {data.items.filter(j => j.variance < 0).length}
              </div>
              <div className="text-xs text-gray-400 mt-1">of {data.total} jobs</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-1">Jobs Under Budget</div>
              <div className="text-xl font-bold text-green-600">
                {data.items.filter(j => j.variance >= 0).length}
              </div>
              <div className="text-xs text-gray-400 mt-1">of {data.total} jobs</div>
            </div>
          </div>

          {/* Jobs Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-8"></th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('job')}
                    >
                      <div className="flex items-center gap-1">
                        Job #
                        {sortField === 'job' && (
                          <svg className={`w-4 h-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    {/* Show Activity Codes column when filter is active */}
                    {data.activityCodesFilter && data.activityCodesFilter.length > 0 && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Activity Codes
                      </th>
                    )}
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Estimated</th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('actualCost')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Actual
                        {sortField === 'actualCost' && (
                          <svg className={`w-4 h-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('variance')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Variance
                        {sortField === 'variance' && (
                          <svg className={`w-4 h-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    {/* Only show Activities count when no filter is active */}
                    {(!data.activityCodesFilter || data.activityCodesFilter.length === 0) && (
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Activities</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredJobs.length === 0 ? (
                    <tr>
                      <td colSpan={data.activityCodesFilter && data.activityCodesFilter.length > 0 ? 9 : 9} className="px-4 py-8 text-center text-gray-500">
                        No jobs found with activity costs
                      </td>
                    </tr>
                  ) : (
                    filteredJobs.map((job) => {
                      const isExpanded = expandedJobs.has(job.job)
                      const hasActivityFilter = data.activityCodesFilter && data.activityCodesFilter.length > 0
                      return (
                        <React.Fragment key={job.job}>
                          <tr
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => toggleJob(job.job)}
                          >
                            <td className="px-2 py-3">
                              <svg
                                className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono font-bold text-blue-600">{job.job}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="max-w-xs truncate text-sm text-gray-900" title={job.description}>
                                {job.description || '-'}
                              </div>
                              <div className="text-xs text-gray-400">{formatDate(job.dateSetup)}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{job.customerName}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {job.adminStatusDescription}
                              </span>
                            </td>
                            {/* Show Activity Codes details when filter is active */}
                            {hasActivityFilter && (
                              <td className="px-4 py-3">
                                <div className="space-y-1.5 max-w-md">
                                  {job.activityBreakdown.map((ab) => (
                                    <div key={ab.activityCode} className="flex items-start justify-between gap-4 text-xs bg-gray-50 rounded px-2 py-1.5">
                                      <div className="flex-1 min-w-0">
                                        <span className="font-mono font-bold text-blue-600">{ab.activityCode}</span>
                                        <span className="ml-2 text-gray-600 truncate" title={ab.description}>
                                          {ab.description}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3 flex-shrink-0">
                                        <div className="text-right">
                                          <div className="text-gray-400">Est</div>
                                          <div className="font-medium">{formatCurrency(ab.estimatedCost)}</div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-gray-400">Act</div>
                                          <div className="font-medium">{formatCurrency(ab.actualCost)}</div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-gray-400">Var</div>
                                          <div className={`font-bold ${ab.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(ab.variance)}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  {job.activityBreakdown.length === 0 && (
                                    <span className="text-gray-400 text-xs">No matching activities</span>
                                  )}
                                </div>
                              </td>
                            )}
                            <td className="px-4 py-3 text-right text-sm text-gray-900">
                              {formatCurrency(job.estimatedCost)}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-900">
                              {formatCurrency(job.actualCost)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`text-sm font-medium ${job.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(job.variance)}
                              </span>
                              <div className={`text-xs ${job.variance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {formatPercent(job.variancePercent)}
                              </div>
                            </td>
                            {/* Only show Activities count when no filter is active */}
                            {!hasActivityFilter && (
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                                  {job.activityCodeCount}
                                </span>
                              </td>
                            )}
                          </tr>
                          {/* Expanded Activity Breakdown */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={hasActivityFilter ? 9 : 9} className="bg-gray-50 px-4 py-4">
                                <div className="ml-8">
                                  <h4 className="text-sm font-medium text-gray-700 mb-3">Activity Code Breakdown</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {job.activityBreakdown.map((ab) => (
                                      <div
                                        key={ab.activityCode}
                                        className="bg-white rounded-lg border border-gray-200 p-3"
                                      >
                                        <div className="flex items-start justify-between mb-2">
                                          <div>
                                            <span className="font-mono text-sm font-bold text-blue-600">{ab.activityCode}</span>
                                            <div className="text-xs text-gray-500 truncate max-w-[200px]" title={ab.description}>
                                              {ab.description}
                                            </div>
                                          </div>
                                          <span className={`text-sm font-bold ${ab.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(ab.variance)}
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                          <div>
                                            <span className="text-gray-500">Estimated:</span>
                                            <span className="ml-1 font-medium">{formatCurrency(ab.estimatedCost)}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">Actual:</span>
                                            <span className="ml-1 font-medium">{formatCurrency(ab.actualCost)}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">Est. Hrs:</span>
                                            <span className="ml-1 font-medium">{formatHours(ab.estimatedHours)}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">Act. Hrs:</span>
                                            <span className="ml-1 font-medium">{formatHours(ab.actualHours)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {job.activityBreakdown.length === 0 && (
                                    <p className="text-sm text-gray-500">No activity codes found for this job</p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Results count */}
          {filteredJobs.length !== data.items.length && (
            <p className="text-sm text-gray-500 text-center">
              Showing {filteredJobs.length} of {data.items.length} jobs
            </p>
          )}
        </div>
      )}
    </div>
  )
}
