'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ShippingLabel {
  id: string
  paceShipmentId: number | null
  paceCartonId: number | null
  provider: string
  providerLabelId: string | null
  trackingNumber: string
  labelUrl: string
  carrier: string
  service: string
  cost: number
  currency: string
  status: string
  trackingStatus: string | null
  lastTrackedAt: string | null
  createdAt: string
  shipTo: any
  isReturnLabel: boolean
  rmaNumber: string | null
  outboundLabelId: string | null
  metadata?: {
    reference1?: string | null
    reference2?: string | null
    reference3?: string | null
    tracking?: {
      status_description?: string
      carrier_status_description?: string
      estimated_delivery_date?: string
      actual_delivery_date?: string
      last_event?: {
        description?: string
        city_locality?: string
        state_province?: string
        occurred_at?: string
      }
    }
    [key: string]: any
  }
}

export default function LabelsPage() {
  const router = useRouter()
  const [labels, setLabels] = useState<ShippingLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('active') // Default to active only
  const [filterCarrier, setFilterCarrier] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [carrierMappings, setCarrierMappings] = useState<Record<string, string>>({})
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now())

  // Get unique carriers from labels
  const uniqueCarriers = Array.from(new Set(labels.map(label => label.carrier))).sort()

  // Fetch carrier mappings on mount
  useEffect(() => {
    fetchCarrierMappings()
  }, [])

  useEffect(() => {
    fetchLabels()
  }, [filterStatus])

  // Auto-refresh when window regains focus, but only if it's been more than 30 minutes
  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now()
      const thirtyMinutes = 30 * 60 * 1000 // 30 minutes in milliseconds
      const timeSinceLastRefresh = now - lastRefreshTime

      if (timeSinceLastRefresh > thirtyMinutes) {
        console.log('Window focused after 30+ minutes, refreshing labels...')
        fetchLabels()
      } else {
        console.log('Window focused but last refresh was less than 30 minutes ago, skipping refresh')
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [filterStatus, lastRefreshTime])

  const fetchCarrierMappings = async () => {
    try {
      const response = await fetch('/api/settings/carrier-services')
      if (response.ok) {
        const data = await response.json()
        // Build a map of carrierId -> carrierName
        const mappings: Record<string, string> = {}
        data.data.forEach((mapping: any) => {
          mappings[mapping.shipstationCarrierId] = mapping.carrierName
        })
        setCarrierMappings(mappings)
      }
    } catch (err) {
      console.error('Error fetching carrier mappings:', err)
    }
  }

  const formatCarrierName = (carrierId: string): string => {
    // Use mapping if available, otherwise return the ID as-is
    return carrierMappings[carrierId] || carrierId
  }

  const getTrackingStatusBadge = (trackingStatus: string | null, status: string) => {
    // If voided or refunded, show that status
    if (status === 'voided' || status === 'refunded') {
      return null
    }

    if (!trackingStatus) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          No tracking
        </span>
      )
    }

    const statusConfig: Record<string, { bg: string; text: string; label: string; icon: string }> = {
      'unknown': { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Unknown', icon: '❓' },
      'accepted': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Accepted', icon: '✅' },
      'in_transit': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'In Transit', icon: '🚚' },
      'delivered': { bg: 'bg-green-100', text: 'text-green-700', label: 'Delivered', icon: '📬' },
      'exception': { bg: 'bg-red-100', text: 'text-red-700', label: 'Exception', icon: '⚠️' },
      'attempted_delivery': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Attempted', icon: '🔔' },
      'not_yet_in_system': { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Pending', icon: '⏳' },
    }

    const config = statusConfig[trackingStatus] || statusConfig['unknown']

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.icon} {config.label}
      </span>
    )
  }

  const fetchLabels = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (filterStatus !== 'all') {
        params.append('status', filterStatus)
      }

      const response = await fetch(`/api/labels?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch labels')
      }

      const data = await response.json()
      setLabels(data.data.labels)
      setLastRefreshTime(Date.now()) // Update last refresh time
    } catch (err) {
      console.error('Error fetching labels:', err)
      setError(err instanceof Error ? err.message : 'Failed to load labels')
    } finally {
      setLoading(false)
    }
  }

  const handleReprintLabel = (label: ShippingLabel) => {
    window.open(label.labelUrl, '_blank')
  }

  const handleVoidLabel = async (label: ShippingLabel) => {
    if (!confirm(`Are you sure you want to void this label?\n\nTracking: ${label.trackingNumber}\nCarrier: ${label.carrier}\n\nThis action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch('/api/shipstation/labels/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelId: label.providerLabelId || label.id }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to void label')
      }

      const data = await response.json()

      if (data.success) {
        alert(`Label voided successfully!\n\n${data.data.message || 'The label has been voided.'}`)
        // Refresh the labels list
        fetchLabels()
      } else {
        throw new Error(data.data?.message || 'Failed to void label')
      }
    } catch (error: any) {
      alert(`Error voiding label: ${error.message}`)
      console.error('Void label error:', error)
    }
  }

  const filteredLabels = labels.filter(label => {
    // Filter by carrier
    if (filterCarrier !== 'all' && label.carrier !== filterCarrier) {
      return false
    }

    // Filter by search term
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      label.trackingNumber.toLowerCase().includes(term) ||
      label.carrier.toLowerCase().includes(term) ||
      (label.paceShipmentId && label.paceShipmentId.toString().includes(term)) ||
      (label.shipTo?.city && label.shipTo.city.toLowerCase().includes(term)) ||
      (label.shipTo?.state && label.shipTo.state.toLowerCase().includes(term)) ||
      'manual'.includes(term) // Allow searching for "manual" labels
    )
  })

  if (loading) {
    return (
      <div className="w-full p-6">
        <div className="text-center py-12 text-gray-500">
          Loading shipping labels...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipment Track</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track and manage all shipping labels
          </p>
        </div>
        <button
          onClick={fetchLabels}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          title="Refresh tracking data"
        >
          <svg
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
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
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Tracking #, carrier, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="voided">Voided</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {/* Carrier Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Carrier
            </label>
            <select
              value={filterCarrier}
              onChange={(e) => setFilterCarrier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Carriers</option>
              {uniqueCarriers.map((carrier) => (
                <option key={carrier} value={carrier}>
                  {carrier}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-600">Total Labels</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {filteredLabels.length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-600">Total Cost</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            ${filteredLabels.reduce((sum, label) => sum + Number(label.cost), 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Labels Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shipment
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tracking
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Carrier/Service
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Destination
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  References
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tracking
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLabels.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                    No shipping labels found
                  </td>
                </tr>
              ) : (
                filteredLabels.map((label) => (
                  <tr key={label.id} className={`hover:bg-gray-50 ${label.isReturnLabel ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {label.isReturnLabel ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            🔄 Return
                          </span>
                          {label.rmaNumber && (
                            <span className="text-xs text-amber-600 font-mono">
                              {label.rmaNumber}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          📦 Outbound
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {label.paceShipmentId ? (
                        <>
                          <button
                            onClick={() => router.push(`/shipments/${label.paceShipmentId}`)}
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                          >
                            #{label.paceShipmentId}
                          </button>
                          {label.paceCartonId && (
                            <div className="text-xs text-gray-500">
                              Carton #{label.paceCartonId}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            ✍️ Manual
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-mono text-gray-900">
                        {label.trackingNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCarrierName(label.carrier)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {label.service}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {label.shipTo && (
                        <div className="text-sm max-w-xs">
                          <div className="font-medium text-gray-900">
                            {label.shipTo.name || label.shipTo.company_name}
                          </div>
                          {label.shipTo.street1 && (
                            <div className="text-xs text-gray-600">
                              {label.shipTo.street1}
                            </div>
                          )}
                          {label.shipTo.street2 && (
                            <div className="text-xs text-gray-600">
                              {label.shipTo.street2}
                            </div>
                          )}
                          {(label.shipTo.city_locality || label.shipTo.city || label.shipTo.state_province || label.shipTo.state || label.shipTo.postal_code || label.shipTo.zip) && (
                            <div className="text-xs text-gray-500">
                              {[
                                label.shipTo.city_locality || label.shipTo.city,
                                label.shipTo.state_province || label.shipTo.state,
                                label.shipTo.postal_code || label.shipTo.zip
                              ].filter(Boolean).join(', ')}
                            </div>
                          )}
                          {(label.shipTo.country_code || label.shipTo.country) && (
                            <div className="text-xs text-gray-500">
                              {label.shipTo.country_code || label.shipTo.country}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs space-y-0.5">
                        {label.metadata?.reference1 && (
                          <div className="text-gray-700">
                            <span className="font-medium">1:</span> {label.metadata.reference1}
                          </div>
                        )}
                        {label.metadata?.reference2 && (
                          <div className="text-gray-700">
                            <span className="font-medium">2:</span> {label.metadata.reference2}
                          </div>
                        )}
                        {label.metadata?.reference3 && (
                          <div className="text-gray-700">
                            <span className="font-medium">3:</span> {label.metadata.reference3}
                          </div>
                        )}
                        {!label.metadata?.reference1 && !label.metadata?.reference2 && !label.metadata?.reference3 && (
                          <div className="text-gray-400">—</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-green-600">
                        ${Number(label.cost).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        label.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : label.status === 'voided'
                          ? 'bg-gray-100 text-gray-700'
                          : label.status === 'delivered'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {label.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-1">
                        {getTrackingStatusBadge(label.trackingStatus, label.status)}
                        {label.metadata?.tracking?.last_event && (
                          <div className="text-xs text-gray-500 text-center">
                            {label.metadata.tracking.last_event.description}
                            {label.metadata.tracking.last_event.city_locality && label.metadata.tracking.last_event.state_province && (
                              <div className="text-xs text-gray-400">
                                {label.metadata.tracking.last_event.city_locality}, {label.metadata.tracking.last_event.state_province}
                              </div>
                            )}
                          </div>
                        )}
                        {label.lastTrackedAt && (
                          <div className="text-xs text-gray-400">
                            {new Date(label.lastTrackedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {new Date(label.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleReprintLabel(label)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                          title="Reprint label"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          Print
                        </button>
                        {label.status === 'active' && !label.paceShipmentId && (
                          <button
                            onClick={() => handleVoidLabel(label)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 text-sm font-medium"
                            title="Void label"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Void
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
