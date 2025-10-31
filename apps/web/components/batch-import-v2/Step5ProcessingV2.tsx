'use client'

import { useState, useEffect } from 'react'

interface Step5ProcessingV2Props {
  batchId: string
  onReset?: () => void
}

interface BatchStatus {
  batch_id: string
  external_batch_id: string
  status: 'open' | 'queued' | 'processing' | 'completed' | 'archived' | 'invalid' | 'completed_with_errors'
  batch_notes: string
  created_at: string
  processed_at?: string
  errors: number
  warnings: number
  completed: number
  forms: number
  count: number
  label_download?: { href: string }
  form_download?: { href: string }
  batch_errors_url?: { href: string }
}

interface BatchError {
  error: string
  shipment_id: string
  external_shipment_id?: string
}

export function Step5ProcessingV2({ batchId, onReset }: Step5ProcessingV2Props) {
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null)
  const [batchErrors, setBatchErrors] = useState<BatchError[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Poll for status updates
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/batch-import-v2/${batchId}/status`)
        if (!response.ok) {
          throw new Error('Failed to fetch batch status')
        }

        const data = await response.json()
        setBatchStatus(data.data)
        setIsLoading(false)

        // Stop polling if batch is complete or failed
        if (
          data.data.status === 'completed' ||
          data.data.status === 'completed_with_errors' ||
          data.data.status === 'invalid' ||
          data.data.status === 'archived'
        ) {
          console.log(`[Batch V2] Batch completed with status: ${data.data.status}`)

          // Fetch errors if any
          if (data.data.errors > 0) {
            fetchErrors()
          }

          return true // Stop polling
        }
        return false
      } catch (err: any) {
        console.error(`[Batch V2] Error fetching status:`, err)
        setError(err.message)
        setIsLoading(false)
        return true // Stop polling on error
      }
    }

    const fetchErrors = async () => {
      try {
        const response = await fetch(`/api/batch-import-v2/${batchId}/errors`)
        if (response.ok) {
          const data = await response.json()
          setBatchErrors(data.data || [])
        }
      } catch (err) {
        console.error('[Batch V2] Failed to fetch errors:', err)
      }
    }

    // Initial fetch
    fetchStatus()

    // Poll every 3 seconds
    const interval = setInterval(async () => {
      const shouldStop = await fetchStatus()
      if (shouldStop) {
        clearInterval(interval)
      }
    }, 3000)

    return () => {
      clearInterval(interval)
    }
  }, [batchId])

  const handleDownloadLabels = () => {
    if (batchStatus?.label_download?.href) {
      window.open(batchStatus.label_download.href, '_blank')
    }
  }

  const handleDownloadForms = () => {
    if (batchStatus?.form_download?.href) {
      window.open(batchStatus.form_download.href, '_blank')
    }
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

  const isProcessing = batchStatus.status === 'processing' || batchStatus.status === 'queued'
  const isComplete = batchStatus.status === 'completed'
  const hasErrors = batchStatus.status === 'completed_with_errors' || batchStatus.status === 'invalid'
  const progressPercent = batchStatus.count > 0 ? (batchStatus.completed / batchStatus.count) * 100 : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {isProcessing ? 'Processing Batch...' : isComplete ? 'Batch Complete' : hasErrors ? 'Batch Completed with Errors' : 'Batch Status'}
        </h2>
        <p className="text-gray-600">
          {isProcessing
            ? 'ShipEngine is processing your batch. This may take several minutes.'
            : 'Review the results below and download labels.'}
        </p>
      </div>

      {/* Batch Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-blue-700 font-medium">Batch ID:</span>
            <span className="ml-2 text-blue-900 font-mono">{batchStatus.batch_id}</span>
          </div>
          <div>
            <span className="text-blue-700 font-medium">Status:</span>
            <span className="ml-2 text-blue-900 font-semibold capitalize">{batchStatus.status.replace(/_/g, ' ')}</span>
          </div>
          {batchStatus.batch_notes && (
            <div className="col-span-2">
              <span className="text-blue-700 font-medium">Notes:</span>
              <span className="ml-2 text-blue-900">{batchStatus.batch_notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {isProcessing && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">
              Progress: {batchStatus.completed} / {batchStatus.count}
            </span>
            <span className="text-sm font-medium text-gray-700">{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all duration-500 bg-blue-600"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-green-600">{batchStatus.completed}</div>
          <div className="text-sm text-green-900 font-medium mt-1">Completed</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-red-600">{batchStatus.errors}</div>
          <div className="text-sm text-red-900 font-medium mt-1">Errors</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-amber-600">{batchStatus.warnings}</div>
          <div className="text-sm text-amber-900 font-medium mt-1">Warnings</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-gray-600">{batchStatus.count}</div>
          <div className="text-sm text-gray-900 font-medium mt-1">Total</div>
        </div>
      </div>

      {/* Errors List */}
      {batchErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-900 mb-3">Batch Errors</h3>
          <div className="space-y-2">
            {batchErrors.map((error, idx) => (
              <div key={idx} className="bg-white border border-red-200 rounded p-3 text-sm">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-red-800 font-medium">{error.error}</p>
                    {error.external_shipment_id && (
                      <p className="text-red-600 text-xs mt-1">
                        Shipment: {error.external_shipment_id}
                      </p>
                    )}
                    <p className="text-gray-600 text-xs mt-1 font-mono">
                      ID: {error.shipment_id}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-red-700 mt-3">
            To fix these errors, correct the shipments and create a new batch.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      {!isProcessing && (
        <div className="flex items-center gap-3 pt-2 flex-wrap">
          {batchStatus.label_download?.href && (
            <button
              onClick={handleDownloadLabels}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download All Labels
            </button>
          )}
          {batchStatus.form_download?.href && batchStatus.forms > 0 && (
            <button
              onClick={handleDownloadForms}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Forms ({batchStatus.forms})
            </button>
          )}
        </div>
      )}

      {/* Success Message */}
      {isComplete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="font-semibold text-green-900 mb-1">Batch Completed Successfully!</h4>
              <p className="text-sm text-green-800">
                All {batchStatus.completed} labels have been created. You can now download them using the button above.
              </p>
            </div>
          </div>
        </div>
      )}

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
    </div>
  )
}
