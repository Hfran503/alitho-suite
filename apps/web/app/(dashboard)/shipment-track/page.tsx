'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ShippingLabel {
  id: string
  paceShipmentId: number
  paceCartonId: number | null
  provider: string
  trackingNumber: string
  labelUrl: string
  carrier: string
  service: string
  cost: number
  currency: string
  status: string
  createdAt: string
  shipTo: any
  isReturnLabel: boolean
  rmaNumber: string | null
  outboundLabelId: string | null
}

export default function LabelsPage() {
  const router = useRouter()
  const [labels, setLabels] = useState<ShippingLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('active') // Default to active only
  const [filterProvider, setFilterProvider] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchLabels()
  }, [filterStatus, filterProvider])

  // Auto-refresh when window regains focus (e.g., after voiding labels in another tab/page)
  useEffect(() => {
    const handleFocus = () => {
      console.log('Window focused, refreshing labels...')
      fetchLabels()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [filterStatus, filterProvider])

  const fetchLabels = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (filterStatus !== 'all') {
        params.append('status', filterStatus)
      }

      if (filterProvider !== 'all') {
        params.append('provider', filterProvider)
      }

      const response = await fetch(`/api/labels?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch labels')
      }

      const data = await response.json()
      setLabels(data.data.labels)
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

  const filteredLabels = labels.filter(label => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      label.trackingNumber.toLowerCase().includes(term) ||
      label.carrier.toLowerCase().includes(term) ||
      label.paceShipmentId.toString().includes(term) ||
      (label.shipTo?.city && label.shipTo.city.toLowerCase().includes(term)) ||
      (label.shipTo?.state && label.shipTo.state.toLowerCase().includes(term))
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shipment Track</h1>
        <p className="text-sm text-gray-600 mt-1">
          Track and manage all shipping labels
        </p>
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

          {/* Provider Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Provider
            </label>
            <select
              value={filterProvider}
              onChange={(e) => setFilterProvider(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Providers</option>
              <option value="easypost">EasyPost</option>
              <option value="shipstation">ShipStation</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-600">EasyPost</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {filteredLabels.filter(l => l.provider === 'easypost').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-600">ShipStation</div>
          <div className="text-2xl font-bold text-purple-600 mt-1">
            {filteredLabels.filter(l => l.provider === 'shipstation').length}
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
                  Provider
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
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
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
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
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-mono text-gray-900">
                        {label.trackingNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {label.carrier}
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
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        label.provider === 'easypost'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {label.provider === 'easypost' ? 'EasyPost' : 'ShipStation'}
                      </span>
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
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {label.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {new Date(label.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleReprintLabel(label)}
                        className="inline-flex items-center gap-1 text-green-600 hover:text-green-800 text-sm font-medium"
                        title="Reprint label"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print
                      </button>
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
