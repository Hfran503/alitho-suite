'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { JobShipment } from '@repo/types'

export default function JobShipmentsPage() {
  const router = useRouter()
  const [shipments, setShipments] = useState<JobShipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })

  // Filter state
  const [filterDate, setFilterDate] = useState('')
  const [jobFilter, setJobFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [shipmentIdSearch, setShipmentIdSearch] = useState('')

  const fetchShipments = async (page = 1) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('pageSize', pagination.pageSize.toString())

      if (filterDate && filterDate.trim()) {
        // Convert to ISO datetime for API (start of day to end of day in LOCAL timezone)
        // This ensures filtering matches the user's local day, not UTC day
        const startDateTime = new Date(filterDate + 'T00:00:00')
        params.set('startDate', startDateTime.toISOString())

        const endDateTime = new Date(filterDate + 'T23:59:59.999')
        params.set('endDate', endDateTime.toISOString())
      }

      if (jobFilter) {
        params.set('job', jobFilter)
      }

      if (customerFilter) {
        params.set('customer', customerFilter)
      }

      const response = await fetch(`/api/pace/shipments?${params.toString()}`)

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
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Fetch shipments error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchShipments(pagination.page)
  }, [])

  const handleFilter = () => {
    fetchShipments(1) // Reset to first page when filtering
  }

  const handlePageChange = (newPage: number) => {
    fetchShipments(newPage)
  }

  const setToday = () => {
    const today = new Date().toISOString().split('T')[0]
    setFilterDate(today)
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
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Job Shipments</h1>
        <p className="text-gray-600">View and filter job shipments from PACE</p>
      </div>

      {/* Find by ID Card */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Find Shipment by ID</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={shipmentIdSearch}
            onChange={(e) => setShipmentIdSearch(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter shipment ID (e.g., 138953)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleFindShipment}
            disabled={!shipmentIdSearch.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Find
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Filter Shipments</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ship Date
            </label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Number
            </label>
            <input
              type="text"
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              placeholder="Enter job number"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer
            </label>
            <input
              type="text"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              placeholder="Enter customer name"
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
            onClick={() => {
              setFilterDate('')
              setJobFilter('')
              setCustomerFilter('')
            }}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Clear Filters
          </button>
        </div>

        <button
          onClick={handleFilter}
          disabled={loading}
          className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Loading...' : 'Apply Filters'}
        </button>
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
                ({pagination.total} total)
              </span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading shipments...</div>
        ) : shipments.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No shipments found for the selected date range
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
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
                  Page {pagination.page} of {pagination.totalPages}
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
                    disabled={pagination.page === pagination.totalPages || loading}
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
