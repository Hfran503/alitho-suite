'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'

interface ComponentItem {
  id: string
  itemCode: string | null
  sku: string | null
  name: string
  description: string | null
  isActive: boolean
}

interface KitComponent {
  id: string
  kitId: string
  componentId: string
  quantity: number
  sortOrder: number
  notes: string | null
  component: ComponentItem
}

interface KitComponentsManagerProps {
  itemId: string
}

export function KitComponentsManager({ itemId }: KitComponentsManagerProps) {
  const [components, setComponents] = useState<KitComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<ComponentItem[]>([])
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [saving, setSaving] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch existing components
  useEffect(() => {
    async function fetchComponents() {
      try {
        const response = await fetch(`/api/warehouse/items/${itemId}/components`)
        if (!response.ok) {
          throw new Error('Failed to fetch components')
        }
        const data = await response.json()
        setComponents(data.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchComponents()
  }, [itemId])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchItems(searchQuery)
      } else {
        setSearchResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, components])

  // Search for items to add as components
  const searchItems = async (query: string) => {
    setSearching(true)
    try {
      const response = await fetch(`/api/warehouse/items?search=${encodeURIComponent(query)}&limit=10`)
      if (!response.ok) {
        throw new Error('Failed to search items')
      }
      const data = await response.json()
      // Filter out the current kit and items already added as components
      const existingIds = new Set([itemId, ...components.map(c => c.componentId)])
      setSearchResults(data.data.filter((item: ComponentItem) => !existingIds.has(item.id)))
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setSearching(false)
    }
  }

  // Quick add component with quantity 1
  const handleQuickAdd = async (item: ComponentItem) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/warehouse/items/${itemId}/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentId: item.id,
          quantity: 1,
          notes: null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add component')
      }

      const data = await response.json()
      setComponents(prev => [...prev, data.data])
      setSearchQuery('')
      setSearchResults([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  // Update component quantity
  const handleUpdateQuantity = async (kitComponentId: string, quantity: number) => {
    if (quantity < 1) return

    setSaving(true)
    try {
      const response = await fetch(`/api/warehouse/items/${itemId}/components`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kitComponentId,
          quantity,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update component')
      }

      const data = await response.json()
      setComponents(prev => prev.map(c => c.id === kitComponentId ? data.data : c))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  // Remove a component
  const handleRemoveComponent = async (kitComponentId: string) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/warehouse/items/${itemId}/components`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitComponentId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove component')
      }

      setComponents(prev => prev.filter(c => c.id !== kitComponentId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-red-800 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Search to Add */}
      <div ref={searchRef} className="relative">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowDropdown(true)
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search items to add..."
            className="pl-9 h-9"
            disabled={saving}
          />
          {searching && (
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
            {searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleQuickAdd(item)}
                disabled={saving}
                className="w-full px-3 py-2 text-left hover:bg-emerald-50 flex items-center justify-between gap-2 border-b last:border-b-0 disabled:opacity-50"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="font-mono text-xs text-emerald-600 whitespace-nowrap">{item.itemCode || '-'}</span>
                  <span className="truncate text-sm">{item.name}</span>
                </div>
                <span className="text-xs text-emerald-600 whitespace-nowrap flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </span>
              </button>
            ))}
          </div>
        )}

        {showDropdown && searchQuery && !searching && searchResults.length === 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg p-3 text-sm text-gray-500 text-center">
            No items found
          </div>
        )}
      </div>

      {/* Components Table */}
      {components.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Item #</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600 w-24">Qty</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {components.map((comp) => (
                <tr key={comp.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-emerald-600">{comp.component.itemCode || '-'}</span>
                    {!comp.component.isActive && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700">Inactive</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-gray-900">{comp.component.name}</span>
                    {comp.component.sku && (
                      <span className="ml-1 text-xs text-gray-400">({comp.component.sku})</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(comp.id, comp.quantity - 1)}
                        disabled={saving || comp.quantity <= 1}
                        className="w-6 h-6 flex items-center justify-center rounded border hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={comp.quantity}
                        onChange={(e) => handleUpdateQuantity(comp.id, parseInt(e.target.value) || 1)}
                        className="w-12 h-6 text-center text-sm border rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        disabled={saving}
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(comp.id, comp.quantity + 1)}
                        disabled={saving}
                        className="w-6 h-6 flex items-center justify-center rounded border hover:bg-gray-100 disabled:opacity-30"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveComponent(comp.id)}
                      disabled={saving}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-30"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t">
              <tr>
                <td colSpan={2} className="px-3 py-2 text-sm text-gray-600">
                  <strong>{components.length}</strong> component{components.length !== 1 ? 's' : ''}
                </td>
                <td className="px-3 py-2 text-center text-sm text-gray-600">
                  <strong>{components.reduce((sum, c) => sum + c.quantity, 0)}</strong> total
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed">
          <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-gray-500 mt-2">No components defined</p>
          <p className="text-sm text-gray-400">Search above to add items</p>
        </div>
      )}
    </div>
  )
}
