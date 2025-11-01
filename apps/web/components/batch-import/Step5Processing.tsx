'use client'

import { useState, useEffect } from 'react'

interface Step5ProcessingProps {
  batchId: string
  onReset?: () => void
  originalData?: any[]
  columnMapping?: Record<string, string>
}

interface RowStatus {
  id: string
  rowNumber: number
  jobNumber: string
  shipToName: string
  shipToCompany?: string
  shipToAddress1?: string
  shipToAddress2?: string
  shipToCity: string
  shipToState: string
  shipToZip?: string
  shipToCountry?: string
  shipToPhone?: string
  shipDate?: string
  packageNumber: number
  totalPackages: number
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'
  trackingNumber?: string
  trackingUrl?: string
  labelUrl?: string
  shippingCost?: number
  errorMessage?: string
  notes?: string
  jobShipmentId?: string
  cartonId?: string
  // Retry tracking
  retryCount?: number
  maxRetries?: number
  isTransientError?: boolean
  lastAttemptAt?: string
}

interface BatchStatus {
  id: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  totalRows: number
  successfulRows: number
  failedRows: number
  voidedRows: number
  progress: number
  originalData?: any[]
  columnMapping?: Record<string, string>
  rows: RowStatus[]
}

export function Step5Processing({ batchId, onReset, originalData, columnMapping }: Step5ProcessingProps) {
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryingRows, setRetryingRows] = useState<Set<string>>(new Set())
  const [voidingRows, setVoidingRows] = useState<Set<string>>(new Set())
  const [voidingAll, setVoidingAll] = useState(false)
  const [changingServiceRow, setChangingServiceRow] = useState<string | null>(null)
  const [carriers, setCarriers] = useState<any[]>([])
  const [selectedCarrier, setSelectedCarrier] = useState('')
  const [selectedService, setSelectedService] = useState('')
  const [activeTab, setActiveTab] = useState<'results' | 'original'>('results')
  const [isDownloadingLabels, setIsDownloadingLabels] = useState(false)

  // Poll for status updates
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/batch-import/${batchId}/status`)
        if (!response.ok) {
          throw new Error('Failed to fetch batch status')
        }

        const data = await response.json()

        setBatchStatus(data.data)
        setIsLoading(false)

        // Stop polling if batch is complete or failed
        if (data.data.status === 'COMPLETED' || data.data.status === 'FAILED') {
          console.log(`[Batch Import] 🏁 Batch completed with status: ${data.data.status}`)
          return true // Stop polling
        }
        return false
      } catch (err: any) {
        console.error(`[Batch Import] ❌ Error fetching status:`, err)
        setError(err.message)
        setIsLoading(false)
        return true // Stop polling on error
      }
    }

    // Initial fetch
    fetchStatus()

    // Poll every 2 seconds
    const interval = setInterval(async () => {
      const shouldStop = await fetchStatus()
      if (shouldStop) {
        clearInterval(interval)
      }
    }, 2000)

    return () => {
      // Stopped monitoring
      clearInterval(interval)
    }
  }, [batchId])

  // Fetch carriers when opening service selector
  const handleOpenServiceSelector = async (rowId: string) => {
    setChangingServiceRow(rowId)

    try {
      const response = await fetch('/api/integrations/shipstation/carriers')
      if (response.ok) {
        const data = await response.json()
        setCarriers(data.carriers || [])
      }
    } catch (err) {
      console.error('Failed to fetch carriers:', err)
    }
  }

  const handleChangeService = async () => {
    if (!changingServiceRow || !selectedCarrier || !selectedService) {
      alert('Please select both carrier and service')
      return
    }

    try {
      const response = await fetch(`/api/batch-import/${batchId}/change-service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowId: changingServiceRow,
          carrierId: selectedCarrier,
          serviceCode: selectedService,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to change service')
      }

      // Refresh status
      const statusResponse = await fetch(`/api/batch-import/${batchId}/status`)
      const statusData = await statusResponse.json()
      setBatchStatus(statusData.data)

      // Reset state
      setChangingServiceRow(null)
      setSelectedCarrier('')
      setSelectedService('')

      alert('Service changed successfully!')
    } catch (err: any) {
      alert(`Failed to change service: ${err.message}`)
    }
  }

  const handleRetryRow = async (rowId: string) => {
    setRetryingRows((prev) => new Set(prev).add(rowId))

    try {
      const response = await fetch(`/api/batch-import/${batchId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowId }),
      })

      if (!response.ok) {
        throw new Error('Failed to retry row')
      }

      // Refresh status
      const statusResponse = await fetch(`/api/batch-import/${batchId}/status`)
      const statusData = await statusResponse.json()
      setBatchStatus(statusData.data)
    } catch (err: any) {
      alert(`Failed to retry: ${err.message}`)
    } finally {
      setRetryingRows((prev) => {
        const next = new Set(prev)
        next.delete(rowId)
        return next
      })
    }
  }

  const handleVoidLabel = async (rowId: string, trackingNumber: string) => {
    if (!confirm(`Are you sure you want to void label ${trackingNumber}? This cannot be undone.`)) {
      return
    }

    setVoidingRows((prev) => new Set(prev).add(rowId))

    try {
      const response = await fetch(`/api/batch-import/${batchId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowId, trackingNumber }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to void label')
      }

      const result = await response.json()

      // Clear shipments cache if needed
      if (result.clearCache) {
        try {
          const { clearShipmentsCache } = await import('@/lib/shipmentsCache')
          clearShipmentsCache()
          console.log('✅ Cleared shipments cache after voiding label')
        } catch (cacheError) {
          console.warn('Failed to clear shipments cache:', cacheError)
        }
      }

      // Refresh status
      const statusResponse = await fetch(`/api/batch-import/${batchId}/status`)
      const statusData = await statusResponse.json()
      setBatchStatus(statusData.data)

      alert('Label voided successfully')
    } catch (err: any) {
      alert(`Failed to void label: ${err.message}`)
    } finally {
      setVoidingRows((prev) => {
        const next = new Set(prev)
        next.delete(rowId)
        return next
      })
    }
  }

  const handleRetryAllFailed = async () => {
    if (!batchStatus) return

    const failedRows = batchStatus.rows.filter((r) => r.status === 'FAILED')
    if (failedRows.length === 0) {
      alert('No failed rows to retry')
      return
    }

    const transientCount = failedRows.filter(r => r.isTransientError).length
    const permanentCount = failedRows.length - transientCount

    let message = `Retry ${failedRows.length} failed rows?\n\n`
    if (transientCount > 0) {
      message += `${transientCount} transient errors (will be retried)\n`
    }
    if (permanentCount > 0) {
      message += `${permanentCount} permanent errors (unlikely to succeed)\n`
    }

    if (!confirm(message)) {
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch(`/api/batch-import/${batchId}/retry-failed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onlyTransient: false }), // Retry all failed rows
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to retry batch')
      }

      alert(`Successfully queued ${result.retriedRows} rows for retry`)

      // Refresh status
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVoidAllLabels = async () => {
    if (!batchStatus) return

    const successRows = batchStatus.rows.filter((r) => r.status === 'SUCCESS')
    if (successRows.length === 0) {
      alert('No successful labels to void')
      return
    }

    const confirmMessage = `⚠️ WARNING: This will void ALL ${successRows.length} successful label(s) and delete their PACE records.\n\nThis action cannot be undone!\n\nAre you sure you want to continue?`

    if (!confirm(confirmMessage)) {
      return
    }

    try {
      setVoidingAll(true)
      const response = await fetch(`/api/batch-import/${batchId}/void-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to void labels')
      }

      // Clear shipments cache if needed
      if (result.clearCache) {
        try {
          const { clearShipmentsCache } = await import('@/lib/shipmentsCache')
          clearShipmentsCache()
          console.log('✅ Cleared shipments cache after voiding all labels')
        } catch (cacheError) {
          console.warn('Failed to clear shipments cache:', cacheError)
        }
      }

      alert(result.message || `Successfully voided ${result.voidedCount} label(s)`)

      // Refresh status
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (err: any) {
      alert(`Error voiding labels: ${err.message}`)
    } finally {
      setVoidingAll(false)
    }
  }

  const handleDownloadAllLabels = async (firstPageOnly: boolean = false) => {
    if (!batchStatus) return

    const successRows = batchStatus.rows.filter((r) => r.status === 'SUCCESS' && r.labelUrl)
    if (successRows.length === 0) {
      alert('No labels available to download')
      return
    }

    try {
      setIsDownloadingLabels(true)
      // Download merged PDF from API
      const url = `/api/batch-import/${batchId}/download-labels${firstPageOnly ? '?firstPageOnly=true' : ''}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to download labels')
      }

      // Create a blob from the response and download it
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `batch-${batchId}-labels${firstPageOnly ? '-labels-only' : ''}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err: any) {
      alert(`Failed to download labels: ${err.message}`)
    } finally {
      setIsDownloadingLabels(false)
    }
  }

  const handleExportResults = () => {
    if (!batchStatus) return

    // Create CSV with results
    const headers = [
      'Row',
      'Job#',
      'Ship To Name',
      'Company',
      'Address 1',
      'Address 2',
      'City',
      'State',
      'Zip',
      'Phone',
      'Pkg',
      'Status',
      'Tracking',
      'Tracking URL',
      'Cost',
      'PACE Shipment ID',
      'PACE Carton ID',
      'Notes',
      'Error',
    ]
    const rows = batchStatus.rows.map((row) => [
      row.rowNumber,
      row.jobNumber,
      row.shipToName || '',
      row.shipToCompany || '',
      row.shipToAddress1 || '',
      row.shipToAddress2 || '',
      row.shipToCity || '',
      row.shipToState || '',
      row.shipToZip || '',
      row.shipToPhone || '',
      `${row.packageNumber}/${row.totalPackages}`,
      row.status,
      row.trackingNumber || '',
      row.trackingUrl || '',
      row.shippingCost ? `$${row.shippingCost.toFixed(2)}` : '',
      row.jobShipmentId || '',
      row.cartonId || '',
      row.notes || '',
      row.errorMessage || '',
    ])

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch-import-${batchId}-results.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportFailedRows = () => {
    if (!batchStatus) {
      alert('Batch status not available')
      return
    }

    // Use originalData and columnMapping from batch status (stored in DB) or from props (during import flow)
    const originalDataFromBatch = batchStatus.originalData || originalData
    const columnMappingFromBatch = batchStatus.columnMapping || columnMapping

    if (!originalDataFromBatch || !columnMappingFromBatch) {
      alert('Original data not available for export. This batch may have been created before this feature was added.')
      return
    }

    // Filter only failed rows
    const failedRows = batchStatus.rows.filter((row) => row.status === 'FAILED')

    if (failedRows.length === 0) {
      alert('No failed rows to export')
      return
    }

    // Get original column headers from the first row of original data
    const originalHeaders = originalDataFromBatch.length > 0 ? Object.keys(originalDataFromBatch[0]) : []

    if (originalHeaders.length === 0) {
      alert('Unable to determine original column headers')
      return
    }

    // Add error message column at the end
    const headers = [...originalHeaders, 'Error Message']

    // Map failed rows back to original format
    const rows = failedRows.map((failedRow) => {
      // Find the corresponding original row (row numbers are 1-based, array is 0-based)
      const originalRowIndex = failedRow.rowNumber - 2 // -2 because row 1 is header, row 2 is index 0
      const originalRow = originalDataFromBatch[originalRowIndex] || {}

      // Create array with original column values
      const rowData = originalHeaders.map((header) => {
        const value = originalRow[header]
        // Escape CSV values that contain commas, quotes, or newlines
        if (value == null) return ''
        const stringValue = String(value)
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      })

      // Add error message at the end
      const errorMessage = failedRow.errorMessage || ''
      const escapedError = errorMessage.includes(',') || errorMessage.includes('"') || errorMessage.includes('\n')
        ? `"${errorMessage.replace(/"/g, '""')}"`
        : errorMessage
      rowData.push(escapedError)

      return rowData
    })

    // Create CSV
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => {
        // Only escape cells that haven't been escaped yet
        const stringCell = String(cell)
        if (stringCell.startsWith('"') && stringCell.endsWith('"')) {
          return stringCell // Already escaped
        }
        if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
          return `"${stringCell.replace(/"/g, '""')}"`
        }
        return stringCell
      }).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch-import-${batchId}-failed-rows.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading batch status...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="text-sm text-red-800">{error}</p>
            {onReset && (
              <button
                onClick={onReset}
                className="mt-3 text-sm text-red-600 underline hover:no-underline"
              >
                Go back to start
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!batchStatus) {
    return null
  }

  const isProcessing = batchStatus.status === 'PROCESSING' || batchStatus.status === 'PENDING'
  const isComplete = batchStatus.status === 'COMPLETED'
  const hasFailed = batchStatus.failedRows > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {isProcessing ? 'Processing Batch...' : isComplete ? 'Batch Complete' : 'Batch Failed'}
        </h2>
        <p className="text-gray-600">
          {isProcessing
            ? 'Creating labels and shipments in PACE. This may take several minutes.'
            : 'Review the results below and download labels or retry failed shipments.'}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('results')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'results'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Results
          </button>
          <button
            onClick={() => setActiveTab('original')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'original'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Original Data
          </button>
        </nav>
      </div>

      {/* Results Tab */}
      {activeTab === 'results' && (
        <>
          {/* Progress Bar */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">
            Progress: {batchStatus.successfulRows + batchStatus.failedRows} / {batchStatus.totalRows}
          </span>
          <span className="text-sm font-medium text-gray-700">{batchStatus.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              isComplete
                ? hasFailed
                  ? 'bg-amber-500'
                  : 'bg-green-500'
                : 'bg-blue-600'
            }`}
            style={{ width: `${batchStatus.progress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-green-600">{batchStatus.successfulRows}</div>
          <div className="text-sm text-green-900 font-medium mt-1">Successful</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-red-600">{batchStatus.failedRows}</div>
          <div className="text-sm text-red-900 font-medium mt-1">Failed</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-orange-600">{batchStatus.voidedRows || 0}</div>
          <div className="text-sm text-orange-900 font-medium mt-1">Voided</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-gray-600">
            {batchStatus.totalRows - batchStatus.successfulRows - batchStatus.failedRows - (batchStatus.voidedRows || 0)}
          </div>
          <div className="text-sm text-gray-900 font-medium mt-1">Pending</div>
        </div>
      </div>

      {/* Bulk Actions */}
      {!isProcessing && (
        <div className="flex items-center gap-3 pt-2 flex-wrap">
          <button
            onClick={handleRetryAllFailed}
            disabled={batchStatus.failedRows === 0}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors text-sm"
          >
            Retry All Failed ({batchStatus.failedRows})
          </button>
          <button
            onClick={() => handleDownloadAllLabels(false)}
            disabled={batchStatus.successfulRows === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors text-sm"
          >
            Download All Labels
          </button>
          <button
            onClick={handleVoidAllLabels}
            disabled={batchStatus.successfulRows === 0 || voidingAll}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors text-sm"
            title="Void all successful labels and delete PACE records"
          >
            {voidingAll ? 'Voiding All...' : `Void All Labels (${batchStatus.successfulRows})`}
          </button>
          <button
            onClick={handleExportResults}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors text-sm"
          >
            Export Results CSV
          </button>
          <button
            onClick={handleExportFailedRows}
            disabled={batchStatus.failedRows === 0}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors text-sm"
            title="Export only failed rows for troubleshooting"
          >
            Export Failed Rows ({batchStatus.failedRows})
          </button>
        </div>
      )}

      {/* Row Details Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Row
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Job#
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Ship To Address
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Pkg
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Tracking / Cost
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  PACE IDs
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {batchStatus.rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                    {row.rowNumber}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {row.jobNumber}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600">
                    <div className="max-w-xs">
                      <div className="font-medium text-gray-900">{row.shipToName}</div>
                      {row.shipToCompany && row.shipToCompany !== row.shipToName && (
                        <div className="text-xs text-gray-600">{row.shipToCompany}</div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {row.shipToAddress1}
                        {row.shipToAddress2 && <>, {row.shipToAddress2}</>}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.shipToCity}, {row.shipToState} {row.shipToZip}
                      </div>
                      {row.shipToPhone && (
                        <div className="text-xs text-gray-500">📞 {row.shipToPhone}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                    {row.packageNumber}/{row.totalPackages}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {row.status === 'SUCCESS' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Success
                      </span>
                    )}
                    {row.status === 'FAILED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Failed
                      </span>
                    )}
                    {row.status === 'PROCESSING' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                        <svg
                          className="w-3 h-3 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Processing
                      </span>
                    )}
                    {row.status === 'PENDING' && (
                      <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">
                        Pending
                      </span>
                    )}
                    {row.status === 'CANCELLED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Voided
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {row.status === 'SUCCESS' && row.trackingNumber && (
                      <div className="space-y-1">
                        {row.trackingUrl ? (
                          <a
                            href={row.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-blue-600 hover:text-blue-700 hover:underline text-xs"
                          >
                            {row.trackingNumber}
                          </a>
                        ) : (
                          <div className="font-mono text-gray-900 text-xs">{row.trackingNumber}</div>
                        )}
                        {row.shippingCost != null && row.shippingCost > 0 && (
                          <div className="text-xs text-green-700 font-semibold">
                            ${row.shippingCost.toFixed(2)}
                          </div>
                        )}
                        {row.notes && (
                          <div className={`text-xs p-1 rounded border ${
                            row.notes.includes('⚠️')
                              ? 'text-orange-700 bg-orange-50 border-orange-200'
                              : 'text-green-700 bg-green-50 border-green-200'
                          }`}>
                            {row.notes}
                          </div>
                        )}
                      </div>
                    )}
                    {row.status === 'FAILED' && (
                      <div className="space-y-1">
                        {row.errorMessage && (
                          <span className="text-red-600 text-xs block">{row.errorMessage}</span>
                        )}
                        {row.retryCount != null && row.retryCount > 0 && (
                          <span className="text-amber-600 text-xs block">
                            Retry {row.retryCount}/{row.maxRetries || 3} {row.isTransientError ? '(Transient)' : '(Permanent)'}
                          </span>
                        )}
                        {row.retryCount != null && row.retryCount >= (row.maxRetries || 3) && (
                          <span className="text-red-700 text-xs block font-semibold">
                            ⚠ Max retries exceeded
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {row.status === 'SUCCESS' && (
                      <div className="space-y-1 text-xs">
                        {row.jobShipmentId && (
                          <div className="text-gray-600">
                            <span className="font-medium">Ship:</span> {row.jobShipmentId}
                          </div>
                        )}
                        {row.cartonId && (
                          <div className="text-gray-600">
                            <span className="font-medium">Carton:</span> {row.cartonId}
                          </div>
                        )}
                        {!row.jobShipmentId && !row.cartonId && (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      {row.status === 'SUCCESS' && row.labelUrl && (
                        <>
                          <a
                            href={row.labelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Label
                          </a>
                          <button
                            onClick={() => handleVoidLabel(row.id, row.trackingNumber!)}
                            disabled={voidingRows.has(row.id)}
                            className="text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                          >
                            {voidingRows.has(row.id) ? 'Voiding...' : 'Void'}
                          </button>
                        </>
                      )}
                      {row.status === 'FAILED' && (
                        <div className="flex gap-2">
                          {row.errorMessage?.includes('Change service') ? (
                            <button
                              onClick={() => handleOpenServiceSelector(row.id)}
                              className="text-blue-600 hover:text-blue-700 font-medium"
                              title="Change shipping service"
                            >
                              Change Service
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRetryRow(row.id)}
                              disabled={retryingRows.has(row.id) || (row.retryCount != null && row.retryCount >= (row.maxRetries || 3))}
                              className="text-amber-600 hover:text-amber-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              title={
                                row.retryCount != null && row.retryCount >= (row.maxRetries || 3)
                                  ? 'Max retries exceeded'
                                  : 'Retry this row'
                              }
                            >
                              {retryingRows.has(row.id) ? 'Retrying...' :
                              row.retryCount != null && row.retryCount >= (row.maxRetries || 3) ? 'Max Retries' :
                              'Retry'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset Button */}
      {!isProcessing && onReset && (
        <div className="flex justify-center pt-6 border-t border-gray-200">
          <button
            onClick={onReset}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
          >
            Start New Batch Import
          </button>
        </div>
      )}
        </>
      )}

      {/* Original Data Tab */}
      {activeTab === 'original' && (() => {
        // Use originalData from batch status if available, otherwise use props
        const dataToShow = batchStatus?.originalData || originalData
        const mappingToShow = batchStatus?.columnMapping || columnMapping

        if (!dataToShow || dataToShow.length === 0) {
          return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Original data is not available. This batch may have been created before this feature was added.
              </p>
            </div>
          )
        }

        return (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                This tab shows the exact data that was imported from your CSV/Excel file ({dataToShow.length} rows).
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Row #
                      </th>
                      {dataToShow[0] && Object.keys(dataToShow[0]).map((header) => (
                        <th
                          key={header}
                          className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase"
                        >
                          {header}
                          {mappingToShow && mappingToShow[header] && (
                            <div className="text-[10px] text-blue-600 font-normal normal-case mt-0.5">
                              → {mappingToShow[header]}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dataToShow.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {idx + 1}
                      </td>
                      {Object.values(row).map((value: any, colIdx) => (
                        <td key={colIdx} className="px-3 py-3 text-sm text-gray-600">
                          <div className="max-w-xs truncate" title={String(value || '')}>
                            {value != null ? String(value) : '-'}
                          </div>
                        </td>
                      ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reset Button for Original Data Tab */}
            {!isProcessing && onReset && (
              <div className="flex justify-center pt-6 border-t border-gray-200">
                <button
                  onClick={onReset}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                >
                  Start New Batch Import
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {/* Service Selector Modal */}
      {changingServiceRow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Change Shipping Service</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Carrier
                </label>
                <select
                  value={selectedCarrier}
                  onChange={(e) => {
                    setSelectedCarrier(e.target.value)
                    setSelectedService('')
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select carrier...</option>
                  {carriers.map((carrier) => (
                    <option key={carrier.carrier_id} value={carrier.carrier_id}>
                      {carrier.friendly_name || carrier.carrier_id}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCarrier && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service
                  </label>
                  <select
                    value={selectedService}
                    onChange={(e) => setSelectedService(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select service...</option>
                    {carriers
                      .find((c) => c.carrier_id === selectedCarrier)
                      ?.services?.map((service: any) => (
                        <option key={service.service_code} value={service.service_code}>
                          {service.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setChangingServiceRow(null)
                  setSelectedCarrier('')
                  setSelectedService('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeService}
                disabled={!selectedCarrier || !selectedService}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Change Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Labels Loading Modal */}
      {isDownloadingLabels && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Downloading Labels...</h3>
            <p className="text-gray-600 text-sm">
              Please wait while we prepare your labels. This may take a few moments.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
