'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { JobShipment } from '@repo/types'

export default function ShipmentsByDatePage() {
  const router = useRouter()
  const [shipments, setShipments] = useState<JobShipment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
    hasMore: false,
  })

  // Filter state
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchShipments = async (page = 1) => {
    // Require date filters for this page
    if (!startDate || !endDate) {
      setError('Please select both start and end dates')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('pageSize', pagination.pageSize.toString())

      // Convert to ISO datetime for API
      const startDateTime = new Date(startDate + 'T00:00:00')
      params.set('startDate', startDateTime.toISOString())

      const endDateTime = new Date(endDate + 'T23:59:59.999')
      params.set('endDate', endDateTime.toISOString())

      const response = await fetch(`/api/pace/shipments/by-date?${params.toString()}`)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('API Error Response:', errorData)

        // Check for specific PACE errors
        if (errorData.details?.response?.message === 'System License Expired') {
          throw new Error('PACE System License Expired. Please contact your PACE administrator to renew the license.')
        }

        throw new Error(errorData.error || 'Failed to fetch shipments')
      }

      const data = await response.json()

      if (data.success) {
        setShipments(data.data.items)
        setPagination({
          page: data.data.page,
          pageSize: data.data.pageSize,
          total: data.data.total,
          totalPages: data.data.totalPages,
          hasMore: data.data.hasMore || false,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Fetch shipments error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = () => {
    fetchShipments(1) // Reset to first page when filtering
  }

  const handlePageChange = (newPage: number) => {
    fetchShipments(newPage)
  }

  const setToday = () => {
    const today = new Date().toISOString().split('T')[0]
    setStartDate(today)
    setEndDate(today)
  }

  const setThisWeek = () => {
    const today = new Date()
    const weekAgo = new Date(today)
    weekAgo.setDate(today.getDate() - 7)

    setStartDate(weekAgo.toISOString().split('T')[0])
    setEndDate(today.toISOString().split('T')[0])
  }

  const setThisMonth = () => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)

    setStartDate(firstDay.toISOString().split('T')[0])
    setEndDate(today.toISOString().split('T')[0])
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Shipments by Date</h1>
            <p className="text-gray-600">Using optimized workaround for PACE API bug (inverted @date logic)</p>
          </div>
          <Link
            href="/shipments"
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Back to All Shipments
          </Link>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Select Date Range</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={setToday}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Today
          </button>
          <button
            onClick={setThisWeek}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Last 7 Days
          </button>
          <button
            onClick={setThisMonth}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            This Month
          </button>
          <button
            onClick={() => {
              setStartDate('')
              setEndDate('')
              setShipments([])
            }}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Clear
          </button>
        </div>

        <button
          onClick={handleFilter}
          disabled={loading || !startDate || !endDate}
          className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Searching...' : 'Search Shipments'}
        </button>

        {/* Info banner */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="text-sm text-blue-900">
            <p className="mb-3">
              <strong>🐛 PACE API Bug Discovery & Workaround:</strong>
            </p>
            <div className="space-y-2 text-xs">
              <div className="bg-white p-2 rounded border border-blue-200 mb-2">
                <p className="font-semibold mb-1">Critical Bug: Inverted @date Logic</p>
                <div className="grid grid-cols-[20px_1fr] gap-2">
                  <span>❌</span>
                  <span><code className="bg-red-100 px-1 rounded">@date='2025-10-17'</code> → Returns shipments with dateTime=null (planned/unshipped)</span>
                </div>
                <div className="grid grid-cols-[20px_1fr] gap-2">
                  <span>✅</span>
                  <span><code className="bg-green-100 px-1 rounded">@date!='2025-10-17'</code> → Returns shipments with actual dateTime values (shipped)</span>
                </div>
              </div>
              <div className="bg-white p-2 rounded border border-blue-200">
                <p className="font-semibold mb-1">Optimized Solution</p>
                <p>1. Use <code className="bg-green-100 px-1 rounded">@date!=''</code> to fetch only shipped items (~5000 vs ~10000)</p>
                <p>2. Filter by specific dateTime range server-side</p>
                <p>3. Much faster than fetching all records with <code className="bg-amber-100 px-1 rounded">@id&gt;0</code></p>
              </div>
            </div>
            <p className="mt-2 text-xs text-blue-700">
              ℹ️ The @date field exists but has inverted equality logic - using this bug as a feature to optimize queries
            </p>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">
            Shipments{' '}
            {pagination.total > 0 && (
              <span className="text-gray-500 text-base font-normal">
                ({shipments.length} results)
              </span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Searching shipments...</div>
        ) : shipments.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {startDate && endDate
              ? 'No shipments found for the selected date range'
              : 'Select a date range to search for shipments'
            }
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date/Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ship To
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tracking
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shipments.map((shipment, index) => (
                    <tr
                      key={shipment.id || index}
                      onClick={() => shipment.id && router.push(`/shipments/${shipment.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {shipment.id || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {shipment.dateTime
                          ? new Date(shipment.dateTime).toLocaleString()
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {shipment.job || '-'}
                        {shipment.jobPart && (
                          <div className="text-xs text-gray-500">
                            Part: {shipment.jobPart}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {shipment.customer || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {shipment.contactFirstName || shipment.contactLastName ? (
                          <div>
                            <div className="font-medium">
                              {[shipment.contactFirstName, shipment.contactLastName]
                                .filter(Boolean)
                                .join(' ')}
                            </div>
                            {shipment.address1 && (
                              <div className="text-gray-600 text-xs">
                                {shipment.address1}
                              </div>
                            )}
                            {shipment.city && shipment.state && (
                              <div className="text-gray-600 text-xs">
                                {shipment.city}, {shipment.state} {shipment.zip}
                              </div>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {shipment.quantity || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {shipment.trackingNumber || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Page {pagination.page} {pagination.hasMore && `of ${pagination.totalPages}+`}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1 || loading}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasMore || loading}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
