'use client'

import { useState, useEffect } from 'react'

interface InvoiceIntegration {
  id: string
  invoiceNumber: string
  status: string
  payload: any
  netsuiteResponse: any | null
  netsuiteInvoiceId: string | null
  errorMessage: string | null
  retryCount: number
  maxRetries: number
  lastAttemptAt: string | null
  createdAt: string
  updatedAt: string
  sentToNetsuiteAt: string | null
}

export default function InvoiceIntegrationsPage() {
  const [invoices, setInvoices] = useState<InvoiceIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceIntegration | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const fetchInvoices = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/invoices/integrations')

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success) {
        setInvoices(data.data)
      } else {
        throw new Error('API returned unsuccessful response')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Fetch invoices error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [])

  const filteredInvoices = statusFilter === 'all'
    ? invoices
    : invoices.filter(inv => inv.status === statusFilter)

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'sent':
        return 'bg-purple-100 text-purple-800'
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

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoice Integrations</h1>
            <p className="text-sm text-gray-500 mt-1">
              PACE to NetSuite invoice sync status
            </p>
          </div>

          <button
            onClick={fetchInvoices}
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

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Status:</label>
          <div className="flex gap-2">
            {['all', 'pending', 'processing', 'sent', 'completed', 'failed'].map((status) => (
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
            {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Invoices List */}
        <div className={`${selectedInvoice ? 'w-1/2' : 'w-full'} border-r border-gray-200 overflow-auto`}>
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
                <p className="text-gray-600">Loading invoices...</p>
              </div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-600">No invoices found</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  onClick={() => setSelectedInvoice(invoice)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedInvoice?.id === invoice.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {invoice.invoiceNumber}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Created: {formatDate(invoice.createdAt)}</div>
                        {invoice.sentToNetsuiteAt && (
                          <div>Sent to NetSuite: {formatDate(invoice.sentToNetsuiteAt)}</div>
                        )}
                        {invoice.netsuiteInvoiceId && (
                          <div className="font-medium text-green-700">
                            NetSuite ID: {invoice.netsuiteInvoiceId}
                          </div>
                        )}
                        {invoice.errorMessage && (
                          <div className="text-red-600 text-xs mt-1">
                            Error: {invoice.errorMessage}
                          </div>
                        )}
                        {invoice.retryCount > 0 && (
                          <div className="text-xs text-orange-600">
                            Retries: {invoice.retryCount}/{invoice.maxRetries}
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

        {/* Invoice Details Panel */}
        {selectedInvoice && (
          <div className="w-1/2 bg-white overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Invoice Details</h2>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status and Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Status Information</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(selectedInvoice.status)}`}>
                      {selectedInvoice.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Invoice Number:</span>
                    <span className="font-medium">{selectedInvoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span>{formatDate(selectedInvoice.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Updated:</span>
                    <span>{formatDate(selectedInvoice.updatedAt)}</span>
                  </div>
                  {selectedInvoice.sentToNetsuiteAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sent to NetSuite:</span>
                      <span>{formatDate(selectedInvoice.sentToNetsuiteAt)}</span>
                    </div>
                  )}
                  {selectedInvoice.netsuiteInvoiceId && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">NetSuite ID:</span>
                      <span className="font-mono text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        {selectedInvoice.netsuiteInvoiceId}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Retry Count:</span>
                    <span>{selectedInvoice.retryCount} / {selectedInvoice.maxRetries}</span>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {selectedInvoice.errorMessage && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Error Details</h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                    {selectedInvoice.errorMessage}
                  </div>
                </div>
              )}

              {/* PACE Payload */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">PACE Invoice Data</h3>
                <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto">
                  {JSON.stringify(selectedInvoice.payload, null, 2)}
                </pre>
              </div>

              {/* NetSuite Response */}
              {selectedInvoice.netsuiteResponse && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">NetSuite Response</h3>
                  <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto">
                    {JSON.stringify(selectedInvoice.netsuiteResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
