'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId: string | null
  userId: string | null
  actorName: string | null
  actorEmail: string | null
  ipAddress: string | null
  paceTransactionId: string | null
  metadata: any
  createdAt: string
  user?: {
    id: string
    name: string | null
    email: string | null
  }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  // Filters
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    entityId: '',
    paceTransactionId: '',
    actorEmail: '',
    startDate: '',
    endDate: '',
  })
  const [page, setPage] = useState(1)

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', '25')

      if (filters.action) params.set('action', filters.action)
      if (filters.entityType) params.set('entityType', filters.entityType)
      if (filters.entityId) params.set('entityId', filters.entityId)
      if (filters.paceTransactionId) params.set('paceTransactionId', filters.paceTransactionId)
      if (filters.actorEmail) params.set('actorEmail', filters.actorEmail)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)

      const response = await fetch(`/api/admin/audit-logs?${params}`)
      const data = await response.json()

      if (data.success) {
        setLogs(data.data.logs)
        setPagination(data.data.pagination)
      } else {
        setError(data.error || 'Failed to fetch audit logs')
      }
    } catch (err) {
      setError('Failed to fetch audit logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchLogs()
  }

  const handleClearFilters = () => {
    setFilters({
      action: '',
      entityType: '',
      entityId: '',
      paceTransactionId: '',
      actorEmail: '',
      startDate: '',
      endDate: '',
    })
    setPage(1)
    setTimeout(fetchLogs, 0)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getActionColor = (action: string) => {
    if (action.includes('create')) return 'bg-green-100 text-green-800'
    if (action.includes('update')) return 'bg-blue-100 text-blue-800'
    if (action.includes('delete')) return 'bg-red-100 text-red-800'
    if (action.includes('process')) return 'bg-purple-100 text-purple-800'
    return 'bg-gray-100 text-gray-800'
  }

  // Format camelCase/snake_case to Title Case
  const formatLabel = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim()
  }

  // Format metadata value based on type
  const formatMetadataValue = (key: string, value: any): string => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'number') {
      // Format costs as currency
      if (key.toLowerCase().includes('cost') || key.toLowerCase().includes('price')) {
        return `$${value.toFixed(2)}`
      }
      return value.toString()
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return '-'
      // For tracking numbers, show as comma-separated
      if (key.toLowerCase().includes('tracking')) {
        return value.join(', ')
      }
      return value.join(', ')
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  // Render metadata in a user-friendly way
  const renderMetadata = (metadata: any) => {
    if (!metadata || typeof metadata !== 'object') {
      return <span className="text-gray-400">No metadata</span>
    }

    const entries = Object.entries(metadata)
    if (entries.length === 0) {
      return <span className="text-gray-400">No metadata</span>
    }

    return (
      <div className="space-y-2">
        {entries.map(([key, value]) => {
          // Skip internal fields
          if (key === 'paceResponse' || key === 'requestBody') {
            return (
              <div key={key} className="border-t pt-2 mt-2">
                <div className="font-medium text-gray-600 text-xs uppercase mb-1">{formatLabel(key)}</div>
                <pre className="bg-gray-50 px-2 py-1 rounded text-xs overflow-auto max-h-32">
                  {JSON.stringify(value, null, 2)}
                </pre>
              </div>
            )
          }

          const formattedValue = formatMetadataValue(key, value)
          const isLongValue = formattedValue.length > 50

          return (
            <div key={key} className="flex items-start gap-2">
              <span className="font-medium text-gray-600 min-w-[140px] text-xs">{formatLabel(key)}:</span>
              {isLongValue ? (
                <span className="text-gray-900 text-xs break-all">{formattedValue}</span>
              ) : (
                <span className="text-gray-900 text-xs">{formattedValue}</span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="w-full px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PACE Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-1">Track all PACE API transactions and who initiated them</p>
        </div>
        <Link href="/admin" className="text-sm text-blue-600 hover:text-blue-800">
          Back to Admin
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">PACE Transaction ID</label>
              <input
                type="text"
                value={filters.paceTransactionId}
                onChange={(e) => setFilters({ ...filters, paceTransactionId: e.target.value })}
                placeholder="UUID from PACE"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
              <input
                type="text"
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                placeholder="e.g., pace.shipment"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Entity Type</label>
              <input
                type="text"
                value={filters.entityType}
                onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
                placeholder="e.g., JobShipment"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Entity ID</label>
              <input
                type="text"
                value={filters.entityId}
                onChange={(e) => setFilters({ ...filters, entityId: e.target.value })}
                placeholder="e.g., 147237"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">User Email</label>
              <input
                type="text"
                value={filters.actorEmail}
                onChange={(e) => setFilters({ ...filters, actorEmail: e.target.value })}
                placeholder="e.g., john@calitho.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Search
              </button>
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 focus:outline-none"
              >
                Clear
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading audit logs...</div>
      ) : (
        <>
          {/* Results count */}
          {pagination && (
            <div className="text-sm text-gray-500 mb-4">
              Showing {logs.length} of {pagination.total} logs
            </div>
          )}

          {/* Logs Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PACE Txn ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedLog(log)}>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{log.actorName || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{log.actorEmail || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">{log.entityType}</div>
                        {log.entityId && (
                          <div className="text-xs text-gray-500">ID: {log.entityId}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.paceTransactionId ? (
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                            {log.paceTransactionId.substring(0, 8)}...
                          </code>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setSelectedLog(null)}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Audit Log Details</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{formatDate(selectedLog.createdAt)}</p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-500 p-1"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                {/* Action Badge */}
                <div className="mb-4">
                  <span className={`inline-flex px-3 py-1.5 text-sm font-medium rounded-full ${getActionColor(selectedLog.action)}`}>
                    {selectedLog.action}
                  </span>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-medium text-gray-500 uppercase">User</div>
                      <div className="text-sm text-gray-900 mt-1">{selectedLog.actorName || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{selectedLog.actorEmail || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 uppercase">Entity</div>
                      <div className="text-sm text-gray-900 mt-1">{selectedLog.entityType}</div>
                      {selectedLog.entityId && (
                        <div className="text-xs text-gray-500">ID: {selectedLog.entityId}</div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-medium text-gray-500 uppercase">IP Address</div>
                      <div className="text-sm text-gray-900 mt-1">{selectedLog.ipAddress || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 uppercase">PACE Transaction ID</div>
                      <code className="block text-xs bg-gray-100 px-2 py-1.5 rounded font-mono mt-1 break-all">
                        {selectedLog.paceTransactionId || '-'}
                      </code>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase mb-2">Metadata</div>
                  <div className="bg-gray-50 px-4 py-3 rounded-lg border border-gray-200">
                    {renderMetadata(selectedLog.metadata)}
                  </div>
                </div>

                {/* Log ID */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-xs text-gray-400">
                    Log ID: {selectedLog.id}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
