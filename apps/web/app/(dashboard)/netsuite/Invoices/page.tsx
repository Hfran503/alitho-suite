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

interface NetSuiteConfig {
  currentMode: 'sandbox' | 'production'
  sandboxEnabled: boolean
  productionEnabled: boolean
  configured: boolean
}

export default function InvoiceIntegrationsPage() {
  const [invoices, setInvoices] = useState<InvoiceIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceIntegration | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sendingToNetsuite, setSendingToNetsuite] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)
  const [netsuiteConfig, setNetsuiteConfig] = useState<NetSuiteConfig | null>(null)
  const [showDiagnostic, setShowDiagnostic] = useState(false)
  const [diagnosticData, setDiagnosticData] = useState<any>(null)
  const [loadingDiagnostic, setLoadingDiagnostic] = useState(false)

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
    fetchNetSuiteConfig()
  }, [])

  const fetchNetSuiteConfig = async () => {
    try {
      const response = await fetch('/api/integrations/netsuite')
      if (response.ok) {
        const data = await response.json()
        setNetsuiteConfig(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch NetSuite config:', err)
    }
  }

  const handleDiagnostic = async () => {
    setLoadingDiagnostic(true)
    try {
      const response = await fetch('/api/integrations/netsuite/diagnostic')
      const data = await response.json()
      setDiagnosticData(data.data)
      setShowDiagnostic(true)
    } catch (err) {
      console.error('Failed to fetch diagnostic data:', err)
      alert('Failed to load diagnostic information')
    } finally {
      setLoadingDiagnostic(false)
    }
  }

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

  const handleSendToNetsuite = async () => {
    if (!selectedInvoice) return

    setSendingToNetsuite(true)
    setSendError(null)
    setSendSuccess(null)

    try {
      const response = await fetch(
        `/api/invoices/integrations/${selectedInvoice.id}/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      )

      const data = await response.json()

      console.log('NetSuite send response:', { status: response.status, data })

      if (response.ok && data.success) {
        setSendSuccess('Invoice sent to NetSuite successfully!')
        // Refresh the invoice list to get updated status
        await fetchInvoices()
        // Update the selected invoice if it's still the same one
        if (selectedInvoice) {
          const updatedInvoice = await fetch('/api/invoices/integrations')
            .then((r) => r.json())
            .then((result) =>
              result.data.find((inv: InvoiceIntegration) => inv.id === selectedInvoice.id)
            )
          if (updatedInvoice) {
            setSelectedInvoice(updatedInvoice)
          }
        }
      } else {
        const errorMsg = data.error || 'Failed to send invoice to NetSuite'
        console.error('NetSuite send error:', errorMsg, data)
        setSendError(errorMsg)
      }
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : 'An error occurred while sending to NetSuite'
      )
      console.error('Send to NetSuite error:', err)
    } finally {
      setSendingToNetsuite(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Invoice Integrations</h1>
              {netsuiteConfig && (
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    netsuiteConfig.currentMode === 'production'
                      ? 'bg-green-100 text-green-800 border border-green-300'
                      : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                  }`}>
                    {netsuiteConfig.currentMode === 'production' ? '🟢 Production Mode' : '⚠️ Sandbox Mode'}
                  </span>
                  {!netsuiteConfig[`${netsuiteConfig.currentMode}Enabled`] && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-300">
                      Disabled
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              PACE to NetSuite invoice sync status
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDiagnostic}
              disabled={loadingDiagnostic}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2 text-sm"
              title="Check NetSuite Configuration"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {loadingDiagnostic ? 'Checking...' : 'Diagnostic'}
            </button>
            {netsuiteConfig && netsuiteConfig.currentMode === 'sandbox' && (
              <a
                href="/settings#integrations"
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium flex items-center gap-2 text-sm"
                title="Switch to Production mode in Settings"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Switch to Production
              </a>
            )}
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
                        {invoice.payload && typeof invoice.payload === 'object' && 'invoice' in invoice.payload && (
                          <>
                            <div className="font-medium text-gray-900">
                              {(invoice.payload as any).invoice.customerName || 'Unknown Customer'}
                            </div>
                            <div className="text-xs text-gray-500">
                              Amount: ${((invoice.payload as any).invoice.invoiceAmount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                              {(invoice.payload as any).invoice.taxAmount > 0 && (
                                <> | Tax: ${((invoice.payload as any).invoice.taxAmount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</>
                              )}
                            </div>
                          </>
                        )}
                        <div className="text-xs">Created: {formatDate(invoice.createdAt)}</div>
                        {invoice.sentToNetsuiteAt && (
                          <div className="text-xs">Sent to NetSuite: {formatDate(invoice.sentToNetsuiteAt)}</div>
                        )}
                        {invoice.netsuiteInvoiceId && (
                          <div className="font-medium text-green-700 text-xs">
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
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-gray-900">Invoice Details</h2>
              <div className="flex items-center gap-3">
                {/* Send to NetSuite Button */}
                <button
                  onClick={handleSendToNetsuite}
                  disabled={sendingToNetsuite || selectedInvoice.status === 'completed'}
                  className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                    selectedInvoice.status === 'completed'
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : sendingToNetsuite
                      ? 'bg-blue-400 text-white cursor-wait'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  title={
                    selectedInvoice.status === 'completed'
                      ? 'Invoice already sent to NetSuite'
                      : 'Send invoice to NetSuite'
                  }
                >
                  {sendingToNetsuite ? (
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
                      Send to NetSuite
                    </>
                  )}
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
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

              {/* User-Friendly Invoice Display */}
              {selectedInvoice.payload && typeof selectedInvoice.payload === 'object' && 'invoice' in selectedInvoice.payload && (
                <>
                  {/* Invoice Header */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Invoice Information</h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-600">Customer</p>
                          <p className="font-semibold text-gray-900">{(selectedInvoice.payload as any).invoice.customerName || 'N/A'}</p>
                          <p className="text-xs text-gray-500">ID: {(selectedInvoice.payload as any).invoice.customerId || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Invoice Amount</p>
                          <p className="font-semibold text-gray-900 text-lg">${((selectedInvoice.payload as any).invoice.invoiceAmount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
                          {(selectedInvoice.payload as any).invoice.taxAmount > 0 && (
                            <p className="text-xs text-gray-500">Tax: ${((selectedInvoice.payload as any).invoice.taxAmount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">PO Number</p>
                          <p className="font-medium text-gray-900">{(selectedInvoice.payload as any).invoice.poNumber || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Invoice Date</p>
                          <p className="font-medium text-gray-900">{(selectedInvoice.payload as any).invoice.invoiceDate || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sales Distribution Lines */}
                  {(selectedInvoice.payload as any).salesDistributions && (selectedInvoice.payload as any).salesDistributions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">
                        Sales Distribution Lines ({(selectedInvoice.payload as any).salesDistributions.length})
                      </h3>
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {(selectedInvoice.payload as any).salesDistributions.map((line: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-sm text-gray-900">{line.salesCategoryName || 'N/A'}</td>
                                <td className="px-3 py-2 text-sm text-gray-600 text-center">{line.quantity || 1}</td>
                                <td className="px-3 py-2 text-sm text-gray-900 text-right font-medium">
                                  ${(line.amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Invoice Extras */}
                  {(selectedInvoice.payload as any).invoiceExtras && (selectedInvoice.payload as any).invoiceExtras.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">
                        Invoice Extras ({(selectedInvoice.payload as any).invoiceExtras.length})
                      </h3>
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Line #</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {(selectedInvoice.payload as any).invoiceExtras.map((extra: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-sm text-gray-900">{extra.invoiceExtraTypeName || 'N/A'}</td>
                                <td className="px-3 py-2 text-sm text-gray-600 text-center">{extra.lineNum || 'N/A'}</td>
                                <td className="px-3 py-2 text-sm text-gray-600 text-center">{extra.quantity || 1}</td>
                                <td className="px-3 py-2 text-sm text-gray-900 text-right font-medium">
                                  ${(extra.price || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Raw JSON (Collapsed by default) */}
              <div>
                <details>
                  <summary className="text-sm font-semibold text-gray-700 uppercase mb-3 cursor-pointer hover:text-gray-900">
                    Raw PACE Invoice Data (JSON)
                  </summary>
                  <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto mt-3">
                    {JSON.stringify(selectedInvoice.payload, null, 2)}
                  </pre>
                </details>
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

      {/* Diagnostic Modal */}
      {showDiagnostic && diagnosticData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">NetSuite Configuration Diagnostic</h2>
              <button
                onClick={() => setShowDiagnostic(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Issues */}
              {diagnosticData.issues && diagnosticData.issues.length > 0 && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-red-900 mb-3">⚠️ Issues Found</h3>
                  <ul className="space-y-2">
                    {diagnosticData.issues.map((issue: string, idx: number) => (
                      <li key={idx} className="text-sm text-red-800">{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Current Configuration */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">Current Configuration</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-blue-700 font-medium">Mode:</span>
                    <span className="ml-2 font-mono text-blue-900">{diagnosticData.currentMode}</span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Mode Enabled:</span>
                    <span className="ml-2 font-mono text-blue-900">{diagnosticData.currentModeEnabled ? '✅ Yes' : '❌ No'}</span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Sandbox Enabled:</span>
                    <span className="ml-2 font-mono text-blue-900">{diagnosticData.sandboxEnabled ? '✅ Yes' : '❌ No'}</span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Production Enabled:</span>
                    <span className="ml-2 font-mono text-blue-900">{diagnosticData.productionEnabled ? '✅ Yes' : '❌ No'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-blue-700 font-medium">RESTlet URL:</span>
                    <span className="ml-2 font-mono text-xs text-blue-900 break-all">{diagnosticData.restletUrl}</span>
                  </div>
                </div>
              </div>

              {/* Active Credentials */}
              <div className={`border-2 rounded-lg p-4 ${diagnosticData.activeCredentials.hasAllCredentials ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                <h3 className="text-sm font-semibold mb-3" style={{color: diagnosticData.activeCredentials.hasAllCredentials ? '#166534' : '#991b1b'}}>
                  Active Credentials ({diagnosticData.activeCredentials.mode})
                </h3>
                <div className="space-y-2 text-sm font-mono">
                  <div>
                    <span className="font-medium">Account ID:</span>
                    <span className="ml-2">{diagnosticData.activeCredentials.accountId}</span>
                  </div>
                  <div>
                    <span className="font-medium">Consumer Key:</span>
                    <span className="ml-2">{diagnosticData.activeCredentials.consumerKey}</span>
                  </div>
                  <div>
                    <span className="font-medium">Consumer Secret:</span>
                    <span className="ml-2">{diagnosticData.activeCredentials.consumerSecret}</span>
                  </div>
                  <div>
                    <span className="font-medium">Token ID:</span>
                    <span className="ml-2">{diagnosticData.activeCredentials.tokenId}</span>
                  </div>
                  <div>
                    <span className="font-medium">Token Secret:</span>
                    <span className="ml-2">{diagnosticData.activeCredentials.tokenSecret}</span>
                  </div>
                </div>
              </div>

              {/* Sandbox Credentials */}
              <div className={`border rounded-lg p-4 ${diagnosticData.sandboxCredentials.hasAllCredentials ? 'bg-gray-50 border-gray-300' : 'bg-yellow-50 border-yellow-300'}`}>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Sandbox Credentials</h3>
                <div className="space-y-2 text-sm font-mono">
                  <div>
                    <span className="font-medium">Account ID:</span>
                    <span className="ml-2">{diagnosticData.sandboxCredentials.accountId}</span>
                  </div>
                  <div>
                    <span className="font-medium">Consumer Key:</span>
                    <span className="ml-2">{diagnosticData.sandboxCredentials.consumerKey}</span>
                  </div>
                  <div>
                    <span className="font-medium">Consumer Secret:</span>
                    <span className="ml-2">{diagnosticData.sandboxCredentials.consumerSecret}</span>
                  </div>
                  <div>
                    <span className="font-medium">Token ID:</span>
                    <span className="ml-2">{diagnosticData.sandboxCredentials.tokenId}</span>
                  </div>
                  <div>
                    <span className="font-medium">Token Secret:</span>
                    <span className="ml-2">{diagnosticData.sandboxCredentials.tokenSecret}</span>
                  </div>
                </div>
              </div>

              {/* Production Credentials */}
              <div className={`border rounded-lg p-4 ${diagnosticData.productionCredentials.hasAllCredentials ? 'bg-gray-50 border-gray-300' : 'bg-yellow-50 border-yellow-300'}`}>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Production Credentials</h3>
                <div className="space-y-2 text-sm font-mono">
                  <div>
                    <span className="font-medium">Account ID:</span>
                    <span className="ml-2">{diagnosticData.productionCredentials.accountId}</span>
                  </div>
                  <div>
                    <span className="font-medium">Consumer Key:</span>
                    <span className="ml-2">{diagnosticData.productionCredentials.consumerKey}</span>
                  </div>
                  <div>
                    <span className="font-medium">Consumer Secret:</span>
                    <span className="ml-2">{diagnosticData.productionCredentials.consumerSecret}</span>
                  </div>
                  <div>
                    <span className="font-medium">Token ID:</span>
                    <span className="ml-2">{diagnosticData.productionCredentials.tokenId}</span>
                  </div>
                  <div>
                    <span className="font-medium">Token Secret:</span>
                    <span className="ml-2">{diagnosticData.productionCredentials.tokenSecret}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowDiagnostic(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
