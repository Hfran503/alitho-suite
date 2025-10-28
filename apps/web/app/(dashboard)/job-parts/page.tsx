'use client'

import { useState, useEffect } from 'react'

type JobPartDetail = {
  id?: string
  jobPart?: string
  description?: string // ccpartdesc field
  qtyOrdered?: number
}

type GroupedJob = {
  job?: string
  jobDetails?: {
    job?: string
    customer?: string
    description?: string
    jobType?: number
    adminStatus?: string
    promiseDateTime?: string
  }
  customerName?: string
  jobTypeDescription?: string
  parts: JobPartDetail[]
}

type SortField = 'job' | 'customer' | 'jobType' | 'partCount'
type SortOrder = 'asc' | 'desc'

export default function JobPartsPage() {
  const [groupedJobs, setGroupedJobs] = useState<GroupedJob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('job')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  // Load cached data from localStorage on mount
  useEffect(() => {
    const cachedData = localStorage.getItem('job_parts_cache')
    const cachedTimestamp = localStorage.getItem('job_parts_cache_timestamp')

    if (cachedData && cachedTimestamp) {
      const timestamp = new Date(cachedTimestamp)
      const now = new Date()
      const diffMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60)

      // Use cache if less than 15 minutes old
      if (diffMinutes < 15) {
        try {
          const parsed = JSON.parse(cachedData)
          setGroupedJobs(parsed)
          setLastFetchTime(timestamp)
          return
        } catch (e) {
          console.error('Failed to parse cached data:', e)
        }
      }
    }

    // If no valid cache, fetch data
    fetchJobParts()
  }, [])

  const fetchJobParts = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/pace/jobs/job-parts')

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch job parts')
      }

      const result = await response.json()

      if (result.success && result.data) {
        setGroupedJobs(result.data.items || [])
        setLastFetchTime(new Date())

        // Cache the data
        localStorage.setItem('job_parts_cache', JSON.stringify(result.data.items || []))
        localStorage.setItem('job_parts_cache_timestamp', new Date().toISOString())
      } else {
        throw new Error('Invalid response format')
      }
    } catch (err) {
      console.error('Error fetching job parts:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Format time ago
  const formatTimeAgo = (date: Date) => {
    const diffMinutes = Math.floor((currentTime.getTime() - date.getTime()) / (1000 * 60))

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes} min ago`

    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`

    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  // Filter and sort jobs
  const filteredAndSortedJobs = groupedJobs
    .filter((job) => {
      if (!searchTerm) return true

      const searchLower = searchTerm.toLowerCase()
      return (
        job.job?.toLowerCase().includes(searchLower) ||
        job.customerName?.toLowerCase().includes(searchLower) ||
        job.jobTypeDescription?.toLowerCase().includes(searchLower) ||
        job.jobDetails?.description?.toLowerCase().includes(searchLower) ||
        job.parts.some(part =>
          part.description?.toLowerCase().includes(searchLower)
        )
      )
    })
    .sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'job':
          aValue = a.job || ''
          bValue = b.job || ''
          break
        case 'customer':
          aValue = a.customerName || ''
          bValue = b.customerName || ''
          break
        case 'jobType':
          aValue = a.jobTypeDescription || ''
          bValue = b.jobTypeDescription || ''
          break
        case 'partCount':
          aValue = a.parts.length
          bValue = b.parts.length
          break
        default:
          return 0
      }

      const comparison = typeof aValue === 'number'
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue))

      return sortOrder === 'asc' ? comparison : -comparison
    })

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedJobs.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentJobs = filteredAndSortedJobs.slice(startIndex, endIndex)

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Calculate total parts
  const totalParts = groupedJobs.reduce((sum, job) => sum + job.parts.length, 0)

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Job Parts</h1>
        <p className="text-gray-600">
          Viewing parts for jobs with status type != 5 and job types 5018 or 5021
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[300px]">
          <input
            type="text"
            placeholder="Search by job, customer, part description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={fetchJobParts}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>

        {lastFetchTime && (
          <span className="text-sm text-gray-500">
            Last updated: {formatTimeAgo(lastFetchTime)}
          </span>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 font-semibold">Error:</p>
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm">Total Jobs</p>
          <p className="text-2xl font-bold">{groupedJobs.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm">Total Parts</p>
          <p className="text-2xl font-bold">{totalParts}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm">Filtered Jobs</p>
          <p className="text-2xl font-bold">{filteredAndSortedJobs.length}</p>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="mb-4 flex gap-2 items-center text-sm">
        <span className="text-gray-600">Sort by:</span>
        <button
          onClick={() => handleSort('job')}
          className={`px-3 py-1 rounded ${
            sortField === 'job'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Job {sortField === 'job' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => handleSort('customer')}
          className={`px-3 py-1 rounded ${
            sortField === 'customer'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Customer {sortField === 'customer' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => handleSort('jobType')}
          className={`px-3 py-1 rounded ${
            sortField === 'jobType'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Job Type {sortField === 'jobType' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => handleSort('partCount')}
          className={`px-3 py-1 rounded ${
            sortField === 'partCount'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Part Count {sortField === 'partCount' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {loading && groupedJobs.length === 0 ? (
          <div className="bg-white p-8 rounded-lg border border-gray-200 text-center text-gray-500">
            Loading job parts...
          </div>
        ) : currentJobs.length === 0 ? (
          <div className="bg-white p-8 rounded-lg border border-gray-200 text-center text-gray-500">
            {searchTerm ? 'No jobs match your search.' : 'No jobs found.'}
          </div>
        ) : (
          currentJobs.map((job, index) => (
            <div key={job.job || index} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex">
                {/* Left Side: Job Info (25%) */}
                <div className="w-1/4 bg-gradient-to-br from-blue-50 to-blue-100 p-6 border-r border-gray-200">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Job Number</p>
                      <p className="text-2xl font-bold text-blue-700">{job.job}</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Customer</p>
                      <p className="text-sm font-medium text-gray-900 break-words">
                        {job.customerName || '-'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Job Type</p>
                      <p className="text-sm font-medium text-gray-900 break-words">
                        {job.jobTypeDescription || '-'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Parts Count</p>
                      <p className="text-sm">
                        <span className="inline-block px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-bold">
                          {job.parts.length} {job.parts.length === 1 ? 'Part' : 'Parts'}
                        </span>
                      </p>
                    </div>

                    {job.jobDetails?.description && (
                      <div className="pt-4 border-t border-blue-200">
                        <p className="text-xs text-gray-600 font-semibold uppercase mb-1">Job Description</p>
                        <p className="text-sm text-gray-800 break-words">{job.jobDetails.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: Parts Info (75%) */}
                <div className="w-3/4">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-24">
                            Part #
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider w-32">
                            Qty Ordered
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {job.parts.map((part, partIndex) => (
                          <tr key={part.id || partIndex} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              {part.jobPart || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {part.description || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                              {part.qtyOrdered != null ? part.qtyOrdered : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 bg-white px-6 py-4 rounded-lg border border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Items per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages} ({filteredAndSortedJobs.length} jobs)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
