'use client'

import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'

type JobCostData = {
  job: string
  jobNumber: string
  customer?: string
  customerName?: string
  description?: string
  dateTimeSetup?: string
  totalEstimatedCost: number
  totalEstimatedHours: number
  totalActualCost: number
  totalActualHours: number
  jobCostCount: number
  jobCosts: any[]
}

type SortField = 'jobNumber' | 'customer' | 'totalEstimatedCost' | 'totalEstimatedHours' | 'totalActualCost' | 'totalActualHours'
type SortOrder = 'asc' | 'desc'

type ActivityCode = {
  code: string
  description: string
}

export default function JobCostActivity50502Page() {
  const [jobs, setJobs] = useState<JobCostData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('jobNumber')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [selectedActivityCodes, setSelectedActivityCodes] = useState<string[]>(['50502', '15210', '15209', '15207'])
  const [showActivityCodeFilter, setShowActivityCodeFilter] = useState(false)
  const [availableActivityCodes, setAvailableActivityCodes] = useState<ActivityCode[]>([
    { code: '50502', description: 'Loading...' },
    { code: '15210', description: 'Loading...' },
    { code: '15209', description: 'Loading...' },
    { code: '15207', description: 'Loading...' },
  ])

  // Update current time every minute to refresh "time ago" display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showActivityCodeFilter) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.activity-code-filter')) {
        setShowActivityCodeFilter(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showActivityCodeFilter])

  // Helper to get cache key based on selected activity codes
  const getCacheKey = (activityCodes: string[]) => {
    const codesKey = activityCodes.sort().join(',')
    return `jobcost_cache_${codesKey}`
  }

  // Track if this is the initial mount
  const [isInitialMount, setIsInitialMount] = useState(true)

  // Load cached data from localStorage on mount
  useEffect(() => {
    const cacheKey = getCacheKey(selectedActivityCodes)
    const cachedData = localStorage.getItem(cacheKey)
    const cachedTimestamp = localStorage.getItem(`${cacheKey}_timestamp`)

    if (cachedData && cachedTimestamp) {
      const timestamp = new Date(cachedTimestamp)
      const now = new Date()
      const diffMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60)

      // Use cache if less than 15 minutes old
      if (diffMinutes < 15) {
        try {
          const parsed = JSON.parse(cachedData)
          setJobs(parsed)
          setLastFetchTime(timestamp)

          // Extract activity code descriptions from cached data
          const activityCodeMap = new Map<string, string>()
          parsed.forEach((job: JobCostData) => {
            job.jobCosts.forEach((jc: any) => {
              if (jc.activityCode && jc.activityCodeDescription) {
                activityCodeMap.set(jc.activityCode, jc.activityCodeDescription)
              }
            })
          })

          // Update available activity codes with descriptions
          const updatedActivityCodes = ['50502', '15210', '15209', '15207'].map(code => ({
            code,
            description: activityCodeMap.get(code) || code
          }))
          setAvailableActivityCodes(updatedActivityCodes)

          setIsInitialMount(false)
          return
        } catch (e) {
          console.error('Failed to parse cached data:', e)
        }
      }
    }

    // If no valid cache, fetch fresh data
    fetchJobCosts()
    setIsInitialMount(false)
  }, [])

  const fetchJobCosts = async (activityCodes?: string[]) => {
    setLoading(true)
    setError(null)

    const codesToFetch = activityCodes || selectedActivityCodes
    if (codesToFetch.length === 0) {
      setError('Please select at least one activity code')
      setLoading(false)
      return
    }

    try {
      const queryParams = new URLSearchParams()
      codesToFetch.forEach(code => queryParams.append('activityCodes', code))
      const response = await fetch(`/api/pace/jobcosts/activity-50502?${queryParams.toString()}`)

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch (e) {
          console.error('Failed to parse error response:', e)
        }

        console.error('API Error Response:', errorData)
        console.error('Response status:', response.status, response.statusText)

        throw new Error(errorData.error || errorData.message || `API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('API Response:', data)

      if (data.success) {
        console.log('Fetched JobCost data from API:', data.data.items.length, 'jobs')
        setJobs(data.data.items)

        // Extract unique activity codes and their descriptions from the data
        const activityCodeMap = new Map<string, string>()
        data.data.items.forEach((job: JobCostData) => {
          job.jobCosts.forEach((jc: any) => {
            if (jc.activityCode && jc.activityCodeDescription) {
              activityCodeMap.set(jc.activityCode, jc.activityCodeDescription)
            }
          })
        })

        // Update available activity codes with descriptions
        const updatedActivityCodes = ['50502', '15210', '15209', '15207'].map(code => ({
          code,
          description: activityCodeMap.get(code) || code
        }))
        setAvailableActivityCodes(updatedActivityCodes)

        // Cache the data with timestamp
        const now = new Date()
        setLastFetchTime(now)

        const cacheKey = getCacheKey(codesToFetch)
        // Try to cache data, handle quota exceeded errors
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data.data.items))
          localStorage.setItem(`${cacheKey}_timestamp`, now.toISOString())
        } catch (storageErr) {
          if (storageErr instanceof DOMException && storageErr.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded, clearing old caches...')
            localStorage.removeItem(cacheKey)
            localStorage.removeItem(`${cacheKey}_timestamp`)

            try {
              localStorage.setItem(cacheKey, JSON.stringify(data.data.items))
              localStorage.setItem(`${cacheKey}_timestamp`, now.toISOString())
            } catch (retryErr) {
              console.warn('Still unable to cache data after clearing, skipping cache:', retryErr)
            }
          } else {
            console.warn('Failed to cache data:', storageErr)
          }
        }
      } else {
        console.error('API returned success: false')
        throw new Error('API returned unsuccessful response')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Fetch JobCost error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Helper function to format time ago
  const getTimeAgo = (date: Date | null): string => {
    if (!date) return 'Never'
    const now = currentTime
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes === 1) return '1 minute ago'
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`

    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours === 1) return '1 hour ago'
    if (diffHours < 24) return `${diffHours} hours ago`

    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return '1 day ago'
    return `${diffDays} days ago`
  }

  // Handle column sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Fetch when selected activity codes change (skip initial mount)
  useEffect(() => {
    if (!isInitialMount && selectedActivityCodes.length > 0) {
      fetchJobCosts(selectedActivityCodes)
    }
  }, [selectedActivityCodes, isInitialMount])

  // Handler to toggle activity code selection
  const toggleActivityCode = (code: string) => {
    setSelectedActivityCodes(prev => {
      if (prev.includes(code)) {
        // Don't allow deselecting all codes
        if (prev.length === 1) {
          return prev
        }
        return prev.filter(c => c !== code)
      } else {
        return [...prev, code]
      }
    })
  }

  // Helper function to convert chargeClass to display string
  const getChargeClassLabel = (chargeClass: number | string | undefined): string => {
    if (chargeClass === 1 || chargeClass === '1') return 'Estimate'
    if (chargeClass === 9 || chargeClass === '9') return 'Actual'
    return String(chargeClass || '-')
  }

  // Export to Excel
  const handleExportToExcel = () => {
    // Sheet 1: Job Totals
    const jobTotalsData = filteredAndSortedJobs.map(job => ({
      'Job #': job.jobNumber || '-',
      'Customer': job.customerName || job.customer || '-',
      'Setup Date': job.dateTimeSetup
        ? new Date(job.dateTimeSetup).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
        : '-',
      'Description': job.description || '-',
      '# Records': job.jobCostCount,
      'Estimated Cost': job.totalEstimatedCost,
      'Estimated Hours': job.totalEstimatedHours,
      'Actual Cost': job.totalActualCost,
      'Actual Hours': job.totalActualHours,
    }))

    // Sheet 2: Individual JobCost Records
    const individualRecordsData: any[] = []
    filteredAndSortedJobs.forEach(job => {
      job.jobCosts.forEach(jc => {
        individualRecordsData.push({
          'Job #': job.jobNumber || '-',
          'Customer': job.customerName || job.customer || '-',
          'Setup Date': job.dateTimeSetup
            ? new Date(job.dateTimeSetup).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })
            : '-',
          'JobPart': jc.jobPart || '-',
          'Charge Class': getChargeClassLabel(jc.chargeClass),
          'Activity Code': jc.activityCode || '-',
          'Activity Description': jc.activityCodeDescription || '-',
          'Cost': jc.cost || 0,
          'Hours': jc.hours || 0,
          'Notes': jc.notes || '-',
        })
      })
    })

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Add Job Totals sheet
    const ws1 = XLSX.utils.json_to_sheet(jobTotalsData)
    XLSX.utils.book_append_sheet(wb, ws1, 'Job Totals')

    // Add Individual Records sheet
    const ws2 = XLSX.utils.json_to_sheet(individualRecordsData)
    XLSX.utils.book_append_sheet(wb, ws2, 'Individual JobCost Records')

    // Generate filename with current date
    const today = new Date().toISOString().split('T')[0]
    const filename = `JobCost_ActivityCodes_${selectedActivityCodes.join('-')}_${today}.xlsx`

    // Save file
    XLSX.writeFile(wb, filename)
  }

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // Filter and sort jobs
  const filteredAndSortedJobs = jobs
    .filter(job => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const jobNumber = (job.jobNumber || '').toString().toLowerCase()
        const customerName = (job.customerName || job.customer || '').toString().toLowerCase()
        const description = (job.description || '').toString().toLowerCase()

        const matchesSearch = (
          jobNumber.includes(searchLower) ||
          customerName.includes(searchLower) ||
          description.includes(searchLower)
        )

        if (!matchesSearch) return false
      }

      return true
    })
    .sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'jobNumber':
          aValue = a.jobNumber || ''
          bValue = b.jobNumber || ''
          break
        case 'customer':
          aValue = a.customerName || a.customer || ''
          bValue = b.customerName || b.customer || ''
          break
        case 'totalEstimatedCost':
          aValue = a.totalEstimatedCost || 0
          bValue = b.totalEstimatedCost || 0
          break
        case 'totalEstimatedHours':
          aValue = a.totalEstimatedHours || 0
          bValue = b.totalEstimatedHours || 0
          break
        case 'totalActualCost':
          aValue = a.totalActualCost || 0
          bValue = b.totalActualCost || 0
          break
        case 'totalActualHours':
          aValue = a.totalActualHours || 0
          bValue = b.totalActualHours || 0
          break
        default:
          return 0
      }

      // Numeric or string comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
      } else {
        const comparison = String(aValue).localeCompare(String(bValue))
        return sortOrder === 'asc' ? comparison : -comparison
      }
    })

  // Calculate grand totals
  const grandTotals = {
    totalEstimatedCost: filteredAndSortedJobs.reduce((sum, job) => sum + job.totalEstimatedCost, 0),
    totalEstimatedHours: filteredAndSortedJobs.reduce((sum, job) => sum + job.totalEstimatedHours, 0),
    totalActualCost: filteredAndSortedJobs.reduce((sum, job) => sum + job.totalActualCost, 0),
    totalActualHours: filteredAndSortedJobs.reduce((sum, job) => sum + job.totalActualHours, 0),
  }

  // Calculate pagination
  const totalPages = Math.ceil(filteredAndSortedJobs.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedJobs = filteredAndSortedJobs.slice(startIndex, endIndex)

  // Render sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }

    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 py-4 flex-shrink-0">
        <div className="flex items-center justify-between px-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">JobCost Activity Codes - 2025 Jobs</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-gray-500">
                {loading ? (
                  'Loading jobs...'
                ) : filteredAndSortedJobs.length > 0 ? (
                  <>
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedJobs.length)} of {filteredAndSortedJobs.length} {filteredAndSortedJobs.length === 1 ? 'job' : 'jobs'}
                    {searchTerm && ` (filtered from ${jobs.length} total)`}
                  </>
                ) : (
                  `Jobs from 2025 with selected Activity Codes (${selectedActivityCodes.join(', ')})`
                )}
              </p>
              {lastFetchTime && (
                <span
                  className="text-xs text-gray-500 flex items-center gap-1 px-2 py-1 bg-gray-50 rounded border border-gray-200"
                  title={`Last updated: ${lastFetchTime.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  })}`}
                >
                  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Updated {getTimeAgo(lastFetchTime)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Search Bar and Filters */}
          <div className="flex items-center gap-3">
            {/* Activity Code Filter */}
            <div className="relative activity-code-filter">
              <button
                onClick={() => setShowActivityCodeFilter(!showActivityCodeFilter)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>Activity Codes ({selectedActivityCodes.length})</span>
                <svg className={`w-4 h-4 text-gray-600 transition-transform ${showActivityCodeFilter ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Activity Code Dropdown */}
              {showActivityCodeFilter && (
                <div className="absolute top-full mt-2 right-0 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="p-3 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700">Select Activity Codes</h3>
                    <p className="text-xs text-gray-500 mt-1">At least one must be selected</p>
                  </div>
                  <div className="p-2 max-h-64 overflow-y-auto">
                    {availableActivityCodes.map(({ code, description }) => (
                      <label
                        key={code}
                        className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedActivityCodes.includes(code)}
                          onChange={() => toggleActivityCode(code)}
                          disabled={selectedActivityCodes.length === 1 && selectedActivityCodes.includes(code)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="text-sm text-gray-700 flex-1">
                          <span className="font-mono font-semibold">{code}</span>
                          {description !== 'Loading...' && description !== code && (
                            <span className="text-gray-500 ml-1 text-xs">- {description}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search jobs..."
                className="w-80 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              onClick={handleExportToExcel}
              disabled={loading || filteredAndSortedJobs.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
              title="Export to Excel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
            <button
              onClick={() => fetchJobCosts()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Grand Totals Bar */}
      {!loading && filteredAndSortedJobs.length > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 py-3 flex-shrink-0">
          <div className="px-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Grand Totals ({filteredAndSortedJobs.length} jobs):</h2>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="text-xs text-gray-600 uppercase tracking-wide">Estimated Cost</div>
                  <div className="text-lg font-bold text-blue-700">
                    ${grandTotals.totalEstimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-600 uppercase tracking-wide">Estimated Hours</div>
                  <div className="text-lg font-bold text-blue-700">
                    {grandTotals.totalEstimatedHours.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-600 uppercase tracking-wide">Actual Cost</div>
                  <div className="text-lg font-bold text-green-700">
                    ${grandTotals.totalActualCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-600 uppercase tracking-wide">Actual Hours</div>
                  <div className="text-lg font-bold text-green-700">
                    {grandTotals.totalActualHours.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredAndSortedJobs.length > 0 && (
        <div className="bg-white border-b border-gray-200 py-3 flex-shrink-0">
          <div className="flex items-center justify-end gap-3 px-4">
            {/* Items per page */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>

            {/* Page info */}
            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="First page"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Previous"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Next"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Last page"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Error message */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-600 font-medium">Loading JobCost data...</p>
              <p className="text-gray-400 text-sm mt-1">This may take a moment</p>
            </div>
          </div>
        ) : filteredAndSortedJobs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'No jobs match your search' : 'No jobs found'}
              </h3>
              <p className="text-gray-500">
                {searchTerm
                  ? 'Try adjusting your search criteria'
                  : 'No jobs from 2025 with JobCost Activity Code 50502'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Table Container with Overflow */}
            <div className="flex-1 overflow-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      Expand
                    </th>
                    <th
                      onClick={() => handleSort('jobNumber')}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Job #
                        <SortIcon field="jobNumber" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('customer')}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Customer
                        <SortIcon field="customer" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      Setup Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      # Records
                    </th>
                    <th
                      onClick={() => handleSort('totalEstimatedCost')}
                      className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Est. Cost
                        <SortIcon field="totalEstimatedCost" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('totalEstimatedHours')}
                      className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Est. Hours
                        <SortIcon field="totalEstimatedHours" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('totalActualCost')}
                      className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Actual Cost
                        <SortIcon field="totalActualCost" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('totalActualHours')}
                      className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Actual Hours
                        <SortIcon field="totalActualHours" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedJobs.map((job, index) => (
                    <React.Fragment key={job.job || index}>
                      <tr
                        className="border-b border-gray-100 hover:bg-blue-50 transition-colors group"
                      >
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => setExpandedJobId(expandedJobId === job.job ? null : job.job)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title={expandedJobId === job.job ? 'Collapse' : 'Expand to see individual JobCost records'}
                          >
                            <svg
                              className={`w-4 h-4 text-gray-600 transition-transform ${expandedJobId === job.job ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="font-mono font-semibold text-blue-600 group-hover:text-blue-700">
                            {job.jobNumber || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px]">
                          <div className="truncate">
                            {job.customerName || job.customer || <span className="text-gray-400">-</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {job.dateTimeSetup ? (
                            <span>{new Date(job.dateTimeSetup).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                          <div className="max-h-20 overflow-y-auto whitespace-normal break-words">
                            {job.description || <span className="text-gray-400">-</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {job.jobCostCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 tabular-nums">
                          ${job.totalEstimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 tabular-nums">
                          {job.totalEstimatedHours.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-green-700 tabular-nums">
                          ${job.totalActualCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-green-700 tabular-nums">
                          {job.totalActualHours.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {/* Expanded Row showing individual JobCost records */}
                      {expandedJobId === job.job && (
                        <tr className="bg-gray-50">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="ml-8">
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                                Individual JobCost Records ({job.jobCostCount})
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-xs border border-gray-200">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b">JobPart</th>
                                      <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b">Charge Class</th>
                                      <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b">Activity Code</th>
                                      <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b">Activity Description</th>
                                      <th className="px-2 py-2 text-right font-semibold text-gray-600 border-b">Cost</th>
                                      <th className="px-2 py-2 text-right font-semibold text-gray-600 border-b">Hours</th>
                                      <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b">Notes</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {[...job.jobCosts].sort((a, b) => {
                                      const codeA = a.activityCode || ''
                                      const codeB = b.activityCode || ''
                                      return codeA.localeCompare(codeB)
                                    }).map((jc, idx) => (
                                      <tr key={idx} className={`border-b border-gray-200 hover:bg-white ${jc.chargeClass === 9 || jc.chargeClass === '9' ? 'bg-green-50' : ''}`}>
                                        <td className="px-2 py-2">{jc.jobPart || '-'}</td>
                                        <td className="px-2 py-2">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                            jc.chargeClass === 9 || jc.chargeClass === '9'
                                              ? 'bg-green-100 text-green-800'
                                              : 'bg-blue-100 text-blue-800'
                                          }`}>
                                            {getChargeClassLabel(jc.chargeClass)}
                                          </span>
                                        </td>
                                        <td className="px-2 py-2">{jc.activityCode || '-'}</td>
                                        <td className="px-2 py-2">{jc.activityCodeDescription || '-'}</td>
                                        <td className="px-2 py-2 text-right tabular-nums">
                                          ${(jc.cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-2 py-2 text-right tabular-nums">
                                          {(jc.hours || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-2 py-2 max-w-xs truncate">{jc.notes || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
