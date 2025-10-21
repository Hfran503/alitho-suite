'use client'

import { useState, useEffect } from 'react'

interface ShipmentTypeMapping {
  id: string
  plannedTypeId: number
  plannedTypeName: string
  completedTypeId: number
  completedTypeName: string
}

interface CarrierServiceMapping {
  id: string
  shipstationCarrierId: string
  shipstationCarrierCode: string
  shipstationServiceCode: string
  carrierName: string
  serviceName: string
  paceShipViaId: number
  paceShipViaName: string
}

export function ShipmentTypesSettings() {
  // Shipment Type Mappings state
  const [mappings, setMappings] = useState<ShipmentTypeMapping[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMapping, setNewMapping] = useState({
    plannedTypeId: '',
    plannedTypeName: '',
    completedTypeId: '',
    completedTypeName: '',
  })

  // Carrier Service Mappings state
  const [carrierMappings, setCarrierMappings] = useState<CarrierServiceMapping[]>([])
  const [showAddCarrierForm, setShowAddCarrierForm] = useState(false)
  const [newCarrierMapping, setNewCarrierMapping] = useState({
    shipstationCarrierId: '',
    shipstationCarrierCode: '',
    shipstationServiceCode: '',
    carrierName: '',
    serviceName: '',
    paceShipViaId: '',
    paceShipViaName: '',
  })
  const [availableCarriers, setAvailableCarriers] = useState<Array<{ id: string; name: string }>>([])

  // Common state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      // Load existing shipment type mappings
      const mappingsRes = await fetch('/api/settings/shipment-types')
      if (!mappingsRes.ok) throw new Error('Failed to load shipment type mappings')
      const mappingsData = await mappingsRes.json()
      setMappings(mappingsData.data || [])

      // Load existing carrier service mappings
      const carrierMappingsRes = await fetch('/api/settings/carrier-services')
      if (!carrierMappingsRes.ok) throw new Error('Failed to load carrier service mappings')
      const carrierMappingsData = await carrierMappingsRes.json()
      setCarrierMappings(carrierMappingsData.data || [])

      // Load available ShipStation carriers
      const carriersRes = await fetch('/api/integrations/shipstation/carriers')
      if (carriersRes.ok) {
        const carriersData = await carriersRes.json()
        setAvailableCarriers(carriersData.data || [])
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }


  const handleAddMapping = async () => {
    if (
      !newMapping.plannedTypeId ||
      !newMapping.plannedTypeName ||
      !newMapping.completedTypeId ||
      !newMapping.completedTypeName
    ) {
      setError('All fields are required')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const res = await fetch('/api/settings/shipment-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plannedTypeId: parseInt(newMapping.plannedTypeId),
          plannedTypeName: newMapping.plannedTypeName,
          completedTypeId: parseInt(newMapping.completedTypeId),
          completedTypeName: newMapping.completedTypeName,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create mapping')
      }

      setSuccess('Mapping added successfully')
      setNewMapping({
        plannedTypeId: '',
        plannedTypeName: '',
        completedTypeId: '',
        completedTypeName: '',
      })
      setShowAddForm(false)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteMapping = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const res = await fetch(`/api/settings/shipment-types/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete mapping')
      }

      setSuccess('Mapping deleted successfully')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddCarrierMapping = async () => {
    if (
      !newCarrierMapping.shipstationCarrierId ||
      !newCarrierMapping.shipstationCarrierCode ||
      !newCarrierMapping.shipstationServiceCode ||
      !newCarrierMapping.carrierName ||
      !newCarrierMapping.serviceName ||
      !newCarrierMapping.paceShipViaId ||
      !newCarrierMapping.paceShipViaName
    ) {
      setError('All fields are required')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const res = await fetch('/api/settings/carrier-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCarrierMapping),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create carrier service mapping')
      }

      setSuccess('Carrier service mapping added successfully')
      setNewCarrierMapping({
        shipstationCarrierId: '',
        shipstationCarrierCode: '',
        shipstationServiceCode: '',
        carrierName: '',
        serviceName: '',
        paceShipViaId: '',
        paceShipViaName: '',
      })
      setShowAddCarrierForm(false)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCarrierMapping = async (id: string) => {
    if (!confirm('Are you sure you want to delete this carrier service mapping?')) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const res = await fetch(`/api/settings/carrier-services/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete carrier service mapping')
      }

      setSuccess('Carrier service mapping deleted successfully')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Section 1: Shipment Type Mappings */}
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Shipment Type Mappings</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure how shipment types change when processing labels. Each planned type will automatically change to
            its completed counterpart when labels are created, and vice versa when labels are cancelled.
          </p>
        </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
          {success}
        </div>
      )}

      {/* Existing Mappings */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Planned Type
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">→</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Completed Type
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {mappings.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No shipment type mappings configured yet. Add your first mapping below.
                </td>
              </tr>
            ) : (
              mappings.map((mapping) => (
                <tr key={mapping.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{mapping.plannedTypeName}</div>
                    <div className="text-xs text-gray-500">ID: {mapping.plannedTypeId}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-gray-400">→</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{mapping.completedTypeName}</div>
                    <div className="text-xs text-gray-500">ID: {mapping.completedTypeId}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDeleteMapping(mapping.id)}
                      disabled={saving}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add New Mapping */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          + Add Mapping
        </button>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4">
          <h3 className="text-sm font-medium text-gray-900">Add New Mapping</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Planned Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planned Type ID</label>
              <input
                type="number"
                value={newMapping.plannedTypeId}
                onChange={(e) => setNewMapping({ ...newMapping, plannedTypeId: e.target.value })}
                placeholder="e.g., 1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planned Type Name</label>
              <input
                type="text"
                value={newMapping.plannedTypeName}
                onChange={(e) => setNewMapping({ ...newMapping, plannedTypeName: e.target.value })}
                placeholder="e.g., UPS Ground - Planned"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Completed Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Completed Type ID</label>
              <input
                type="number"
                value={newMapping.completedTypeId}
                onChange={(e) => setNewMapping({ ...newMapping, completedTypeId: e.target.value })}
                placeholder="e.g., 2"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Completed Type Name</label>
              <input
                type="text"
                value={newMapping.completedTypeName}
                onChange={(e) => setNewMapping({ ...newMapping, completedTypeName: e.target.value })}
                placeholder="e.g., UPS Ground - Completed"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAddMapping}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Mapping'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setNewMapping({
                  plannedTypeId: '',
                  plannedTypeName: '',
                  completedTypeId: '',
                  completedTypeName: '',
                })
              }}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Section 2: Carrier Service Mappings */}
      <div className="space-y-6 pt-8 border-t border-gray-300">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Carrier Service Mappings</h2>
          <p className="text-sm text-gray-600 mt-1">
            Map ShipStation carrier services to PACE Ship Via IDs. This ensures shipments created through batch import
            use the correct shipping method in PACE.
          </p>
        </div>

        {/* Carrier Mappings Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ShipStation Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Carrier/Service Codes
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">→</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PACE Ship Via
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {carrierMappings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No carrier service mappings configured yet. Add your first mapping below.
                  </td>
                </tr>
              ) : (
                carrierMappings.map((mapping) => (
                  <tr key={mapping.id}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{mapping.carrierName}</div>
                      <div className="text-xs text-gray-500">{mapping.serviceName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-mono text-gray-600">
                        <div>Carrier: {mapping.shipstationCarrierCode}</div>
                        <div>Service: {mapping.shipstationServiceCode}</div>
                        <div className="text-gray-400">ID: {mapping.shipstationCarrierId}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-gray-400">→</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{mapping.paceShipViaName}</div>
                      <div className="text-xs text-gray-500">ID: {mapping.paceShipViaId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDeleteCarrierMapping(mapping.id)}
                        disabled={saving}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add New Carrier Mapping */}
        {!showAddCarrierForm ? (
          <button
            onClick={() => setShowAddCarrierForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            + Add Carrier Mapping
          </button>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Add New Carrier Service Mapping</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ShipStation Carrier */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ShipStation Carrier
                </label>
                <select
                  value={newCarrierMapping.shipstationCarrierId}
                  onChange={(e) => {
                    const selectedCarrier = availableCarriers.find(c => c.id === e.target.value)
                    setNewCarrierMapping({
                      ...newCarrierMapping,
                      shipstationCarrierId: e.target.value,
                      shipstationCarrierCode: e.target.value.split('-')[0] || '',
                      carrierName: selectedCarrier?.name || e.target.value.split('-')[0] || '',
                    })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">Select a carrier...</option>
                  {availableCarriers.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name} ({carrier.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* ShipStation Service Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Code
                  <span className="ml-2 text-xs text-gray-500 font-normal">(shown in batch import step 3)</span>
                </label>
                <input
                  type="text"
                  value={newCarrierMapping.shipstationServiceCode}
                  onChange={(e) => {
                    setNewCarrierMapping({
                      ...newCarrierMapping,
                      shipstationServiceCode: e.target.value,
                      serviceName: e.target.value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                      paceShipViaName: `${newCarrierMapping.carrierName} ${e.target.value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
                    })
                  }}
                  placeholder="e.g., fedex_ground"
                  disabled={!newCarrierMapping.shipstationCarrierId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* PACE Ship Via ID */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PACE Ship Via ID
                  <span className="ml-2 text-xs text-gray-500 font-normal">(from PACE ShipVia table)</span>
                </label>
                <input
                  type="number"
                  value={newCarrierMapping.paceShipViaId}
                  onChange={(e) => setNewCarrierMapping({
                    ...newCarrierMapping,
                    paceShipViaId: e.target.value,
                  })}
                  placeholder="e.g., 5007"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddCarrierMapping}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Mapping'}
              </button>
              <button
                onClick={() => {
                  setShowAddCarrierForm(false)
                  setNewCarrierMapping({
                    shipstationCarrierId: '',
                    shipstationCarrierCode: '',
                    shipstationServiceCode: '',
                    carrierName: '',
                    serviceName: '',
                    paceShipViaId: '',
                    paceShipViaName: '',
                  })
                }}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
