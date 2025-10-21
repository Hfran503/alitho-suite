'use client'

import { useState, useEffect } from 'react'

interface Step5ProcessingProps {
  batchId: string
  onReset: () => void
}

interface RowStatus {
  id: string
  rowNumber: number
  jobNumber: string
  shipToName: string
  shipToCity: string
  shipToState: string
  packageNumber: number
  totalPackages: number
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'
  trackingNumber?: string
  labelUrl?: string
  errorMessage?: string
  jobShipmentId?: string
  cartonId?: string
}

interface BatchStatus {
  id: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  totalRows: number
  successfulRows: number
  failedRows: number
  progress: number
  rows: RowStatus[]
}

export function Step5Processing({ batchId, onReset }: Step5ProcessingProps) {
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryingRows, setRetryingRows] = useState<Set<string>>(new Set())
  const [voidingRows, setVoidingRows] = useState<Set<string>>(new Set())

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
          return true // Stop polling
        }
        return false
      } catch (err: any) {
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

    return () => clearInterval(interval)
  }, [batchId])

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
        throw new Error('Failed to void label')
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

    if (!confirm(`Retry all ${failedRows.length} failed rows?`)) {
      return
    }

    for (const row of failedRows) {
      await handleRetryRow(row.id)
    }
  }

  const handleDownloadAllLabels = async () => {
    if (!batchStatus) return

    const successRows = batchStatus.rows.filter((r) => r.status === 'SUCCESS' && r.labelUrl)
    if (successRows.length === 0) {
      alert('No labels available to download')
      return
    }

    // Open each label in new tab (browsers may block multiple popups)
    for (const row of successRows) {
      if (row.labelUrl) {
        window.open(row.labelUrl, '_blank')
      }
    }
  }

  const handleExportResults = () => {
    if (!batchStatus) return

    // Create CSV with results
    const headers = [
      'Row',
      'Job#',
      'Ship To',
      'City',
      'State',
      'Pkg',
      'Status',
      'Tracking',
      'Error',
    ]
    const rows = batchStatus.rows.map((row) => [
      row.rowNumber,
      row.jobNumber,
      row.shipToName,
      row.shipToCity,
      row.shipToState,
      `${row.packageNumber}/${row.totalPackages}`,
      row.status,
      row.trackingNumber || '',
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
            <button
              onClick={onReset}
              className="mt-3 text-sm text-red-600 underline hover:no-underline"
            >
              Go back to start
            </button>
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
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-green-600">{batchStatus.successfulRows}</div>
          <div className="text-sm text-green-900 font-medium mt-1">Successful</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-red-600">{batchStatus.failedRows}</div>
          <div className="text-sm text-red-900 font-medium mt-1">Failed</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-gray-600">
            {batchStatus.totalRows - batchStatus.successfulRows - batchStatus.failedRows}
          </div>
          <div className="text-sm text-gray-900 font-medium mt-1">Pending</div>
        </div>
      </div>

      {/* Bulk Actions */}
      {!isProcessing && (
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleRetryAllFailed}
            disabled={batchStatus.failedRows === 0}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors text-sm"
          >
            Retry All Failed ({batchStatus.failedRows})
          </button>
          <button
            onClick={handleDownloadAllLabels}
            disabled={batchStatus.successfulRows === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors text-sm"
          >
            Download All Labels
          </button>
          <button
            onClick={handleExportResults}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors text-sm"
          >
            Export Results CSV
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
                  Ship To
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  City, State
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Pkg
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Tracking / Error
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
                  <td className="px-3 py-3 text-sm text-gray-600">{row.shipToName}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                    {row.shipToCity}, {row.shipToState}
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
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {row.status === 'SUCCESS' && row.trackingNumber && (
                      <span className="font-mono text-gray-900">{row.trackingNumber}</span>
                    )}
                    {row.status === 'FAILED' && row.errorMessage && (
                      <span className="text-red-600 text-xs">{row.errorMessage}</span>
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
                        <button
                          onClick={() => handleRetryRow(row.id)}
                          disabled={retryingRows.has(row.id)}
                          className="text-amber-600 hover:text-amber-700 font-medium disabled:opacity-50"
                        >
                          {retryingRows.has(row.id) ? 'Retrying...' : 'Retry'}
                        </button>
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
      {!isProcessing && (
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
}
