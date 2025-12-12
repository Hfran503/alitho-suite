'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface InventoryItem {
  item: {
    id: string
    sku: string
    name: string
    trackByReference: boolean
  }
  totalAvailable: number
  totalReserved: number
  locations: Array<{
    location: {
      id: string
      barcode: string
      name: string
    }
    available: number
    reserved: number
    referenceNumber: string | null
    lotNumber: string | null
  }>
}

interface PickItem {
  itemId: string
  sku: string
  name: string
  trackByReference: boolean
  locationId?: string
  locationBarcode?: string
  referenceNumber?: string
  lotNumber?: string
  requestedQty: number
  availableQty: number
  notes?: string
}

interface GroupedReference {
  referenceNumber: string | null
  lotNumber: string | null
  totalAvailable: number
  totalReserved: number
  locations: Array<{
    location: {
      id: string
      barcode: string
      name: string
    }
    available: number
    reserved: number
  }>
}

export default function NewPickOrderPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [destination, setDestination] = useState('')
  const [destinationNotes, setDestinationNotes] = useState('')
  const [priority, setPriority] = useState<string>('normal')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<PickItem[]>([])

  // Item search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([])
  const [searching, setSearching] = useState(false)

  // Reference selection dialog state
  const [refDialogOpen, setRefDialogOpen] = useState(false)
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null)
  const [groupedReferences, setGroupedReferences] = useState<GroupedReference[]>([])

  // Fetch inventory items with stock
  useEffect(() => {
    const searchItems = async () => {
      if (!searchQuery || searchQuery.length < 2) {
        setSearchResults([])
        return
      }

      setSearching(true)
      try {
        const response = await fetch(`/api/warehouse/inventory?search=${encodeURIComponent(searchQuery)}&limit=10`)
        if (response.ok) {
          const data = await response.json()
          // Filter to only items with available stock
          const withStock = (data.data || []).filter((item: InventoryItem) => item.totalAvailable > 0)
          setSearchResults(withStock)
        }
      } catch (err) {
        console.error('Error searching items:', err)
      } finally {
        setSearching(false)
      }
    }

    const timer = setTimeout(searchItems, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const addItem = (inventoryItem: InventoryItem) => {
    // For items with reference tracking, show selection dialog
    if (inventoryItem.item.trackByReference && inventoryItem.locations.length > 0) {
      // Group by reference number
      const byRef = new Map<string, GroupedReference>()
      for (const loc of inventoryItem.locations) {
        const refKey = loc.referenceNumber || 'NO_REF'
        const existing = byRef.get(refKey)
        if (existing) {
          existing.totalAvailable += loc.available
          existing.totalReserved += loc.reserved || 0
          existing.locations.push({
            location: loc.location,
            available: loc.available,
            reserved: loc.reserved || 0,
          })
        } else {
          byRef.set(refKey, {
            referenceNumber: loc.referenceNumber,
            lotNumber: loc.lotNumber,
            totalAvailable: loc.available,
            totalReserved: loc.reserved || 0,
            locations: [{
              location: loc.location,
              available: loc.available,
              reserved: loc.reserved || 0,
            }],
          })
        }
      }

      // Convert map to array and sort by reference number
      const refs = Array.from(byRef.values()).sort((a, b) =>
        (a.referenceNumber || '').localeCompare(b.referenceNumber || '')
      )

      setSelectedInventoryItem(inventoryItem)
      setGroupedReferences(refs)
      setRefDialogOpen(true)
      setSearchQuery('')
      setSearchResults([])
    } else {
      // Regular item - aggregate available
      // Check if already added
      if (items.some(i => i.itemId === inventoryItem.item.id)) {
        alert('Item already added to pick order')
        return
      }

      setItems(prev => [...prev, {
        itemId: inventoryItem.item.id,
        sku: inventoryItem.item.sku,
        name: inventoryItem.item.name,
        trackByReference: false,
        requestedQty: 1,
        availableQty: inventoryItem.totalAvailable,
      }])

      setSearchQuery('')
      setSearchResults([])
    }
  }

  const addReferenceItem = (ref: GroupedReference) => {
    if (!selectedInventoryItem) return

    // Check if this specific reference is already added
    const refKey = ref.referenceNumber || undefined
    if (items.some(i => i.itemId === selectedInventoryItem.item.id && i.referenceNumber === refKey)) {
      alert('This reference is already added to the pick order')
      return
    }

    // Use the first location for this reference
    const firstLoc = ref.locations[0]

    setItems(prev => [...prev, {
      itemId: selectedInventoryItem.item.id,
      sku: selectedInventoryItem.item.sku,
      name: selectedInventoryItem.item.name,
      trackByReference: true,
      locationId: firstLoc.location.id,
      locationBarcode: firstLoc.location.barcode,
      referenceNumber: ref.referenceNumber || undefined,
      lotNumber: ref.lotNumber || undefined,
      requestedQty: 1,
      availableQty: ref.totalAvailable,
    }])

    setRefDialogOpen(false)
    setSelectedInventoryItem(null)
    setGroupedReferences([])
  }

  const updateItemQty = (index: number, qty: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i === index) {
        return { ...item, requestedQty: Math.min(qty, item.availableQty) }
      }
      return item
    }))
  }

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!destination.trim()) {
      setError('Destination is required')
      return
    }

    if (items.length === 0) {
      setError('At least one item is required')
      return
    }

    // Validate all items have quantities
    const invalidItems = items.filter(i => i.requestedQty <= 0)
    if (invalidItems.length > 0) {
      setError('All items must have a quantity greater than 0')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/warehouse/pick-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          destinationNotes: destinationNotes || undefined,
          priority,
          notes: notes || undefined,
          items: items.map(item => ({
            itemId: item.itemId,
            // locationId is not sent during creation - it's selected during picking
            referenceNumber: item.referenceNumber || undefined,
            lotNumber: item.lotNumber || undefined,
            requestedQty: item.requestedQty,
            notes: item.notes || undefined,
          })),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create pick order')
      }

      const data = await response.json()
      router.push(`/warehouse/pick-orders/${data.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pick order')
    } finally {
      setSaving(false)
    }
  }

  const totalItems = items.length
  const totalQty = items.reduce((sum, i) => sum + i.requestedQty, 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/warehouse" className="hover:text-emerald-600">
              Warehouse
            </Link>
            <span>/</span>
            <Link href="/warehouse/pick-orders" className="hover:text-emerald-600">
              Pick Orders
            </Link>
            <span>/</span>
            <span>New</span>
          </div>
          <h1 className="text-2xl font-bold">New Pick Order</h1>
          <p className="text-gray-600">Create a new pick order for warehouse fulfillment</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Destination & Priority */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Order Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="destination">Destination *</Label>
                <Input
                  id="destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g., Press Room, Fulfillment Area, External Warehouse"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="destinationNotes">Destination Notes</Label>
                <Input
                  id="destinationNotes"
                  value={destinationNotes}
                  onChange={(e) => setDestinationNotes(e.target.value)}
                  placeholder="Additional delivery instructions..."
                />
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Items to Pick</h2>

            {/* Search */}
            <div className="relative mb-4">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items by SKU or name..."
                className="pr-10"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                  {searchResults.map((inventoryItem) => (
                    <button
                      key={`search-${inventoryItem.item.id}`}
                      type="button"
                      onClick={() => addItem(inventoryItem)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">{inventoryItem.item.sku}</p>
                        <p className="text-sm text-gray-600">{inventoryItem.item.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-emerald-600">{inventoryItem.totalAvailable} available</p>
                        {inventoryItem.item.trackByReference && (
                          <Badge variant="outline" className="text-xs">By PO#</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items Table */}
            {items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Ref #</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="w-28">Qty</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono">{item.sku}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>
                        {item.referenceNumber ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {item.referenceNumber}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {item.availableQty}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          max={item.availableQty}
                          value={item.requestedQty}
                          onChange={(e) => updateItemQty(index, parseInt(e.target.value) || 0)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p>No items added yet</p>
                <p className="text-sm">Search for items above to add them to this pick order</p>
              </div>
            )}
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-6">
            <h2 className="text-lg font-semibold mb-4">Summary</h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Items</span>
                <span className="font-medium">{totalItems}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Quantity</span>
                <span className="font-medium">{totalQty}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Priority</span>
                <Badge variant="outline" className={`${
                  priority === 'urgent' ? 'bg-red-100 text-red-600' :
                  priority === 'high' ? 'bg-orange-100 text-orange-600' :
                  priority === 'low' ? 'bg-gray-100 text-gray-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </Badge>
              </div>
              {destination && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Destination</span>
                  <span className="font-medium text-right max-w-[150px] truncate" title={destination}>
                    {destination}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Button
                onClick={handleSubmit}
                disabled={saving || items.length === 0 || !destination}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating...
                  </>
                ) : (
                  'Create Pick Order'
                )}
              </Button>
              <Link href="/warehouse/pick-orders">
                <Button variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Reference Selection Dialog */}
      <Dialog open={refDialogOpen} onOpenChange={setRefDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Reference Number (PO#)</DialogTitle>
          </DialogHeader>
          {selectedInventoryItem && (
            <div>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">{selectedInventoryItem.item.sku}</p>
                <p className="text-sm text-gray-600">{selectedInventoryItem.item.name}</p>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                Select which PO# you want to pick from:
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {groupedReferences.map((ref, idx) => {
                  const isAlreadyAdded = items.some(
                    i => i.itemId === selectedInventoryItem.item.id &&
                         i.referenceNumber === (ref.referenceNumber || undefined)
                  )
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => addReferenceItem(ref)}
                      disabled={isAlreadyAdded}
                      className={`w-full p-3 text-left border rounded-lg transition-colors ${
                        isAlreadyAdded
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'hover:bg-emerald-50 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono font-medium">
                            {ref.referenceNumber || '(No Reference)'}
                          </p>
                          {ref.lotNumber && (
                            <p className="text-xs text-gray-500">Lot: {ref.lotNumber}</p>
                          )}
                          <p className="text-xs text-gray-500">
                            {ref.locations.length} location{ref.locations.length > 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${isAlreadyAdded ? 'text-gray-400' : 'text-emerald-600'}`}>
                            {ref.totalAvailable.toLocaleString()} available
                          </p>
                          {ref.totalReserved > 0 && (
                            <p className="text-xs text-orange-600">
                              {ref.totalReserved.toLocaleString()} reserved
                            </p>
                          )}
                          {isAlreadyAdded && (
                            <Badge variant="outline" className="text-xs">Added</Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" onClick={() => setRefDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
