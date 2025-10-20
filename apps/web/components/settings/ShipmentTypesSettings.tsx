'use client'

import { useState, useEffect } from 'react'

interface ShipmentTypeMapping {
  id: string
  plannedTypeId: number
  plannedTypeName: string
  completedTypeId: number
  completedTypeName: string
}

interface ShipmentType {
  id: number
  name: string
}

export function ShipmentTypesSettings() {
  const [mappings, setMappings] = useState<ShipmentTypeMapping[]>([])
  const [_shipmentTypes, setShipmentTypes] = useState<ShipmentType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state for new mapping
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMapping, setNewMapping] = useState({
    plannedTypeId: '',
    plannedTypeName: '',
    completedTypeId: '',
    completedTypeName: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      // Load existing mappings
      const mappingsRes = await fetch('/api/settings/shipment-types')
      if (!mappingsRes.ok) throw new Error('Failed to load shipment type mappings')
      const mappingsData = await mappingsRes.json()
      setMappings(mappingsData.data || [])

      // Load available shipment types from PACE
      const typesRes = await fetch('/api/pace/shipment-types')
      if (typesRes.ok) {
        const typesData = await typesRes.json()
        setShipmentTypes(typesData.data || [])
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
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
  )
}
