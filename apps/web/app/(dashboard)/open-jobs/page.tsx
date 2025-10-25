'use client'

import { useState, useEffect } from 'react'

type Job = {
  job?: string // The job number/ID
  customer?: string
  customerName?: string
  customerPORequired?: string // Customer's PO requirement setting
  adminStatus?: string // The JobStatus ID
  adminStatusDescription?: string // The JobStatus description
  description?: string
  promiseDateTime?: string // Due date
  u_proposal_number?: string // Proposal number
  jobValue?: number // Job value
  proposalEstimatePrice?: number // Estimate price from proposal
  amountToInvoice?: number // Amount to invoice from job
  proposalTotalSellPrice?: number // Total sell price from proposal
  proposalEstimate?: string // Estimate number from proposal
  proposalPO?: string // PO from proposal
  csr?: string // CSR ID
  csrName?: string // CSR name
  part1Estimate?: string // Estimate number from JobPart Part 1
  jobType?: number // JobType ID
  jobTypeDescription?: string // JobType description
  poNum?: string // PO number from Job
  changeOrdersWithZeroPrice?: number // Count of ChangeOrders (type 5001) with zero/missing totalBillAmt
  // Add any other fields you expect from the Job object
}

type DateFilter = 'all' | 'pastdue' | 'thisweek' | 'thismonth' | 'future'
type SortField = 'job' | 'reference' | 'customer' | 'promiseDateTime' | 'adminStatus'
type SortOrder = 'asc' | 'desc'

