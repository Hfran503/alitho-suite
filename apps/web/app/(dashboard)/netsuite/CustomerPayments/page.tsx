'use client'

import { useState, useEffect } from 'react'

interface CustomerPaymentIntegration {
  id: string
  processDate: string
  filename: string
  status: string
  recordCount: number
  paymentCount: number
  csvData: string
  payload: any
  processedData: any | null
  paceResponse: any | null
  errorMessage: string | null
  retryCount: number
  maxRetries: number
  lastAttemptAt: string | null
  createdAt: string
  updatedAt: string
  sentToPaceAt: string | null
}

export default function CustomerPaymentIntegrationsPage() {
  const [customerPayments, setCustomerPayments] = useState<CustomerPaymentIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPayment, setSelectedPayment] = useState<CustomerPaymentIntegration | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sendingToPace, setSendingToPace] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)
  const [needsReset, setNeedsReset] = useState(false)

  const fetchCustomerPayments = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/customer-payments/integrations')

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success) {
        setCustomerPayments(data.data)
      } else {
        throw new Error('API returned unsuccessful response')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Fetch customer payments error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomerPayments()
  }, [])

  const filteredPayments = statusFilter === 'all'
    ? customerPayments
    : customerPayments.filter(cp => cp.status === statusFilter)

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleSendToPace = async (reset: boolean = false) => {
    if (!selectedPayment) return

    setSendingToPace(true)
    setSendError(null)
    setSendSuccess(null)
    setNeedsReset(false)

    try {
      const url = reset
        ? `/api/customer-payments/integrations/${selectedPayment.id}/send?reset=true`
        : `/api/customer-payments/integrations/${selectedPayment.id}/send`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      const data = await response.json()

      console.log('PACE send response:', { status: response.status, data })

      if (response.ok && data.success) {
        setSendSuccess(
          reset
            ? 'Retry count reset! Customer payment queued for PACE successfully!'
            : 'Customer payment queued for PACE successfully!'
        )
        // Refresh the customer payment list to get updated status
        await fetchCustomerPayments()
        // Update the selected payment if it's still the same one
        if (selectedPayment) {
          const updatedPayment = await fetch('/api/customer-payments/integrations')
            .then((r) => r.json())
            .then((result) =>
              result.data.find((cp: CustomerPaymentIntegration) => cp.id === selectedPayment.id)
            )
          if (updatedPayment) {
            setSelectedPayment(updatedPayment)
          }
        }
      } else {
        const errorMsg = data.error || 'Failed to send customer payment to PACE'
        console.error('PACE send error:', errorMsg, data)
        setSendError(errorMsg)
        // Check if reset is needed
        if (data.needsReset) {
          setNeedsReset(true)
        }
      }
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : 'An error occurred while sending to PACE'
      )
      console.error('Send to PACE error:', err)
    } finally {
      setSendingToPace(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Customer Payment Integrations</h1>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
                NetSuite → PACE
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              NetSuite customer payments exported to PACE
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchCustomerPayments}
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

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Status:</label>
          <div className="flex gap-2">
            {['all', 'pending', 'processing', 'completed', 'failed'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  statusFilter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
          <div className="ml-auto text-sm text-gray-600">
            {filteredPayments.length} batch{filteredPayments.length !== 1 ? 'es' : ''}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Customer Payments List */}
        <div className={`${selectedPayment ? 'w-1/2' : 'w-full'} border-r border-gray-200 overflow-auto`}>
          {error && (
            <div className="m-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-600">Loading customer payments...</p>
              </div>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-600">No customer payments found</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredPayments.map((payment) => (
                <div
                  key={payment.id}
                  onClick={() => setSelectedPayment(payment)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedPayment?.id === payment.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {payment.filename}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(payment.status)}`}>
                          {payment.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="text-xs text-gray-500">
                          Process Date: {payment.processDate}
                        </div>
                        <div className="text-xs text-gray-500">
                          Records: {payment.recordCount} | Payments: {payment.paymentCount}
                        </div>
                        <div className="text-xs">Created: {formatDate(payment.createdAt)}</div>
                        {payment.sentToPaceAt && (
                          <div className="text-xs">Sent to PACE: {formatDate(payment.sentToPaceAt)}</div>
                        )}
                        {payment.errorMessage && (
                          <div className="text-red-600 text-xs mt-1">
                            Error: {payment.errorMessage}
                          </div>
                        )}
                        {payment.retryCount > 0 && (
                          <div className="text-xs text-orange-600">
                            Retries: {payment.retryCount}/{payment.maxRetries}
                          </div>
                        )}
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer Payment Details Panel */}
        {selectedPayment && (
          <div className="w-1/2 bg-white overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-gray-900">Customer Payment Details</h2>
              <div className="flex items-center gap-3">
                {/* Show Reset & Retry button if max retries exceeded */}
                {(needsReset || selectedPayment.retryCount >= selectedPayment.maxRetries) &&
                selectedPayment.status !== 'completed' ? (
                  <button
                    onClick={() => handleSendToPace(true)}
                    disabled={sendingToPace}
                    className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                      sendingToPace
                        ? 'bg-orange-400 text-white cursor-wait'
                        : 'bg-orange-600 text-white hover:bg-orange-700'
                    }`}
                    title="Reset retry count and send customer payment to PACE"
                  >
                    {sendingToPace ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
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
                        Resetting...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        Reset & Retry
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSendToPace(false)}
                    disabled={sendingToPace || selectedPayment.status === 'completed'}
                    className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                      selectedPayment.status === 'completed'
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : sendingToPace
                        ? 'bg-blue-400 text-white cursor-wait'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                    title={
                      selectedPayment.status === 'completed'
                        ? 'Customer payment already sent to PACE'
                        : 'Send customer payment to PACE'
                    }
                  >
                    {sendingToPace ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
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
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                          />
                        </svg>
                        Send to PACE
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setSelectedPayment(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Success Message */}
              {sendSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {sendSuccess}
                  </div>
                  <button
                    onClick={() => setSendSuccess(null)}
                    className="text-green-600 hover:text-green-800"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              )}

              {/* Error Message */}
              {sendError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {sendError}
                  </div>
                  <button
                    onClick={() => setSendError(null)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              )}

              {/* Status and Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Status Information</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(selectedPayment.status)}`}>
                      {selectedPayment.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Process Date:</span>
                    <span className="font-medium">{selectedPayment.processDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Filename:</span>
                    <span className="font-mono text-xs">{selectedPayment.filename}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Records:</span>
                    <span className="font-medium">{selectedPayment.recordCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payments:</span>
                    <span>{selectedPayment.paymentCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span>{formatDate(selectedPayment.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Updated:</span>
                    <span>{formatDate(selectedPayment.updatedAt)}</span>
                  </div>
                  {selectedPayment.sentToPaceAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sent to PACE:</span>
                      <span>{formatDate(selectedPayment.sentToPaceAt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Retry Count:</span>
                    <span>{selectedPayment.retryCount} / {selectedPayment.maxRetries}</span>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {selectedPayment.errorMessage && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Error Details</h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                    {selectedPayment.errorMessage}
                  </div>
                </div>
              )}

              {/* Processed Data Preview */}
              {selectedPayment.processedData && Array.isArray(selectedPayment.processedData) && selectedPayment.processedData.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">
                    Parsed Data ({selectedPayment.processedData.length} rows)
                  </h3>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-96">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-2 py-2 text-left font-medium text-gray-500">Payment ID</th>
                            <th className="px-2 py-2 text-left font-medium text-gray-500">Date</th>
                            <th className="px-2 py-2 text-left font-medium text-gray-500">Customer</th>
                            <th className="px-2 py-2 text-left font-medium text-gray-500">Invoice #</th>
                            <th className="px-2 py-2 text-right font-medium text-gray-500">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {selectedPayment.processedData.slice(0, 10).map((row: any, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-2 py-2 text-gray-900 font-mono">{row.paymentId}</td>
                              <td className="px-2 py-2 text-gray-600">{row.paymentDate}</td>
                              <td className="px-2 py-2 text-gray-900 font-mono">{row.customerExternalId}</td>
                              <td className="px-2 py-2 text-gray-900 font-mono">{row.invoiceNumber}</td>
                              <td className="px-2 py-2 text-gray-900 text-right">${row.paymentApplied}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {selectedPayment.processedData.length > 10 && (
                      <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 text-center">
                        Showing first 10 of {selectedPayment.processedData.length} rows
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Raw CSV Data */}
              <div>
                <details>
                  <summary className="text-sm font-semibold text-gray-700 uppercase mb-3 cursor-pointer hover:text-gray-900">
                    Raw CSV Data ({selectedPayment.csvData.split('\n').length} lines)
                  </summary>
                  <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto mt-3 max-h-96">
                    {selectedPayment.csvData.split('\n').slice(0, 100).join('\n')}
                    {selectedPayment.csvData.split('\n').length > 100 && '\n... (truncated)'}
                  </pre>
                </details>
              </div>

              {/* PACE Response */}
              {selectedPayment.paceResponse && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">PACE Response</h3>
                  <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto">
                    {JSON.stringify(selectedPayment.paceResponse, null, 2)}
                  </pre>
                </div>
              )}

              {/* Raw NetSuite Payload */}
              <div>
                <details>
                  <summary className="text-sm font-semibold text-gray-700 uppercase mb-3 cursor-pointer hover:text-gray-900">
                    Raw NetSuite Webhook Payload (JSON)
                  </summary>
                  <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto mt-3">
                    {JSON.stringify(selectedPayment.payload, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
