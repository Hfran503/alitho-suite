'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type AddOnApplyTo = 'INDIVIDUAL_ONLY' | 'BULK_ONLY' | 'BOTH'

interface AddOnItem {
  id: string
  sku: string
  name: string
  description: string | null
  sellPrice: number | null
  canOrderInBulk: boolean
  bulkUnitName: string | null
  unitsPerBulk: number | null
  bulkSellPrice: number | null
  isActive: boolean
}

interface ItemAddOn {
  id: string
  parentItemId: string
  addOnItemId: string
  applyTo: AddOnApplyTo
  quantity: number
  bulkQuantity: number | null
  sortOrder: number
  notes: string | null
  addOnItem: AddOnItem
}

interface ItemAddOnsManagerProps {
  itemId: string
  canOrderInBulk: boolean
}

export function ItemAddOnsManager({ itemId, canOrderInBulk }: ItemAddOnsManagerProps) {
  const [addOns, setAddOns] = useState<ItemAddOn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<AddOnItem[]>([])
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddPanel, setShowAddPanel] = useState(false)

  // New add-on form state
  const [newAddOn, setNewAddOn] = useState<{
    addOnItemId: string
    applyTo: AddOnApplyTo
    quantity: number
    bulkQuantity: number | null
    notes: string
  }>({
    addOnItemId: '',
    applyTo: 'BOTH',
    quantity: 1,
    bulkQuantity: null,
    notes: '',
  })

  const [saving, setSaving] = useState(false)

  // Fetch existing add-ons
  useEffect(() => {
    async function fetchAddOns() {
      try {
        const response = await fetch(`/api/warehouse/items/${itemId}/addons`)
        if (!response.ok) {
          throw new Error('Failed to fetch add-ons')
        }
        const data = await response.json()
        setAddOns(data.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchAddOns()
  }, [itemId])

  // Search for items to add as add-ons
  const searchItems = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const response = await fetch(`/api/warehouse/items?search=${encodeURIComponent(query)}&limit=10`)
      if (!response.ok) {
        throw new Error('Failed to search items')
      }
      const data = await response.json()
      // Filter out the current item and items already added as add-ons
      const existingIds = new Set([itemId, ...addOns.map(a => a.addOnItemId)])
      setSearchResults(data.data.filter((item: AddOnItem) => !existingIds.has(item.id)))
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setSearching(false)
    }
  }

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchItems(searchQuery)
      } else {
        setSearchResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Add a new add-on
  const handleAddAddOn = async () => {
    if (!newAddOn.addOnItemId) return

    setSaving(true)
    try {
      const response = await fetch(`/api/warehouse/items/${itemId}/addons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addOnItemId: newAddOn.addOnItemId,
          applyTo: newAddOn.applyTo,
          quantity: newAddOn.quantity,
          bulkQuantity: newAddOn.bulkQuantity,
          notes: newAddOn.notes || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add add-on')
      }

      const data = await response.json()
      setAddOns(prev => [...prev, data.data])
      setNewAddOn({
        addOnItemId: '',
        applyTo: 'BOTH',
        quantity: 1,
        bulkQuantity: null,
        notes: '',
      })
      setSearchQuery('')
      setSearchResults([])
      setShowAddPanel(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  // Update an add-on
  const handleUpdateAddOn = async (addOnId: string, updates: Partial<ItemAddOn>) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/warehouse/items/${itemId}/addons`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addOnId,
          ...updates,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update add-on')
      }

      const data = await response.json()
      setAddOns(prev => prev.map(a => a.id === addOnId ? data.data : a))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  // Remove an add-on
  const handleRemoveAddOn = async (addOnId: string) => {
    if (!confirm('Remove this add-on?')) return

    setSaving(true)
    try {
      const response = await fetch(`/api/warehouse/items/${itemId}/addons`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addOnId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove add-on')
      }

      setAddOns(prev => prev.filter(a => a.id !== addOnId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const getApplyToLabel = (applyTo: AddOnApplyTo) => {
    switch (applyTo) {
      case 'INDIVIDUAL_ONLY': return 'Individual Orders Only'
      case 'BULK_ONLY': return 'Bulk Orders Only'
      case 'BOTH': return 'Both Individual & Bulk'
    }
  }

  const getApplyToBadgeColor = (applyTo: AddOnApplyTo) => {
    switch (applyTo) {
      case 'INDIVIDUAL_ONLY': return 'bg-blue-100 text-blue-800'
      case 'BULK_ONLY': return 'bg-purple-100 text-purple-800'
      case 'BOTH': return 'bg-green-100 text-green-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading add-ons...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Existing Add-ons List */}
      {addOns.length > 0 ? (
        <div className="space-y-3">
          {addOns.map((addOn) => (
            <div key={addOn.id} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-gray-600">{addOn.addOnItem.sku}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getApplyToBadgeColor(addOn.applyTo)}`}>
                      {getApplyToLabel(addOn.applyTo)}
                    </span>
                  </div>
                  <p className="font-medium mt-1">{addOn.addOnItem.name}</p>
                  {addOn.addOnItem.description && (
                    <p className="text-sm text-gray-500 truncate">{addOn.addOnItem.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm">
                      <span className="text-gray-500">Qty:</span>{' '}
                      <span className="font-medium">{addOn.quantity}</span>
                      {addOn.applyTo !== 'INDIVIDUAL_ONLY' && ' per unit'}
                    </p>
                    {addOn.bulkQuantity && addOn.applyTo !== 'INDIVIDUAL_ONLY' && (
                      <p className="text-sm">
                        <span className="text-gray-500">Bulk Qty:</span>{' '}
                        <span className="font-medium">{addOn.bulkQuantity}</span>
                        {' per bulk order'}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={addOn.applyTo}
                      onValueChange={(v) => handleUpdateAddOn(addOn.id, { applyTo: v as AddOnApplyTo })}
                      disabled={saving}
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BOTH">Both</SelectItem>
                        <SelectItem value="INDIVIDUAL_ONLY">Individual Only</SelectItem>
                        {canOrderInBulk && <SelectItem value="BULK_ONLY">Bulk Only</SelectItem>}
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      min="1"
                      value={addOn.quantity}
                      onChange={(e) => handleUpdateAddOn(addOn.id, { quantity: parseInt(e.target.value) || 1 })}
                      className="w-16 h-8 text-center"
                      disabled={saving}
                    />

                    <button
                      onClick={() => handleRemoveAddOn(addOn.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      disabled={saving}
                      title="Remove add-on"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {addOn.notes && (
                <p className="text-sm text-gray-500 mt-2 pt-2 border-t">{addOn.notes}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed">
          <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-gray-500 mt-2">No add-ons configured</p>
          <p className="text-sm text-gray-400">Add-ons are bundled items automatically included with orders</p>
        </div>
      )}

      {/* Add New Add-on Panel */}
      {showAddPanel ? (
        <div className="border rounded-lg p-4 bg-emerald-50 border-emerald-200">
          <h4 className="font-medium text-emerald-800 mb-3">Add New Add-on</h4>

          <div className="space-y-4">
            {/* Item Search */}
            <div>
              <Label>Search Item</Label>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by SKU or name..."
                autoFocus
              />

              {/* Search Results */}
              {searching && (
                <p className="text-sm text-gray-500 mt-2">Searching...</p>
              )}
              {searchResults.length > 0 && (
                <div className="mt-2 border rounded-lg bg-white max-h-48 overflow-auto">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setNewAddOn(prev => ({ ...prev, addOnItemId: item.id }))
                        setSearchQuery(`${item.sku} - ${item.name}`)
                        setSearchResults([])
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 border-b last:border-b-0 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono text-sm text-gray-600">{item.sku}</span>
                        <span className="ml-2">{item.name}</span>
                      </div>
                      {item.sellPrice && (
                        <span className="text-sm text-gray-500">${Number(item.sellPrice).toFixed(2)}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Apply To</Label>
                <Select
                  value={newAddOn.applyTo}
                  onValueChange={(v) => setNewAddOn(prev => ({ ...prev, applyTo: v as AddOnApplyTo }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BOTH">Both Individual & Bulk</SelectItem>
                    <SelectItem value="INDIVIDUAL_ONLY">Individual Orders Only</SelectItem>
                    {canOrderInBulk && <SelectItem value="BULK_ONLY">Bulk Orders Only</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantity (per unit)</Label>
                <Input
                  type="number"
                  min="1"
                  value={newAddOn.quantity}
                  onChange={(e) => setNewAddOn(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                />
              </div>

              {canOrderInBulk && newAddOn.applyTo !== 'INDIVIDUAL_ONLY' && (
                <div>
                  <Label>Bulk Quantity (optional)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newAddOn.bulkQuantity || ''}
                    onChange={(e) => setNewAddOn(prev => ({ ...prev, bulkQuantity: e.target.value ? parseInt(e.target.value) : null }))}
                    placeholder="Same as qty"
                  />
                  <p className="text-xs text-gray-500 mt-1">Override quantity for bulk orders</p>
                </div>
              )}

              <div className={canOrderInBulk && newAddOn.applyTo !== 'INDIVIDUAL_ONLY' ? '' : 'col-span-2'}>
                <Label>Notes (optional)</Label>
                <Input
                  value={newAddOn.notes}
                  onChange={(e) => setNewAddOn(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Assembly notes..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddPanel(false)
                  setSearchQuery('')
                  setSearchResults([])
                  setNewAddOn({
                    addOnItemId: '',
                    applyTo: 'BOTH',
                    quantity: 1,
                    bulkQuantity: null,
                    notes: '',
                  })
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleAddAddOn}
                disabled={!newAddOn.addOnItemId || saving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? 'Adding...' : 'Add Add-on'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAddPanel(true)}
          className="w-full border-dashed"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Add-on Item
        </Button>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        <strong>How Add-ons Work:</strong>
        <ul className="list-disc ml-5 mt-1 space-y-1">
          <li><strong>Individual Only:</strong> Add-on is included only when ordering individual units</li>
          <li><strong>Bulk Only:</strong> Add-on is included only when ordering in bulk (cases, etc.)</li>
          <li><strong>Both:</strong> Add-on is included in all orders, with optional quantity override for bulk</li>
        </ul>
      </div>
    </div>
  )
}