export default function OpenJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showIssuesOnly, setShowIssuesOnly] = useState(false)
  const [excludedJobTypes, setExcludedJobTypes] = useState<string[]>([])
  const [sortField, setSortField] = useState<SortField>('job')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null)
  const [showJobTypeDropdown, setShowJobTypeDropdown] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every minute to refresh "time ago" display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Load cached data from localStorage on mount
  useEffect(() => {
    const cachedData = localStorage.getItem('open_jobs_cache')
    const cachedTimestamp = localStorage.getItem('open_jobs_cache_timestamp')

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
          return
        } catch (e) {
          console.error('Failed to parse cached data:', e)
        }
      }
    }

    // If no valid cache, fetch fresh data
    fetchOpenJobs()
  }, [])

  const fetchOpenJobs = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/pace/jobs/open')

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch (e) {
          console.error('Failed to parse error response:', e)
        }

        console.error('API Error Response:', errorData)
        console.error('Response status:', response.status, response.statusText)

        // Check for specific PACE errors
        if (errorData.details?.response?.message === 'System License Expired') {
          throw new Error('PACE System License Expired. Please contact your PACE administrator to renew the license.')
        }

        throw new Error(errorData.error || errorData.message || `API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('API Response:', data)

      if (data.success) {
        console.log('Fetched open jobs from API:', data.data.items.length, 'jobs')
        setJobs(data.data.items)

        // Cache the data with timestamp
        const now = new Date()
        setLastFetchTime(now)

        // Try to cache data, handle quota exceeded errors
        try {
          localStorage.setItem('open_jobs_cache', JSON.stringify(data.data.items))
          localStorage.setItem('open_jobs_cache_timestamp', now.toISOString())
        } catch (storageErr) {
          // If quota exceeded, clear old caches and try again
          if (storageErr instanceof DOMException && storageErr.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded, clearing old caches...')
            // Clear old job caches to make space
            localStorage.removeItem('open_jobs_cache')
            localStorage.removeItem('open_jobs_cache_timestamp')
            localStorage.removeItem('prebilling_jobs_cache')
            localStorage.removeItem('prebilling_jobs_cache_timestamp')

            // Try one more time with cleared cache
            try {
              localStorage.setItem('open_jobs_cache', JSON.stringify(data.data.items))
              localStorage.setItem('open_jobs_cache_timestamp', now.toISOString())
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
      console.error('Fetch open jobs error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Helper function to format time ago
  const getTimeAgo = (date: Date | null): string => {
    if (!date) return 'Never'
    // Use currentTime to ensure display updates every minute
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

  // Helper function to check if a date is in a specific range
  const isDateInRange = (dateStr: string | undefined, filter: DateFilter): boolean => {
    if (!dateStr) return filter === 'all' // Jobs without due date only show in 'all'

    const dueDate = new Date(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const endOfWeek = new Date(today)
    endOfWeek.setDate(endOfWeek.getDate() + (7 - today.getDay()))

    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    switch (filter) {
      case 'all':
        return true
      case 'pastdue':
        return dueDate < today
      case 'thisweek':
        return dueDate >= today && dueDate <= endOfWeek
      case 'thismonth':
        return dueDate >= today && dueDate <= endOfMonth
      case 'future':
        return dueDate > endOfMonth
      default:
        return true
    }
  }

  // Handle column sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle order if clicking the same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new field and default to ascending
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, dateFilter, statusFilter, showIssuesOnly, excludedJobTypes])

  // Helper function to check if a job has any issues
  const jobHasIssues = (job: Job): boolean => {
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

  // Get unique statuses for the filter dropdown
  const uniqueStatuses = Array.from(new Set(jobs.map(j => j.adminStatusDescription || j.adminStatus).filter(Boolean)))
    .sort()

  // Get unique job types for the exclusion filter
  const uniqueJobTypes = Array.from(new Set(jobs.map(j => j.jobTypeDescription).filter(Boolean))) as string[]
  uniqueJobTypes.sort()

  // Filter and sort jobs
  const filteredAndSortedJobs = jobs
    .filter(job => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const jobNumber = (job.job || '').toString().toLowerCase()
        const customerName = (job.customerName || job.customer || '').toString().toLowerCase()
        const description = (job.description || '').toString().toLowerCase()
        const proposalNumber = (job.u_proposal_number || '').toString().toLowerCase()
        const csrName = (job.csrName || job.csr || '').toString().toLowerCase()

        const matchesSearch = (
          jobNumber.includes(searchLower) ||
          customerName.includes(searchLower) ||
          description.includes(searchLower) ||
          proposalNumber.includes(searchLower) ||
          csrName.includes(searchLower)
        )

        if (!matchesSearch) return false
      }

      // Status filter
      if (statusFilter !== 'all') {
        const jobStatus = job.adminStatusDescription || job.adminStatus || ''
        if (jobStatus !== statusFilter) return false
      }

      // Job Type exclusion filter
      if (excludedJobTypes.length > 0) {
        const jobTypeDesc = job.jobTypeDescription || ''
        if (excludedJobTypes.includes(jobTypeDesc)) return false
      }

      // Issues filter
      if (showIssuesOnly && !jobHasIssues(job)) {
        return false
      }

      // Date filter
      return isDateInRange(job.promiseDateTime, dateFilter)
    })
    .sort((a, b) => {
      // Special handling for date sorting
      if (sortField === 'promiseDateTime') {
        const aDate = a.promiseDateTime ? new Date(a.promiseDateTime) : null
        const bDate = b.promiseDateTime ? new Date(b.promiseDateTime) : null

        // Handle null dates - push them to the end regardless of sort order
        if (!aDate && !bDate) return 0
        if (!aDate) return 1 // a goes to end
        if (!bDate) return -1 // b goes to end

        // Compare valid dates
        const comparison = aDate.getTime() - bDate.getTime()
        return sortOrder === 'asc' ? comparison : -comparison
      }

      // Handle all other field types
      let aValue: string
      let bValue: string

      switch (sortField) {
        case 'job':
          aValue = a.job || ''
          bValue = b.job || ''
          break
        case 'reference':
          // Changed to proposal number
          aValue = a.u_proposal_number || ''
          bValue = b.u_proposal_number || ''
          break
        case 'customer':
          aValue = a.customerName || a.customer || ''
          bValue = b.customerName || b.customer || ''
          break
        case 'adminStatus':
          aValue = a.adminStatusDescription || a.adminStatus || ''
          bValue = b.adminStatusDescription || b.adminStatus || ''
          break
        default:
          return 0
      }

      // String comparison
      const comparison = aValue.localeCompare(bValue)
      return sortOrder === 'asc' ? comparison : -comparison
    })

  // Calculate pagination
  const totalPages = Math.ceil(filteredAndSortedJobs.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedJobs = filteredAndSortedJobs.slice(startIndex, endIndex)

  const handleJobClick = (job: Job) => {
    if (job.job) {
      // You can navigate to a job details page if you have one
      // For now, we'll just log it
      console.log('Job clicked:', job.job)
      // router.push(`/jobs/${job.job}`)
    }
  }

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
            <h1 className="text-2xl font-bold text-gray-900">Open Jobs</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-gray-500">
                {loading ? (
                  'Loading jobs...'
                ) : filteredAndSortedJobs.length > 0 ? (
                  <>
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedJobs.length)} of {filteredAndSortedJobs.length} open {filteredAndSortedJobs.length === 1 ? 'job' : 'jobs'}
                    {searchTerm && ` (filtered from ${jobs.length} total)`}
                  </>
                ) : (
                  'All jobs with StatusType != 5'
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
              onClick={fetchOpenJobs}
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

      {/* Filter Bar - Date and Status */}
      <div className="bg-white border-b border-gray-200 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {/* Date Filter - Compact with Icons */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 mr-1">Due Date:</span>
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setDateFilter('all')}
                  className={`px-2.5 py-1.5 text-xs rounded-md transition-all font-medium ${
                    dateFilter === 'all'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="All Jobs"
                >
                  All
                </button>
                <button
                  onClick={() => setDateFilter('pastdue')}
                  className={`px-2.5 py-1.5 text-xs rounded-md transition-all font-medium flex items-center gap-1 ${
                    dateFilter === 'pastdue'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Past Due"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Past Due
                </button>
                <button
                  onClick={() => setDateFilter('thisweek')}
                  className={`px-2.5 py-1.5 text-xs rounded-md transition-all font-medium ${
                    dateFilter === 'thisweek'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="This Week"
                >
                  Week
                </button>
                <button
                  onClick={() => setDateFilter('thismonth')}
                  className={`px-2.5 py-1.5 text-xs rounded-md transition-all font-medium ${
                    dateFilter === 'thismonth'
                      ? 'bg-yellow-500 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="This Month"
                >
                  Month
                </button>
                <button
                  onClick={() => setDateFilter('future')}
                  className={`px-2.5 py-1.5 text-xs rounded-md transition-all font-medium ${
                    dateFilter === 'future'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Future (Beyond This Month)"
                >
                  Future
                </button>
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2 border-l border-gray-300 pl-6">
              <span className="text-sm font-medium text-gray-700 mr-2">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="all">All Statuses</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              {statusFilter !== 'all' && (
                <button
                  onClick={() => setStatusFilter('all')}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                  title="Clear status filter"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Issues Filter */}
            <div className="flex items-center gap-2 border-l border-gray-300 pl-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showIssuesOnly}
                  onChange={(e) => setShowIssuesOnly(e.target.checked)}
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span className="text-sm font-medium text-gray-700">Issues Only</span>
              </label>
            </div>

            {/* Job Type Exclusion Filter - Dropdown */}
            {uniqueJobTypes.length > 0 && (
              <div className="flex items-center gap-2 border-l border-gray-300 pl-6 relative">
                <span className="text-sm font-medium text-gray-700">Exclude Types:</span>
                <div className="relative">
                  <button
                    onClick={() => setShowJobTypeDropdown(!showJobTypeDropdown)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span>
                      {excludedJobTypes.length === 0
                        ? 'None'
                        : `${excludedJobTypes.length} excluded`}
                    </span>
                    <svg className={`w-4 h-4 transition-transform ${showJobTypeDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {showJobTypeDropdown && (
                    <>
                      {/* Backdrop to close dropdown */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowJobTypeDropdown(false)}
                      />

                      <div className="absolute top-full mt-1 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[250px] max-h-[400px] overflow-y-auto">
                        <div className="p-2">
                          <div className="flex items-center justify-between px-2 py-1 mb-1">
                            <span className="text-xs font-medium text-gray-700">Select types to exclude</span>
                            {excludedJobTypes.length > 0 && (
                              <button
                                onClick={() => setExcludedJobTypes([])}
                                className="text-xs text-blue-600 hover:text-blue-800"
                              >
                                Clear all
                              </button>
                            )}
                          </div>
                          {uniqueJobTypes.map(jobType => (
                            <label
                              key={jobType}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={excludedJobTypes.includes(jobType)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setExcludedJobTypes([...excludedJobTypes, jobType])
                                  } else {
                                    setExcludedJobTypes(excludedJobTypes.filter(t => t !== jobType))
                                  }
                                }}
                                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                              />
                              <span className={`text-sm ${excludedJobTypes.includes(jobType) ? 'text-red-700 line-through' : 'text-gray-700'}`}>
                                {jobType}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pagination Controls - Compact version */}
          {filteredAndSortedJobs.length > 0 && (
            <div className="flex items-center gap-3 border-l border-gray-300 pl-6">
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
          )}
        </div>
      </div>

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
              <p className="text-gray-600 font-medium">Loading open jobs...</p>
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
                {searchTerm ? 'No jobs match your search' : 'No open jobs found'}
              </h3>
              <p className="text-gray-500">
                {searchTerm
                  ? 'Try adjusting your search criteria'
                  : 'There are currently no jobs with StatusType = 5'}
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
                    <th
                      onClick={() => handleSort('job')}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Job #
                        <SortIcon field="job" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('reference')}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Proposal #
                        <SortIcon field="reference" />
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
                      CSR
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      Description
                    </th>
                    <th
                      onClick={() => handleSort('promiseDateTime')}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Due Date
                        <SortIcon field="promiseDateTime" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('adminStatus')}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Status
                        <SortIcon field="adminStatus" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      Estimate
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      Estimate Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      Sell Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      Issues
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedJobs.map((job, index) => (
                    <tr
                      key={job.job || index}
                      onClick={() => handleJobClick(job)}
                      className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono font-semibold text-blue-600 group-hover:text-blue-700">
                            {job.job || '-'}
                          </span>
                          {job.jobTypeDescription && (
                            <span className="text-xs text-gray-500">
                              {job.jobTypeDescription}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-medium text-gray-900">
                          {job.u_proposal_number || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px]">
                        <div className="truncate">
                          {job.customerName || job.customer || <span className="text-gray-400">-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {job.csrName || job.csr || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                        <div className="max-h-20 overflow-y-auto whitespace-normal break-words">
                          {job.description || <span className="text-gray-400">-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {job.promiseDateTime ? (
                          <span>{new Date(job.promiseDateTime).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {job.adminStatusDescription || job.adminStatus || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {(() => {
                          // If both values exist and are exactly equal, show single value
                          if (job.proposalEstimate && job.part1Estimate &&
                              job.proposalEstimate === job.part1Estimate) {
                            return (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                {job.part1Estimate}
                              </span>
                            )
                          }
                          // If values differ or one is missing, show both with labels
                          if (job.proposalEstimate || job.part1Estimate) {
                            return (
                              <div className="flex flex-col gap-1">
                                {/* Proposal Estimate - FIRST */}
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-medium text-gray-600">Pro:</span>
                                  {job.proposalEstimate ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                      {job.proposalEstimate}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                </div>

                                {/* Job Part 1 Estimate - SECOND */}
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-medium text-gray-600">Job:</span>
                                  {job.part1Estimate ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                      {job.part1Estimate}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                </div>
                              </div>
                            )
                          }
                          return <span className="text-gray-400">-</span>
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {(() => {
                          // If both values exist and difference is within acceptable range ($100), show only Job value
                          if (job.jobValue && job.proposalEstimatePrice &&
                              Math.abs(job.jobValue - job.proposalEstimatePrice) <= 100) {
                            return (
                              <span className="font-semibold text-sm tabular-nums">
                                ${job.jobValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )
                          }
                          // If values differ by more than $100 or one is missing, show both with labels
                          if (job.jobValue || job.proposalEstimatePrice) {
                            return (
                              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 items-center">
                                {/* Proposal Estimate Price - FIRST */}
                                <span className="text-xs font-medium text-gray-600 w-12">Pro:</span>
                                {job.proposalEstimatePrice ? (
                                  <span className="font-semibold text-sm tabular-nums text-right">
                                    ${job.proposalEstimatePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-right">-</span>
                                )}

                                {/* Job Value - SECOND */}
                                <span className="text-xs font-medium text-gray-600 w-12">Job:</span>
                                {job.jobValue ? (
                                  <span className="font-semibold text-sm tabular-nums text-right">
                                    ${job.jobValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-right">-</span>
                                )}
                              </div>
                            )
                          }
                          return <span className="text-gray-400">-</span>
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {(() => {
                          // If both values exist and are equal, show single value
                          if (job.amountToInvoice && job.proposalTotalSellPrice &&
                              Math.abs(job.amountToInvoice - job.proposalTotalSellPrice) <= 0.01) {
                            return (
                              <span className="font-semibold text-sm tabular-nums">
                                ${job.amountToInvoice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )
                          }
                          // If values differ or one is missing, show both with labels
                          if (job.proposalTotalSellPrice || job.amountToInvoice) {
                            return (
                              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 items-center">
                                {/* Proposal Total Sell Price - FIRST */}
                                <span className="text-xs font-medium text-gray-600 w-12">Pro:</span>
                                {job.proposalTotalSellPrice ? (
                                  <span className="font-semibold text-sm tabular-nums text-right">
                                    ${job.proposalTotalSellPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-right">-</span>
                                )}

                                {/* Amount to Invoice - SECOND */}
                                <span className="text-xs font-medium text-gray-600 w-12">Job:</span>
                                {job.amountToInvoice ? (
                                  <span className="font-semibold text-sm tabular-nums text-right">
                                    ${job.amountToInvoice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-right">-</span>
                                )}
                              </div>
                            )
                          }
                          return <span className="text-gray-400">-</span>
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {/* Issues Column - Display problems */}
                        <div className="flex flex-col gap-1">
                          {/* Estimate Number Mismatch Issue */}
                          {(() => {
                            // Check for missing estimate values
                            if (!job.proposalEstimate && !job.part1Estimate) {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-gray-500">No Estimate # data</span>
                                </div>
                              )
                            }
                            if (!job.proposalEstimate) {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-yellow-700">Missing proposal estimate #</span>
                                </div>
                              )
                            }
                            if (!job.part1Estimate) {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-yellow-700">Missing job estimate #</span>
                                </div>
                              )
                            }
                            // Both values exist, check if they differ (exact match required)
                            if (job.proposalEstimate !== job.part1Estimate) {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-red-700">Estimate # mismatch</span>
                                </div>
                              )
                            }
                            return null
                          })()}

                          {/* Job Value vs Proposal Estimate Price Issue */}
                          {(() => {
                            // Check for missing values
                            if (!job.proposalEstimatePrice && !job.jobValue) {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-gray-500">No Estimate Price data</span>
                                </div>
                              )
                            }
                            if (!job.proposalEstimatePrice) {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-yellow-700">Missing proposal EP</span>
                                </div>
                              )
                            }
                            if (!job.jobValue) {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-yellow-700">Missing job value</span>
                                </div>
                              )
                            }
                            // Both values exist, check difference
                            const diff = Math.abs(job.jobValue - job.proposalEstimatePrice)
                            if (diff > 100) {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-red-700">Value diff: ${diff.toFixed(2)}</span>
                                </div>
                              )
                            }
                            return null
                          })()}

                          {/* Amount to Invoice vs Proposal Total Sell Price Issue */}
                          {(() => {
                            // Check for missing values
                            if (!job.proposalTotalSellPrice && !job.amountToInvoice) {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-gray-500">No Sell Price data</span>
                                </div>
                              )
                            }
                            if (!job.proposalTotalSellPrice) {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-yellow-700">Missing proposal sell price</span>
                                </div>
                              )
                            }
                            if (!job.amountToInvoice) {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-yellow-700">Missing amount to invoice</span>
                                </div>
                              )
                            }
                            // Both values exist, check if different
                            const diff = Math.abs(job.amountToInvoice - job.proposalTotalSellPrice)
                            if (diff > 0.01) { // Allow for tiny floating point differences
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-orange-700">Invoice diff: ${diff.toFixed(2)}</span>
                                </div>
                              )
                            }
                            return null
                          })()}

                          {/* PO Issue - Only check if customer requires PO */}
                          {(() => {
                            // Only validate PO if customer requires it (1 = required)
                            if (job.customerPORequired !== '1') {
                              return null
                            }

                            const jobPO = job.poNum?.trim()
                            const proposalPO = job.proposalPO?.trim()

                            // Both are empty - ISSUE
                            if (!jobPO && !proposalPO) {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-red-700">Missing PO (required)</span>
                                </div>
                              )
                            }

                            // Both have values but don't match - ISSUE
                            if (jobPO && proposalPO && jobPO !== proposalPO) {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-red-700">PO mismatch: Job({jobPO}) ≠ Prop({proposalPO})</span>
                                </div>
                              )
                            }

                            // One has value, other is empty - OK, no issue shown
                            return null
                          })()}

                          {/* Past Due Issue - More than 14 days */}
                          {(() => {
                            if (!job.promiseDateTime) {
                              return null
                            }

                            const dueDate = new Date(job.promiseDateTime)
                            const now = new Date()
                            const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

                            if (daysDiff > 14) {
                              return (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-red-700">Past due {daysDiff} days</span>
                                </div>
                              )
                            }

                            return null
                          })()}

                          {/* ChangeOrder with Zero/Missing Price Issue */}
                          {(() => {
                            if (!job.changeOrdersWithZeroPrice || job.changeOrdersWithZeroPrice === 0) {
                              return null
                            }

                            const count = job.changeOrdersWithZeroPrice
                            const message = count === 1
                              ? '1 Change Order with zero/missing price'
                              : `${count} Change Orders with zero/missing price`

                            return (
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs text-red-700">{message}</span>
                              </div>
                            )
                          })()}
                        </div>
                      </td>
                    </tr>
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
