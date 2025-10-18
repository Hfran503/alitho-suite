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
        setShipments(cached.items)
        setPagination({
          page: cached.page,
          pageSize: cached.pageSize,
          total: cached.total,
          totalPages: cached.totalPages,
          hasMore: cached.hasMore || false,
        })
        return
      }
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      // Note: We fetch ALL pages to enable client-side customer filtering
      params.set('page', '1')
      params.set('pageSize', '5000') // Fetch all results for client-side filtering

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

  const handlePageChange = (newPage: number) => {
    // If customer filter is active and we have data, use client-side pagination
    if (customerFilter && allShipments.length > 0) {
      applyClientSideFilter(customerFilter, newPage)
    } else {
      fetchShipments(newPage)
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

          {/* Quick Search by ID */}
          <div className="flex items-center gap-3">
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

          {/* Action Buttons */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
                setJobFilter('')
                setCustomerFilter('')
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
              <div className="flex-1 overflow-auto px-6 pt-4">
                <table className="w-full border-separate border-spacing-0">
                  <thead className="bg-gray-50 sticky top-0 z-10">
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
                    {shipments.map((shipment, index) => (
                      <tr
                        key={shipment.id || index}
                        onClick={() => shipment.id && router.push(`/shipments/${shipment.id}`)}
                        className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-3 text-sm">
                          <span className="font-mono text-xs text-gray-700">
                            {shipment.id || '-'}
                          </span>
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

              {/* Pagination - Fixed at bottom */}
              {pagination.totalPages > 1 && (
                <div className="px-6 py-3 border-t border-gray-200 bg-white flex-shrink-0">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-sm text-gray-700">
                    Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} results
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={pagination.page === 1 || loading}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
                    >
                      First
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1 || loading}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
                    >
                      Previous
                    </button>

                    {/* Page numbers */}
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        let pageNum: number
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1
                        } else if (pagination.page <= 3) {
                          pageNum = i + 1
                        } else if (pagination.page >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i
                        } else {
                          pageNum = pagination.page - 2 + i
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            disabled={loading}
                            className={`px-3 py-2 border rounded-md text-sm font-medium ${
                              pagination.page === pageNum
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                            } disabled:cursor-not-allowed`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>

                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages || loading}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
                    >
                      Next
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.totalPages)}
                      disabled={pagination.page === pagination.totalPages || loading}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
                    >
                      Last
                    </button>
                  </div>
                </div>
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  )
}
