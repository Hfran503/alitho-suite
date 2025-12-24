'use client'

import React, { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'

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

type YearRange = {
  year: number
  label: string
  startDate: string
  endDate: string
}

type AnalysisData = {
  dateRange: {
    current: { startDate: string; endDate: string }
    years: YearRange[]
  }
  totals: PeriodData[]
  activitySummaries: ActivityCodeSummary[]
  employeeSummaries: EmployeeSummary[]
}

type DatePreset = 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'ytd' | 'custom'

// Helper to get date ranges for presets
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
    default:
      return {
        startDate: new Date(year, month, 1).toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
      }
  }
}

export default function ActivityAnalysisPage() {
  // Activity code input state
  const [activityCodeInput, setActivityCodeInput] = useState('')
  const [selectedActivityCodes, setSelectedActivityCodes] = useState<string[]>([])

  // Date range state
  const [datePreset, setDatePreset] = useState<DatePreset>('custom')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Data state
  const [data, setData] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasRun, setHasRun] = useState(false)

  // Expanded states
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set())
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set())

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

  // Get effective date range
  const getEffectiveDateRange = useCallback(() => {
    if (datePreset === 'custom') {
      return { startDate: customStartDate, endDate: customEndDate }
    }
    return getDatePresetRange(datePreset)
  }, [datePreset, customStartDate, customEndDate])

  // Validate inputs
  const canRunAnalysis = () => {
    const { startDate, endDate } = getEffectiveDateRange()
    return selectedActivityCodes.length > 0 && startDate && endDate
  }

  // Fetch data
  const fetchData = useCallback(async () => {
    const { startDate, endDate } = getEffectiveDateRange()

    if (selectedActivityCodes.length === 0) {
      setError('Please add at least one activity code')
      return
    }

    if (!startDate || !endDate) {
      setError('Please select a valid date range')
      return
    }

    setLoading(true)
    setError(null)
    setHasRun(true)

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      })

      // Add activity codes to query
      selectedActivityCodes.forEach(code => {
        params.append('activityCodes', code)
      })

      const response = await fetch(`/api/pace/activity-analysis?${params.toString()}`)

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
  }, [getEffectiveDateRange, selectedActivityCodes])

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

  // Get year colors
  const getYearColor = (index: number) => {
    const colors = [
      { bg: 'bg-blue-600', text: 'text-white', light: 'bg-blue-50', border: 'border-blue-200' },
      { bg: 'bg-emerald-600', text: 'text-white', light: 'bg-emerald-50', border: 'border-emerald-200' },
      { bg: 'bg-purple-600', text: 'text-white', light: 'bg-purple-50', border: 'border-purple-200' },
      { bg: 'bg-orange-600', text: 'text-white', light: 'bg-orange-50', border: 'border-orange-200' },
      { bg: 'bg-gray-600', text: 'text-white', light: 'bg-gray-50', border: 'border-gray-200' },
    ]
    return colors[index % colors.length]
  }

  // Toggle activity expansion
  const toggleActivity = (activityCode: string) => {
    setExpandedActivities(prev => {
      const newSet = new Set(prev)
      if (newSet.has(activityCode)) {
        newSet.delete(activityCode)
      } else {
        newSet.add(activityCode)
      }
      return newSet
    })
  }

  // Toggle employee expansion
  const toggleEmployee = (employeeId: string) => {
    setExpandedEmployees(prev => {
      const newSet = new Set(prev)
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId)
      } else {
        newSet.add(employeeId)
      }
      return newSet
    })
  }

  // Export to Excel
  const handleExportToExcel = () => {
    if (!data) return

    const wb = XLSX.utils.book_new()
    const { startDate, endDate } = getEffectiveDateRange()

    // Sheet 1: Summary by Year
    const summaryData = [
      ['Activity Code Analysis Report - 5 Year Comparison'],
      [''],
      ['Activity Codes Analyzed', selectedActivityCodes.join(', ')],
      [''],
      ['OVERALL TOTALS BY YEAR'],
      ['Year', 'Period', 'Estimated Cost', 'Actual Cost', 'Variance', 'Est. Hours', 'Actual Hours', 'Jobs'],
      ...data.totals.map(t => [
        t.label,
        `${t.startDate} to ${t.endDate}`,
        t.estimatedCost,
        t.actualCost,
        t.estimatedCost - t.actualCost,
        t.estimatedHours,
        t.actualHours,
        t.jobCount,
      ])
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

    // Sheet 2: Activity Codes by Year
    const yearLabels = data.totals.map(t => t.label)
    const activityHeaders = ['Activity Code', 'Description']
    yearLabels.forEach(label => {
      activityHeaders.push(`${label} Est. Cost`, `${label} Actual Cost`, `${label} Variance`)
    })

    const activityData = [
      activityHeaders,
      ...data.activitySummaries.map(a => {
        const row: (string | number)[] = [a.activityCode, a.description]
        a.years.forEach(y => {
          row.push(y.estimatedCost, y.actualCost, y.estimatedCost - y.actualCost)
        })
        return row
      })
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(activityData)
    XLSX.utils.book_append_sheet(wb, ws2, 'Activity Codes')

    // Sheet 3: Employee Productivity by Year
    const employeeHeaders = ['Employee ID', 'Employee Name']
    yearLabels.forEach(label => {
      employeeHeaders.push(`${label} Hours`, `${label} Est. Hours`, `${label} Efficiency`, `${label} Cost`, `${label} Avg $/Hr`)
    })

    const employeeData = [
      employeeHeaders,
      ...data.employeeSummaries.map(e => {
        const row: (string | number)[] = [e.employeeId, e.employeeName]
        e.years.forEach(y => {
          row.push(y.hoursWorked, y.estimatedHours, y.efficiency.toFixed(1) + '%', y.cost, y.avgCostPerHour.toFixed(2))
        })
        return row
      })
    ]
    const ws3 = XLSX.utils.aoa_to_sheet(employeeData)
    XLSX.utils.book_append_sheet(wb, ws3, 'Employee Productivity')

    const filename = `Activity_Analysis_${selectedActivityCodes.join('-')}_${startDate}_to_${endDate}_5yr.xlsx`
    XLSX.writeFile(wb, filename)
  }

  // Print Report
  const handlePrintReport = () => {
    if (!data) return

    const { startDate, endDate } = getEffectiveDateRange()

    // Helper to check if a year has data
    const hasYearData = (total: PeriodData) => {
      return total.estimatedCost > 0 || total.actualCost > 0 || total.actualHours > 0 || total.jobCount > 0
    }

    // Filter totals to only include years with data
    const totalsWithData = data.totals.filter(hasYearData)

    // Get year colors for print
    const getYearColorPrint = (index: number) => {
      const colors = ['#2563eb', '#059669', '#7c3aed', '#ea580c', '#4b5563']
      const bgColors = ['#eff6ff', '#ecfdf5', '#f5f3ff', '#fff7ed', '#f9fafb']
      return { color: colors[index % colors.length], bg: bgColors[index % bgColors.length] }
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Activity Code Analysis Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 24px;
      color: #1f2937;
      font-size: 11px;
      line-height: 1.4;
      background: #f9fafb;
    }
    .header {
      text-align: center;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }
    .header h1 {
      font-size: 26px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 6px;
    }
    .header .subtitle {
      color: #6b7280;
      font-size: 12px;
    }
    .header .filter-info {
      margin-top: 12px;
      padding: 10px 20px;
      background: #eff6ff;
      border-radius: 8px;
      display: inline-block;
      color: #1d4ed8;
      font-weight: 600;
      font-size: 13px;
    }
    .section {
      margin-bottom: 28px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }
    .cards-grid {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
    }
    .year-card {
      border: 2px solid #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
      flex: 1;
      min-width: 150px;
      max-width: 200px;
      background: white;
    }
    .year-card-header {
      padding: 10px 14px;
      color: white;
      font-weight: 600;
      font-size: 14px;
    }
    .year-card-header .period {
      font-size: 10px;
      font-weight: 400;
      opacity: 0.9;
      margin-top: 2px;
    }
    .year-card-body {
      padding: 14px;
    }
    .year-card-body .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .year-card-body .label {
      color: #6b7280;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 500;
    }
    .year-card-body .value {
      font-weight: 600;
      font-size: 13px;
    }
    .year-card-body .value.large {
      font-size: 15px;
    }
    .year-card-body .divider {
      border-top: 1px solid #e5e7eb;
      padding-top: 8px;
      margin-top: 8px;
    }
    .positive { color: #059669; }
    .negative { color: #dc2626; }
    .orange { color: #ea580c; }

    /* Activity Card Style */
    .activity-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      margin-bottom: 14px;
      overflow: hidden;
    }
    .activity-card-header {
      padding: 12px 16px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .activity-code {
      font-family: 'SF Mono', Monaco, monospace;
      font-weight: 700;
      color: #2563eb;
      font-size: 14px;
    }
    .activity-desc {
      color: #4b5563;
      font-size: 12px;
    }
    .activity-card-body {
      padding: 14px 16px;
    }
    .mini-cards {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .mini-card {
      border-radius: 8px;
      padding: 10px 12px;
      flex: 1;
      min-width: 120px;
    }
    .mini-card-label {
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .mini-card .stat-row {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      margin-bottom: 3px;
    }
    .mini-card .stat-label {
      color: #6b7280;
    }
    .mini-card .stat-value {
      font-weight: 600;
      color: #111827;
    }
    .mini-card .stat-value.var {
      font-weight: 700;
    }

    /* Employee Card Style */
    .employee-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      margin-bottom: 14px;
      overflow: hidden;
    }
    .employee-card-header {
      padding: 12px 16px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }
    .employee-name {
      font-weight: 600;
      color: #111827;
      font-size: 13px;
    }
    .employee-id {
      color: #9ca3af;
      font-size: 10px;
    }
    .employee-card-body {
      padding: 14px 16px;
    }

    .footer {
      margin-top: 28px;
      padding-top: 16px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 11px;
    }
    @media print {
      body { padding: 0; background: white; }
      .section { page-break-inside: avoid; }
      .activity-card { page-break-inside: avoid; }
      .employee-card { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Activity Code Analysis Report</h1>
    <div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
    <div class="filter-info">Activity Codes: ${selectedActivityCodes.join(', ')}</div>
    <div class="subtitle" style="margin-top: 10px;">Period: ${startDate} to ${endDate}</div>
  </div>

  ${totalsWithData.length > 0 ? `
  <div class="section">
    <div class="section-title">Cost Comparison by Year</div>
    <div class="cards-grid">
      ${totalsWithData.map((total) => {
        const colors = getYearColorPrint(data.totals.indexOf(total))
        const variance = total.estimatedCost - total.actualCost
        return `
          <div class="year-card" style="border-color: ${colors.color};">
            <div class="year-card-header" style="background: ${colors.color};">
              ${total.label}
              <div class="period">${total.startDate} to ${total.endDate}</div>
            </div>
            <div class="year-card-body" style="background: ${colors.bg};">
              <div class="row">
                <span class="label">Estimated</span>
                <span class="value large">${formatCurrency(total.estimatedCost)}</span>
              </div>
              <div class="row">
                <span class="label">Actual</span>
                <span class="value large">${formatCurrency(total.actualCost)}</span>
              </div>
              <div class="row divider">
                <span class="label">Variance</span>
                <span class="value large ${variance >= 0 ? 'positive' : 'negative'}">${formatCurrency(variance)}</span>
              </div>
              <div class="row" style="margin-top: 10px;">
                <span class="label">Hours</span>
                <span class="value">${formatHours(total.actualHours)}</span>
              </div>
              <div class="row">
                <span class="label">Jobs</span>
                <span class="value">${total.jobCount}</span>
              </div>
            </div>
          </div>
        `
      }).join('')}
    </div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Activity Code Breakdown</div>
    ${data.activitySummaries.map(activity => {
      const yearsWithData = activity.years.filter(y =>
        totalsWithData.some(t => t.year === y.year)
      )
      return `
        <div class="activity-card">
          <div class="activity-card-header">
            <span class="activity-code">${activity.activityCode}</span>
            <span class="activity-desc">${activity.description}</span>
          </div>
          <div class="activity-card-body">
            <div class="mini-cards">
              ${yearsWithData.map((year) => {
                const colors = getYearColorPrint(data.totals.findIndex(t => t.year === year.year))
                const variance = year.estimatedCost - year.actualCost
                return `
                  <div class="mini-card" style="background: ${colors.bg}; border: 1px solid ${colors.color}40;">
                    <div class="mini-card-label" style="color: ${colors.color};">${year.label}</div>
                    <div class="stat-row">
                      <span class="stat-label">Est:</span>
                      <span class="stat-value">${formatCurrency(year.estimatedCost)}</span>
                    </div>
                    <div class="stat-row">
                      <span class="stat-label">Actual:</span>
                      <span class="stat-value">${formatCurrency(year.actualCost)}</span>
                    </div>
                    <div class="stat-row" style="border-top: 1px solid ${colors.color}30; padding-top: 4px; margin-top: 4px;">
                      <span class="stat-label">Variance:</span>
                      <span class="stat-value var ${variance >= 0 ? 'positive' : 'negative'}">${formatCurrency(variance)}</span>
                    </div>
                    <div class="stat-row" style="margin-top: 6px; font-size: 9px; color: #9ca3af;">
                      <span>Jobs: ${year.jobCount}</span>
                      <span>Hrs: ${formatHours(year.actualHours)}</span>
                    </div>
                  </div>
                `
              }).join('')}
            </div>
          </div>
        </div>
      `
    }).join('')}
  </div>

  <div class="section">
    <div class="section-title">Employee Productivity</div>
    ${data.employeeSummaries.map(employee => {
      const yearsWithData = employee.years.filter(y =>
        totalsWithData.some(t => t.year === y.year)
      )
      return `
        <div class="employee-card">
          <div class="employee-card-header">
            <span class="employee-name">${employee.employeeName}</span>
            <span class="employee-id">(${employee.employeeId})</span>
          </div>
          <div class="employee-card-body">
            <div class="mini-cards">
              ${yearsWithData.map((year) => {
                const colors = getYearColorPrint(data.totals.findIndex(t => t.year === year.year))
                return `
                  <div class="mini-card" style="background: ${colors.bg}; border: 1px solid ${colors.color}40;">
                    <div class="mini-card-label" style="color: ${colors.color};">${year.label}</div>
                    <div class="stat-row">
                      <span class="stat-label">Hours:</span>
                      <span class="stat-value">${formatHours(year.hoursWorked)}</span>
                    </div>
                    <div class="stat-row">
                      <span class="stat-label">Est Hrs:</span>
                      <span class="stat-value">${formatHours(year.estimatedHours)}</span>
                    </div>
                    <div class="stat-row">
                      <span class="stat-label">Efficiency:</span>
                      <span class="stat-value ${year.efficiency >= 100 ? 'positive' : year.efficiency > 0 ? 'orange' : ''}" style="font-weight: 700;">${formatPercent(year.efficiency)}</span>
                    </div>
                    <div class="stat-row" style="border-top: 1px solid ${colors.color}30; padding-top: 4px; margin-top: 4px;">
                      <span class="stat-label">Cost:</span>
                      <span class="stat-value">${formatCurrency(year.cost)}</span>
                    </div>
                    <div class="stat-row">
                      <span class="stat-label">$/Hr:</span>
                      <span class="stat-value">${formatCurrency(year.avgCostPerHour)}</span>
                    </div>
                    <div class="stat-row" style="margin-top: 6px; font-size: 9px; color: #9ca3af;">
                      <span>Jobs: ${year.jobCount}</span>
                    </div>
                  </div>
                `
              }).join('')}
            </div>
          </div>
        </div>
      `
    }).join('')}
  </div>

  <div class="footer">
    Activity Code Analysis Report &bull; ${selectedActivityCodes.length} activity code(s) &bull; ${totalsWithData.length} year(s) with data
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
              <h1 className="text-2xl font-bold text-gray-900">Activity Code Analysis</h1>
              <p className="text-sm text-gray-500 mt-1">
                Compare estimated vs actual costs across 5 years
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Section */}
      <div className="bg-white border-b border-gray-200 py-4 flex-shrink-0">
        <div className="px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Activity Code Input */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Activity Codes <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={activityCodeInput}
                  onChange={(e) => setActivityCodeInput(e.target.value)}
                  onKeyDown={handleActivityCodeKeyDown}
                  placeholder="Enter activity code (e.g., 50502)"
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
              {selectedActivityCodes.length === 0 && (
                <p className="mt-2 text-xs text-gray-500">Add at least one activity code to analyze</p>
              )}
            </div>

            {/* Date Range */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <select
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  <option value="custom">Custom Range</option>
                  <option value="thisMonth">This Month</option>
                  <option value="lastMonth">Last Month</option>
                  <option value="thisQuarter">This Quarter</option>
                  <option value="lastQuarter">Last Quarter</option>
                  <option value="ytd">Year to Date</option>
                </select>

                {datePreset === 'custom' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <span className="text-gray-500 text-sm">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Run Button */}
            <div className="lg:col-span-1 flex items-end gap-2">
              <button
                onClick={fetchData}
                disabled={loading || !canRunAnalysis()}
                className="flex-1 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Run Analysis
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

      {/* Initial State */}
      {!hasRun && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Analyze</h3>
            <p className="text-gray-500 mb-4">
              Enter one or more activity codes and select a date range, then click "Run Analysis" to compare estimated vs actual costs.
            </p>
            <p className="text-sm text-gray-400">
              The analysis will compare the same period across 5 years.
            </p>
          </div>
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
            <p className="text-gray-600 font-medium">Analyzing activity codes...</p>
            <p className="text-gray-400 text-sm mt-1">Fetching 5 years of historical data</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && hasRun && data && (
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* Year Cards - Summary Totals */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">5-Year Cost Comparison</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {data.totals.map((total, index) => {
                const colors = getYearColor(index)
                const variance = total.estimatedCost - total.actualCost
                return (
                  <div key={total.year} className={`rounded-xl border-2 ${colors.border} overflow-hidden`}>
                    {/* Year Header */}
                    <div className={`${colors.bg} ${colors.text} px-4 py-3`}>
                      <div className="text-lg font-bold">{total.label}</div>
                      <div className="text-sm opacity-90">{total.startDate} to {total.endDate}</div>
                    </div>
                    {/* Data */}
                    <div className={`${colors.light} p-4 space-y-3`}>
                      <div>
                        <div className="text-xs text-gray-500 uppercase font-medium">Estimated</div>
                        <div className="text-lg font-bold text-gray-900">{formatCurrency(total.estimatedCost)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase font-medium">Actual</div>
                        <div className="text-lg font-bold text-gray-900">{formatCurrency(total.actualCost)}</div>
                      </div>
                      <div className="border-t pt-3">
                        <div className="text-xs text-gray-500 uppercase font-medium">Variance</div>
                        <div className={`text-lg font-bold ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(variance)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-gray-500">Hours</div>
                          <div className="font-medium">{formatHours(total.actualHours)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Jobs</div>
                          <div className="font-medium">{total.jobCount}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Activity Code Cards */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Code Breakdown</h2>
            <div className="space-y-4">
              {data.activitySummaries.map((activity) => {
                const isExpanded = expandedActivities.has(activity.activityCode)
                const currentYear = activity.years.find(y => y.label === 'Current')

                return (
                  <div key={activity.activityCode} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    {/* Activity Header */}
                    <div
                      className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleActivity(activity.activityCode)}
                    >
                      <div className="flex items-center gap-4">
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <div>
                          <span className="font-mono font-bold text-blue-600">{activity.activityCode}</span>
                          <span className="ml-3 text-gray-600">{activity.description}</span>
                        </div>
                      </div>
                      {currentYear && (
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-right">
                            <div className="text-gray-500">Current Actual</div>
                            <div className="font-bold text-gray-900">{formatCurrency(currentYear.actualCost)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-gray-500">Variance</div>
                            <div className={`font-bold ${currentYear.estimatedCost - currentYear.actualCost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(currentYear.estimatedCost - currentYear.actualCost)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Expanded: Year Cards */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 px-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                          {activity.years.map((year, index) => {
                            const colors = getYearColor(index)
                            const variance = year.estimatedCost - year.actualCost
                            return (
                              <div key={year.year} className={`rounded-lg border ${colors.border} p-3 ${colors.light}`}>
                                <div className={`text-sm font-bold ${index === 0 ? 'text-blue-600' : 'text-gray-700'} mb-2`}>
                                  {year.label}
                                </div>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Est:</span>
                                    <span className="font-medium">{formatCurrency(year.estimatedCost)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Actual:</span>
                                    <span className="font-medium">{formatCurrency(year.actualCost)}</span>
                                  </div>
                                  <div className="flex justify-between pt-1 border-t">
                                    <span className="text-gray-500">Var:</span>
                                    <span className={`font-bold ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatCurrency(variance)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs text-gray-400 pt-1">
                                    <span>Jobs: {year.jobCount}</span>
                                    <span>Hrs: {formatHours(year.actualHours)}</span>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Employee Productivity Cards */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Employee Productivity</h2>
            <div className="space-y-4">
              {data.employeeSummaries.map((employee) => {
                const isExpanded = expandedEmployees.has(employee.employeeId)
                const currentYear = employee.years.find(y => y.label === 'Current')

                return (
                  <div key={employee.employeeId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    {/* Employee Header */}
                    <div
                      className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleEmployee(employee.employeeId)}
                    >
                      <div className="flex items-center gap-4">
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <div>
                          <span className="font-medium text-gray-900">{employee.employeeName}</span>
                          <span className="ml-2 text-sm text-gray-400">({employee.employeeId})</span>
                        </div>
                      </div>
                      {currentYear && (
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-right">
                            <div className="text-gray-500">Current Hours</div>
                            <div className="font-bold text-gray-900">{formatHours(currentYear.hoursWorked)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-gray-500">Efficiency</div>
                            <div className={`font-bold ${currentYear.efficiency >= 100 ? 'text-green-600' : 'text-orange-600'}`}>
                              {formatPercent(currentYear.efficiency)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-gray-500">Avg $/Hr</div>
                            <div className="font-bold text-gray-900">{formatCurrency(currentYear.avgCostPerHour)}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Expanded: Year Cards */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 px-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                          {employee.years.map((year, index) => {
                            const colors = getYearColor(index)
                            return (
                              <div key={year.year} className={`rounded-lg border ${colors.border} p-3 ${colors.light}`}>
                                <div className={`text-sm font-bold ${index === 0 ? 'text-blue-600' : 'text-gray-700'} mb-2`}>
                                  {year.label}
                                </div>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Hours:</span>
                                    <span className="font-medium">{formatHours(year.hoursWorked)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Est Hrs:</span>
                                    <span className="font-medium">{formatHours(year.estimatedHours)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Efficiency:</span>
                                    <span className={`font-bold ${year.efficiency >= 100 ? 'text-green-600' : 'text-orange-600'}`}>
                                      {formatPercent(year.efficiency)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between pt-1 border-t">
                                    <span className="text-gray-500">Cost:</span>
                                    <span className="font-medium">{formatCurrency(year.cost)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">$/Hr:</span>
                                    <span className="font-medium">{formatCurrency(year.avgCostPerHour)}</span>
                                  </div>
                                  <div className="text-xs text-gray-400 pt-1">
                                    Jobs: {year.jobCount}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
