'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { JobShipment } from '@repo/types'
import {
  formatDateOnlyPT,
  getTodayRangePT,
  getLastSevenDaysRangePT,
  getThisMonthRangePT,
  dateInputToStartOfDayISO,
  dateInputToEndOfDayISO,
} from '@/lib/dateUtils'
import { getCachedShipments, setCachedShipments } from '@/lib/shipmentsCache'

export default function JobShipmentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [shipments, setShipments] = useState<JobShipment[]>([])
  const [allShipments, setAllShipments] = useState<JobShipment[]>([]) // Store all fetched shipments for client-side filtering
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
    hasMore: false,
  })

  // Filter state - initialize from URL params
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '')
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '')
  const [jobFilter, setJobFilter] = useState(searchParams.get('job') || '')
  const [customerFilter, setCustomerFilter] = useState(searchParams.get('customer') || '')
  const [shipmentIdSearch, setShipmentIdSearch] = useState('')
  const [hideShipped, setHideShipped] = useState(false)

  const fetchShipments = async (page = 1, skipCache = false) => {
    // Validate filters
    if (!startDate || !endDate) {
      if (!jobFilter) {
        setError('Please select a date range or enter a job number')
        return
      }
    }

    // Customer filter requires date range
    if (customerFilter && (!startDate || !endDate)) {
      setError('Customer filter requires a date range. Please select start and end dates.')
      return
    }

    // Check cache first (only if not explicitly skipping cache)
    if (!skipCache) {
      const cached = getCachedShipments({
        startDate,
        endDate,
        job: jobFilter,
        customer: customerFilter,
        page,
      })

      if (cached) {
        // Cache contains all items, so we need to apply client-side pagination
        setAllShipments(cached.items)

        // Apply client-side customer filter if needed
        const filteredItems = customerFilter
          ? cached.items.filter((shipment: JobShipment) => {
              const customerName = (shipment.customerName || shipment.customer || '').toLowerCase()
              return customerName.includes(customerFilter.toLowerCase())
            })
          : cached.items

        // Apply client-side pagination
        const pageSize = 20
        const totalFiltered = filteredItems.length
        const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize))
        const currentPage = Math.min(page, totalPages)
        const startIndex = (currentPage - 1) * pageSize
        const paginatedItems = filteredItems.slice(startIndex, startIndex + pageSize)

        setShipments(paginatedItems)
        setPagination({
          page: currentPage,
          pageSize: pageSize,
          total: totalFiltered,
          totalPages: totalPages,
          hasMore: currentPage < totalPages,
        })
        return
      }
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      // Note: We fetch a larger batch to enable client-side customer filtering
      params.set('page', '1')
      params.set('pageSize', '1000') // Reasonable batch size - API now filters by date at PACE level

      if (startDate && endDate) {
        // Convert to ISO datetime for API (using Pacific Time)
        params.set('startDate', dateInputToStartOfDayISO(startDate))
        params.set('endDate', dateInputToEndOfDayISO(endDate))
      }

      if (jobFilter) {
        params.set('job', jobFilter)
      }

      // Note: Customer filter is applied client-side, not sent to API
      // This allows filtering without re-fetching data

      const response = await fetch(`/api/pace/shipments?${params.toString()}`)

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
        console.log('Fetched shipments from API:', data.data.items.length, 'items')

        // Store all fetched shipments for client-side filtering
        setAllShipments(data.data.items)

        // Apply client-side customer filter if needed
        const filteredItems = customerFilter
          ? data.data.items.filter((shipment: JobShipment) => {
              const customerName = (shipment.customerName || shipment.customer || '').toLowerCase()
              return customerName.includes(customerFilter.toLowerCase())
            })
          : data.data.items

        console.log('After customer filter:', filteredItems.length, 'items')

        // Apply client-side pagination
        const pageSize = 20
        const totalFiltered = filteredItems.length
        const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize))
        const currentPage = Math.min(page, totalPages)
        const startIndex = (currentPage - 1) * pageSize
        const paginatedItems = filteredItems.slice(startIndex, startIndex + pageSize)

        setShipments(paginatedItems)
        setPagination({
          page: currentPage,
          pageSize: pageSize,
          total: totalFiltered,
          totalPages: totalPages,
          hasMore: currentPage < totalPages,
        })

        // Cache the results (without customer filter for reusability)
        setCachedShipments(
          {
            startDate,
            endDate,
            job: jobFilter,
            customer: '', // Don't include customer in cache key
            page: 1,
          },
          { ...data.data, items: data.data.items }
        )
      } else {
        console.error('API returned success: false')
        throw new Error('API returned unsuccessful response')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Fetch shipments error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Apply client-side customer filter to already loaded data
  const applyClientSideFilter = (customerSearch: string, pageNum = 1) => {
    if (allShipments.length === 0) return

    const filteredItems = customerSearch
      ? allShipments.filter((shipment) => {
          const customerName = (shipment.customerName || shipment.customer || '').toLowerCase()
          return customerName.includes(customerSearch.toLowerCase())
        })
      : allShipments

    console.log('Client-side filter:', allShipments.length, '->', filteredItems.length)

    // Apply pagination
    const pageSize = 20
    const totalFiltered = filteredItems.length
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize))
    const currentPage = Math.min(pageNum, totalPages)
    const startIndex = (currentPage - 1) * pageSize
    const paginatedItems = filteredItems.slice(startIndex, startIndex + pageSize)

    setShipments(paginatedItems)
    setPagination({
      page: currentPage,
      pageSize: pageSize,
      total: totalFiltered,
      totalPages: totalPages,
      hasMore: currentPage < totalPages,
    })
  }

  const handleFilter = () => {
    // Validate that customer filter has date range
    if (customerFilter && (!startDate || !endDate)) {
      setError('Customer filter requires a date range. Please select start and end dates.')
      return
    }

    // Check if only customer filter changed (client-side filter)
    const hasDateRange = startDate && endDate
    const onlyCustomerChanged = customerFilter && hasDateRange && allShipments.length > 0 && !jobFilter

    // Update URL params
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (jobFilter) params.set('job', jobFilter)
    if (customerFilter) params.set('customer', customerFilter)

    router.push(`/shipments?${params.toString()}`, { scroll: false })

    if (onlyCustomerChanged) {
      // Just filter client-side, no API call
      console.log('Using client-side customer filter')
      setError(null) // Clear any errors
      applyClientSideFilter(customerFilter, 1)
    } else {
      // Make new API call for date/job filters
      fetchShipments(1, true) // Reset to first page when filtering, skip cache
    }
  }

  // Auto-fetch on mount if URL params exist
  useEffect(() => {
    if (startDate || endDate || jobFilter || customerFilter) {
      fetchShipments(1)
    }
  }, [])

  // Reset to page 1 when hideShipped filter changes
  useEffect(() => {
    if (pagination.page > 1) {
      setPagination(prev => ({ ...prev, page: 1 }))
    }
  }, [hideShipped])

  const handlePageChange = (newPage: number) => {
    // Re-apply client-side pagination with the new page number
    // This works for both customer-filtered and non-filtered data
    if (allShipments.length > 0) {
      applyClientSideFilter(customerFilter, newPage)
    } else {
      // Fallback: just update pagination state
      setPagination(prev => ({ ...prev, page: newPage }))
    }
  }

  const setToday = () => {
    const range = getTodayRangePT()
    setStartDate(range.startDate)
    setEndDate(range.endDate)
  }

  const setThisWeek = () => {
    const range = getLastSevenDaysRangePT()
    setStartDate(range.startDate)
    setEndDate(range.endDate)
  }

  const setThisMonth = () => {
    const range = getThisMonthRangePT()
    setStartDate(range.startDate)
    setEndDate(range.endDate)
  }

  const handleFindShipment = () => {
    if (shipmentIdSearch.trim()) {
      router.push(`/shipments/${shipmentIdSearch.trim()}`)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFindShipment()
    }
  }

  // When hideShipped is active, we need to re-paginate from allShipments
  // Otherwise, use the already-paginated shipments from state
  let paginatedShipments = shipments
  let totalFilteredPages = pagination.totalPages
  let filteredCount = pagination.total
  let startIndex = (pagination.page - 1) * pagination.pageSize
  let endIndex = startIndex + pagination.pageSize

  if (hideShipped && allShipments.length > 0) {
    // Apply customer filter first (if any)
    const customerFiltered = customerFilter
      ? allShipments.filter((shipment: JobShipment) => {
          const customerName = (shipment.customerName || shipment.customer || '').toLowerCase()
          return customerName.includes(customerFilter.toLowerCase())
        })
      : allShipments

    // Apply hideShipped filter
    const filtered = customerFiltered.filter(shipment => {
      // @ts-ignore - shipped property exists at runtime
      return !shipment.shipped
    })

    // Apply pagination to the filtered results
    const pageSize = pagination.pageSize
    filteredCount = filtered.length
    totalFilteredPages = Math.max(1, Math.ceil(filteredCount / pageSize))
    const currentPage = Math.min(pagination.page, totalFilteredPages)
    startIndex = (currentPage - 1) * pageSize
    endIndex = Math.min(startIndex + pageSize, filteredCount)
    paginatedShipments = filtered.slice(startIndex, endIndex)
  } else {
    // Just use the already-paginated data from state
    endIndex = startIndex + shipments.length
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header Bar with Title and Quick Search */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
            <p className="text-sm text-gray-500 mt-1">
              {pagination.total > 0 ? (
                <>
                  {pagination.total} shipments found {startDate && endDate && (
                    <span className="text-gray-400">
                      • {startDate} to {endDate}
                    </span>
                  )}
                </>
              ) : (
                'Search for shipments by date range, job, or customer'
              )}
            </p>
          </div>

          {/* Quick Search by ID and Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/shipments/manual-label')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Manual Label
            </button>
            <div className="relative">
              <input
                type="text"
                value={shipmentIdSearch}
                onChange={(e) => setShipmentIdSearch(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search by CL..."
                className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              onClick={handleFindShipment}
              disabled={!shipmentIdSearch.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Go
            </button>
          </div>
        </div>
      </div>

      {/* Filters Bar - Top */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-end gap-4 flex-wrap">
          {/* Quick Date Buttons */}
          <div className="flex gap-2">
            <button
              onClick={setToday}
              className="px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors font-medium text-gray-700 border border-gray-200"
            >
              Today
            </button>
            <button
              onClick={setThisWeek}
              className="px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors font-medium text-gray-700 border border-gray-200"
            >
              Last 7 Days
            </button>
            <button
              onClick={setThisMonth}
              className="px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors font-medium text-gray-700 border border-gray-200"
            >
              This Month
            </button>
          </div>

          {/* Date Range */}
          <div className="flex gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Job Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Job Number
            </label>
            <input
              type="text"
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              placeholder="e.g., 113003"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm w-40"
            />
          </div>

          {/* Customer Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Customer {!startDate || !endDate ? <span className="text-red-500">*</span> : ''}
            </label>
            <input
              type="text"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              placeholder={!startDate || !endDate ? "Requires date range" : "Customer name"}
              disabled={!startDate || !endDate}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm w-48 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500"
            />
          </div>

          {/* Hide Shipped Filter - Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Hide Shipped</span>
            <button
              onClick={() => setHideShipped(!hideShipped)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                hideShipped ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={hideShipped}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  hideShipped ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
                setJobFilter('')
                setCustomerFilter('')
                setHideShipped(false)
                setShipments([])
                router.push('/shipments', { scroll: false })
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
            >
              Clear
            </button>
            <button
              onClick={handleFilter}
              disabled={
                loading ||
                (!startDate && !endDate && !jobFilter) ||
                !!(customerFilter && (!startDate || !endDate))
              }
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Searching...
                </span>
              ) : (
                'Search'
              )}
            </button>
          </div>
        </div>

        {/* Pagination Controls - Compact */}
        {filteredCount > 0 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-600">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredCount)} of {filteredCount}
                {hideShipped && pagination.total > filteredCount && ` (${pagination.total - filteredCount} hidden)`}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Show</span>
                <select
                  value={pagination.pageSize}
                  onChange={(e) => {
                    setPagination(prev => ({
                      ...prev,
                      pageSize: Number(e.target.value),
                      page: 1
                    }))
                  }}
                  className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            {totalFilteredPages > 1 ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={pagination.page === 1 || loading}
                className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="First page"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1 || loading}
                className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Previous"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <span className="px-3 text-sm text-gray-700">
                Page {Math.min(pagination.page, totalFilteredPages)} of {totalFilteredPages}
              </span>

              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= totalFilteredPages || loading}
                className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Next"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => handlePageChange(totalFilteredPages)}
                disabled={pagination.page >= totalFilteredPages || loading}
                className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Last page"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            ) : <div></div>}
          </div>
        )}
      </div>

      {/* Main Content Area - Full Width */}
      <div className="flex-1 flex flex-col overflow-hidden">
          {/* Error message */}
          {error && (
            <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
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
                <p className="text-gray-600 font-medium">Searching shipments...</p>
                <p className="text-gray-400 text-sm mt-1">This may take a moment</p>
              </div>
            </div>
          ) : shipments.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {startDate || endDate || jobFilter || customerFilter
                    ? 'No shipments found'
                    : 'Ready to search'}
                </h3>
                <p className="text-gray-500">
                  {startDate || endDate || jobFilter || customerFilter
                    ? 'Try adjusting your filters or search criteria'
                    : 'Use the filters above and click "Search" to find shipments'}
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
                        Shipment ID (CL#)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Job #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Ship To
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Ship Via
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 max-w-[120px]">
                        Planned Qty
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Tracking
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {paginatedShipments.map((shipment, index) => (
                      <tr
                        key={shipment.id || index}
                        onClick={() => shipment.id && router.push(`/shipments/${shipment.id}`)}
                        className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-3 text-sm">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-xs text-gray-700">
                              {shipment.id || '-'}
                            </span>
                            {/* @ts-ignore - shipped property exists at runtime */}
                            {shipment.shipped ? (
                              <span className="inline-flex items-center w-fit px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                <svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Shipped
                              </span>
                            ) : (
                              <span className="inline-flex items-center w-fit px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                <svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                Pending
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="font-medium">{formatDateOnlyPT(shipment.dateTime)}</div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-semibold text-blue-600 group-hover:text-blue-700">
                            {shipment.job || '-'}
                          </div>
                          {shipment.jobPart && (
                            <div className="text-xs text-gray-500">
                              Part: {shipment.jobPart}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {shipment.customerName || shipment.customer || <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {shipment.contactFirstName || shipment.contactLastName ? (
                            <div>
                              <div className="font-medium text-gray-900">
                                {[shipment.contactFirstName, shipment.contactLastName]
                                  .filter(Boolean)
                                  .join(' ')}
                              </div>
                              {shipment.city && shipment.state && (
                                <div className="text-xs text-gray-500">
                                  {shipment.city}, {shipment.state}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {shipment.shipViaDescription ? (
                            <div>
                              <div className="font-medium text-gray-900">
                                {shipment.shipViaDescription}
                              </div>
                              {shipment.shipViaProvider && (
                                <div className="text-xs text-gray-500">
                                  {shipment.shipViaProvider}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[120px]">
                          <div className="break-words">
                            {shipment.u_csr_qty || <span className="text-gray-400">-</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {shipment.quantity || <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {shipment.trackingNumber ? (
                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                              {shipment.trackingNumber}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
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
