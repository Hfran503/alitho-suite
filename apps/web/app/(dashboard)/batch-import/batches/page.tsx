'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface BatchImport {
  id: string
  fileName: string
  sheetName: string | null
  status: string
  totalRows: number
  successfulRows: number
  failedRows: number
  voidedRows: number
  createdAt: string
  updatedAt: string
}

interface PaginationData {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function BatchesPage() {
  const router = useRouter()
  const [batches, setBatches] = useState<BatchImport[]>([])
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<'active' | 'voided'>('active')

  useEffect(() => {
    fetchBatches(pagination.page)
  }, [])

  const fetchBatches = async (page: number) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/batch-import/list?page=${page}&limit=${pagination.limit}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch batches')
      }

      setBatches(result.data.batches)
      setPagination(result.data.pagination)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    fetchBatches(newPage)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Filter batches based on active tab
  const filteredBatches = batches.filter((batch) => {
    // A batch is completely voided when:
    // 1. It has voided rows AND
    // 2. There are no successful rows left (all were voided)
    const isCompletelyVoided = batch.voidedRows > 0 && batch.successfulRows === 0
    return activeTab === 'voided' ? isCompletelyVoided : !isCompletelyVoided
  })

  // Clear selection when changing tabs
  useEffect(() => {
    setSelectedBatches(new Set())
  }, [activeTab])

  const toggleBatchSelection = (batchId: string) => {
    setSelectedBatches((prev) => {
      const next = new Set(prev)
      if (next.has(batchId)) {
        next.delete(batchId)
      } else {
        next.add(batchId)
      }
      return next
    })
  }

  const toggleAllBatches = () => {
    const currentPageBatchIds = filteredBatches.map((b) => b.id)
    const allCurrentSelected = currentPageBatchIds.every((id) => selectedBatches.has(id))

    if (allCurrentSelected) {
      // Deselect all on current page
      setSelectedBatches((prev) => {
        const next = new Set(prev)
        currentPageBatchIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      // Select all on current page
      setSelectedBatches((prev) => {
        const next = new Set(prev)
        currentPageBatchIds.forEach((id) => next.add(id))
        return next
      })
    }
  }

  const handleExportSelected = async () => {
    if (selectedBatches.size === 0) {
      alert('Please select at least one batch to export')
      return
    }

    try {
      setIsExporting(true)
      const response = await fetch('/api/batch-import/export-multiple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchIds: Array.from(selectedBatches) }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to export batches')
      }

      // Download the CSV
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `batch-export-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(`Failed to export: ${err.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  if (loading && batches.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Batch Imports</h1>
          <p className="text-gray-600 mt-1">Track and manage all shipment import batches</p>
        </div>
        <div className="flex gap-3">
          {selectedBatches.size > 0 && (
            <button
              onClick={handleExportSelected}
              disabled={isExporting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isExporting ? 'Exporting...' : `Export Selected (${selectedBatches.size})`}
            </button>
          )}
          <button
            onClick={() => router.push('/batch-import')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            New Batch Import
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('active')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'active'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Active Batches
            <span className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
              {batches.filter((b) => !(b.voidedRows > 0 && b.successfulRows === 0)).length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('voided')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'voided'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Voided Batches
            <span className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
              {batches.filter((b) => b.voidedRows > 0 && b.successfulRows === 0).length}
            </span>
          </button>
        </nav>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={filteredBatches.length > 0 && filteredBatches.every((b) => selectedBatches.has(b.id))}
                  onChange={toggleAllBatches}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                File Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Progress
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Results
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredBatches.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  {activeTab === 'voided'
                    ? 'No voided batches found.'
                    : 'No active batches found. Create your first batch import to get started.'}
                </td>
              </tr>
            ) : (
              filteredBatches.map((batch) => {
                const processedRows = batch.successfulRows + batch.failedRows
                const progress = batch.totalRows > 0
                  ? Math.round((processedRows / batch.totalRows) * 100)
                  : 0

                return (
                  <tr key={batch.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedBatches.has(batch.id)}
                        onChange={() => toggleBatchSelection(batch.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900">
                          {batch.fileName}
                        </div>
                        {batch.sheetName && (
                          <div className="text-sm text-gray-500">
                            Sheet: {batch.sheetName}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(batch.status)}`}>
                        {batch.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2" style={{ width: '100px' }}>
                          <div
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex flex-col">
                        <span className="text-green-600">✓ {batch.successfulRows} successful</span>
                        {batch.failedRows > 0 && (
                          <span className="text-red-600">✗ {batch.failedRows} failed</span>
                        )}
                        {batch.voidedRows > 0 && (
                          <span className="text-orange-600">⊗ {batch.voidedRows} voided</span>
                        )}
                        <span className="text-gray-500">/ {batch.totalRows} total</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(batch.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => router.push(`/batch-import/batches/${batch.id}`)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total batches)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
