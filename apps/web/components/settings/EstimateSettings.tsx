'use client'

import { useState, useEffect } from 'react'
import { Search, Trash2, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'

interface JobProductType {
  id: string
  description: string
}

interface InventoryItem {
  id: string
  description: string
  sizeWidth?: number
  sizeLength?: number
}

interface AllowedJobProductType {
  jobProductTypeId: string
  customName?: string
  customDescription?: string
  allowedInventoryItemIds: string[]
}

export function EstimateSettings() {
  const [allowedJobProductTypes, setAllowedJobProductTypes] = useState<AllowedJobProductType[]>([])
  const [allJobProductTypes, setAllJobProductTypes] = useState<JobProductType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadingJobTypes, setLoadingJobTypes] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedItems, setExpandedItems] = useState<{ [key: string]: boolean }>({})
  const [inventoryItemInput, setInventoryItemInput] = useState<{ [key: string]: string }>({})
  const [fetchingInventoryItem, setFetchingInventoryItem] = useState<{ [key: string]: boolean }>({})
  const [inventoryItemDetails, setInventoryItemDetails] = useState<{ [key: string]: InventoryItem }>({})

  useEffect(() => {
    loadSettings()
    loadJobProductTypes()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/settings/estimate-settings')
      const data = await res.json()

      if (data.estimateSettings?.allowedJobProductTypes) {
        setAllowedJobProductTypes(data.estimateSettings.allowedJobProductTypes)

        // Load details for all inventory items that are already linked
        const allInventoryItemIds = new Set<string>()
        data.estimateSettings.allowedJobProductTypes.forEach((jpt: AllowedJobProductType) => {
          jpt.allowedInventoryItemIds.forEach((itemId: string) => allInventoryItemIds.add(itemId))
        })

        // Fetch details for each inventory item
        const itemDetailsPromises = Array.from(allInventoryItemIds).map(async (itemId) => {
          try {
            const itemRes = await fetch(`/api/pace/inventory-items/${encodeURIComponent(itemId)}`)
            const itemData = await itemRes.json()
            if (itemRes.ok && itemData.data) {
              return { [itemId]: itemData.data }
            }
          } catch (error) {
            console.error(`Error loading inventory item ${itemId}:`, error)
          }
          return null
        })

        const itemDetailsArray = await Promise.all(itemDetailsPromises)
        const itemDetails = itemDetailsArray.reduce<{ [key: string]: InventoryItem }>((acc, item) => {
          if (item) return { ...acc, ...item }
          return acc
        }, {})

        setInventoryItemDetails(itemDetails)
      } else if (data.estimateSettings?.allowedJobProductTypeIds) {
        // Migrate old format to new format
        const migrated = data.estimateSettings.allowedJobProductTypeIds.map((id: string) => ({
          jobProductTypeId: id,
          allowedInventoryItemIds: []
        }))
        setAllowedJobProductTypes(migrated)
      }
    } catch (error) {
      console.error('Error loading estimate settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadJobProductTypes = async () => {
    try {
      setLoadingJobTypes(true)
      const res = await fetch('/api/pace/job-product-types')
      const data = await res.json()

      if (data.data?.items) {
        setAllJobProductTypes(data.data.items)
      }
    } catch (error) {
      console.error('Error loading job product types:', error)
    } finally {
      setLoadingJobTypes(false)
    }
  }

  const fetchInventoryItem = async (jobProductTypeId: string, itemId: string) => {
    if (!itemId.trim()) return

    try {
      setFetchingInventoryItem({ ...fetchingInventoryItem, [jobProductTypeId]: true })
      const res = await fetch(`/api/pace/inventory-items/${encodeURIComponent(itemId)}`)
      const data = await res.json()

      if (res.ok && data.data) {
        // Store the item details
        setInventoryItemDetails({
          ...inventoryItemDetails,
          [itemId]: data.data
        })

        // Add to allowed list if not already there
        const jpt = allowedJobProductTypes.find(j => j.jobProductTypeId === jobProductTypeId)
        if (jpt && !jpt.allowedInventoryItemIds.includes(itemId)) {
          updateJobProductType(jobProductTypeId, {
            allowedInventoryItemIds: [...jpt.allowedInventoryItemIds, itemId]
          })
        }

        // Clear input
        setInventoryItemInput({ ...inventoryItemInput, [jobProductTypeId]: '' })
      } else {
        alert(`Inventory item "${itemId}" not found in PACE`)
      }
    } catch (error) {
      console.error('Error fetching inventory item:', error)
      alert('Failed to fetch inventory item')
    } finally {
      setFetchingInventoryItem({ ...fetchingInventoryItem, [jobProductTypeId]: false })
    }
  }

  const removeInventoryItem = (jobProductTypeId: string, itemId: string) => {
    const jpt = allowedJobProductTypes.find(j => j.jobProductTypeId === jobProductTypeId)
    if (jpt) {
      updateJobProductType(jobProductTypeId, {
        allowedInventoryItemIds: jpt.allowedInventoryItemIds.filter(id => id !== itemId)
      })
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/settings/estimate-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedJobProductTypes })
      })

      if (res.ok) {
        setHasChanges(false)
        alert('Estimate settings saved successfully!')
      } else {
        alert('Failed to save estimate settings')
      }
    } catch (error) {
      console.error('Error saving estimate settings:', error)
      alert('Failed to save estimate settings')
    } finally {
      setSaving(false)
    }
  }

  const addJobProductType = (id: string) => {
    if (!allowedJobProductTypes.find(jpt => jpt.jobProductTypeId === id)) {
      setAllowedJobProductTypes([...allowedJobProductTypes, {
        jobProductTypeId: id,
        allowedInventoryItemIds: []
      }])
      setHasChanges(true)
    }
  }

  const removeJobProductType = (id: string) => {
    setAllowedJobProductTypes(allowedJobProductTypes.filter(jpt => jpt.jobProductTypeId !== id))
    setHasChanges(true)
  }

  const updateJobProductType = (id: string, updates: Partial<AllowedJobProductType>) => {
    setAllowedJobProductTypes(allowedJobProductTypes.map(jpt =>
      jpt.jobProductTypeId === id ? { ...jpt, ...updates } : jpt
    ))
    setHasChanges(true)
  }

  const toggleExpanded = (id: string) => {
    setExpandedItems({ ...expandedItems, [id]: !expandedItems[id] })
  }

  const getJobProductTypeName = (id: string) => {
    const jpt = allJobProductTypes.find(j => j.id === id)
    return jpt?.description || id
  }

  const getInventoryItemDisplay = (itemId: string) => {
    const item = inventoryItemDetails[itemId]
    if (!item) return itemId

    let display = `${item.id} - ${item.description}`
    if (item.sizeWidth && item.sizeLength) {
      display += ` (${item.sizeWidth} × ${item.sizeLength})`
    }
    return display
  }

  // Filter available job product types (not already added)
  const availableJobProductTypes = allJobProductTypes.filter(jpt =>
    !allowedJobProductTypes.find(a => a.jobProductTypeId === jpt.id) &&
    (searchTerm === '' ||
     jpt.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (jpt.description && jpt.description.toLowerCase().includes(searchTerm.toLowerCase())))
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading estimate settings...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Estimate Settings</h3>
            <p className="mt-1 text-sm text-gray-500">
              Configure Job Product Types with custom names and linked inventory items
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Configured Job Product Types */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Configured Product Types</h4>
                <p className="text-xs text-gray-500 mt-1">
                  {allowedJobProductTypes.length === 0
                    ? 'All types will be shown if none are selected'
                    : `${allowedJobProductTypes.length} type(s) configured`}
                </p>
              </div>
            </div>
          </div>
          <div className="p-6">
            {allowedJobProductTypes.length === 0 ? (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-sm">No Job Product Types configured</p>
                <p className="text-xs mt-1">Add types from the available list</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[700px] overflow-y-auto">
                {allowedJobProductTypes.map((jpt) => {
                  const isExpanded = expandedItems[jpt.jobProductTypeId]
                  const originalName = getJobProductTypeName(jpt.jobProductTypeId)
                  const displayName = jpt.customName || originalName

                  return (
                    <div
                      key={jpt.jobProductTypeId}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      {/* Header */}
                      <div className="p-4 bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{displayName}</p>
                                {jpt.customDescription && (
                                  <p className="text-xs text-gray-600 mt-1">{jpt.customDescription}</p>
                                )}
                                <p className="text-xs text-gray-500">ID: {jpt.jobProductTypeId}</p>
                                {jpt.allowedInventoryItemIds.length > 0 && (
                                  <p className="text-xs text-blue-600 mt-1">
                                    {jpt.allowedInventoryItemIds.length} inventory item(s) linked
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => toggleExpanded(jpt.jobProductTypeId)}
                              className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                              title={isExpanded ? "Collapse" : "Expand"}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => removeJobProductType(jpt.jobProductTypeId)}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="p-4 space-y-4 bg-white">
                          {/* Custom Name */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Custom Display Name
                            </label>
                            <input
                              type="text"
                              value={jpt.customName || ''}
                              onChange={(e) => updateJobProductType(jpt.jobProductTypeId, { customName: e.target.value })}
                              placeholder={originalName}
                              className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Leave blank to use default: {originalName}</p>
                          </div>

                          {/* Custom Description */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Custom Description
                            </label>
                            <textarea
                              value={jpt.customDescription || ''}
                              onChange={(e) => updateJobProductType(jpt.jobProductTypeId, { customDescription: e.target.value })}
                              placeholder="Add a description to help users understand when to use this product type"
                              rows={2}
                              className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>

                          {/* Linked Inventory Items */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-2">
                              Linked Inventory Items ({jpt.allowedInventoryItemIds.length} linked)
                            </label>

                            {/* Add Inventory Item by ID */}
                            <div className="mb-3">
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={inventoryItemInput[jpt.jobProductTypeId] || ''}
                                  onChange={(e) => setInventoryItemInput({ ...inventoryItemInput, [jpt.jobProductTypeId]: e.target.value })}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      fetchInventoryItem(jpt.jobProductTypeId, inventoryItemInput[jpt.jobProductTypeId] || '')
                                    }
                                  }}
                                  placeholder="Enter Inventory Item ID (e.g., 1003)"
                                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                  disabled={fetchingInventoryItem[jpt.jobProductTypeId]}
                                />
                                <button
                                  onClick={() => fetchInventoryItem(jpt.jobProductTypeId, inventoryItemInput[jpt.jobProductTypeId] || '')}
                                  disabled={!inventoryItemInput[jpt.jobProductTypeId]?.trim() || fetchingInventoryItem[jpt.jobProductTypeId]}
                                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {fetchingInventoryItem[jpt.jobProductTypeId] ? 'Adding...' : 'Add'}
                                </button>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                Enter the Inventory Item ID and click Add or press Enter
                              </p>
                            </div>

                            {/* List of Added Inventory Items */}
                            {jpt.allowedInventoryItemIds.length > 0 ? (
                              <div className="border border-gray-200 rounded-md divide-y divide-gray-200 max-h-48 overflow-y-auto">
                                {jpt.allowedInventoryItemIds.map((itemId) => (
                                  <div
                                    key={itemId}
                                    className="flex items-center justify-between p-3 hover:bg-gray-50"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">
                                        {getInventoryItemDisplay(itemId)}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => removeInventoryItem(jpt.jobProductTypeId, itemId)}
                                      className="ml-3 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                      title="Remove"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center">
                                <p className="text-xs text-gray-500">
                                  No inventory items linked yet. Add IDs above to restrict which items can be used with this product type.
                                </p>
                              </div>
                            )}

                            <p className="text-xs text-gray-500 mt-2">
                              Link specific inventory items to this product type. Leave empty to allow all items.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Available Job Product Types */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="text-sm font-medium text-gray-900">Available Job Product Types</h4>
            <p className="text-xs text-gray-500 mt-1">
              Click to add to configured list
            </p>

            {/* Search Box */}
            <div className="mt-3 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by ID or description..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
          <div className="p-6">
            {loadingJobTypes ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm">Loading Job Product Types...</p>
              </div>
            ) : availableJobProductTypes.length === 0 ? (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-sm">
                  {searchTerm ? 'No matching Job Product Types found' : 'All Job Product Types have been added'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[700px] overflow-y-auto">
                {availableJobProductTypes.map((jpt) => (
                  <button
                    key={jpt.id}
                    onClick={() => addJobProductType(jpt.id)}
                    className="w-full flex items-start gap-3 p-3 text-left bg-gray-50 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{jpt.description || jpt.id}</p>
                      <p className="text-xs text-gray-500">ID: {jpt.id}</p>
                    </div>
                    <svg
                      className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">How it works</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>Configure Job Product Types with custom names and descriptions for better clarity</li>
                <li>Link specific inventory items to each product type to streamline the estimate creation process</li>
                <li>When creating an estimate, only the linked inventory items will be available for each product type</li>
                <li>If no inventory items are linked, all inventory items will be available</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
