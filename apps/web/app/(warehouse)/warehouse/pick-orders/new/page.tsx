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
    canOrderInBulk?: boolean
    bulkUnitName?: string | null
    unitsPerBulk?: number | null
    _count?: {
      addOns: number
    }
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
  // Add-on tracking
  isAddOn?: boolean
  parentItemId?: string
  parentSku?: string
  addOnQtyPerUnit?: number // Qty of add-on per 1 unit of parent
  isManuallyEdited?: boolean // Prevents auto-sync when true
  // Bulk order tracking
  isBulkOrder?: boolean
  bulkUnitName?: string
  unitsPerBulk?: number
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

  // Order type selection dialog state (individual vs bulk)
  const [orderTypeDialogOpen, setOrderTypeDialogOpen] = useState(false)
  const [pendingBulkItem, setPendingBulkItem] = useState<InventoryItem | null>(null)

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

  // Fetch and add add-ons for an item
  const fetchAndAddAddOns = async (parentItem: PickItem, requestedQty: number, isBulkOrder: boolean = false) => {
    try {
      const response = await fetch(`/api/warehouse/items/${parentItem.itemId}/addons`)
      if (!response.ok) return []

      const data = await response.json()
      const addOns = data.data || []

      // Filter add-ons based on order type
      const applicableAddOns = addOns.filter((addon: any) => {
        if (isBulkOrder) {
          return addon.applyTo === 'BULK_ONLY' || addon.applyTo === 'BOTH'
        } else {
          return addon.applyTo === 'INDIVIDUAL_ONLY' || addon.applyTo === 'BOTH'
        }
      })

      if (applicableAddOns.length === 0) return []

      // For each add-on, fetch its inventory to get available qty
      const addOnItems: PickItem[] = []

      for (const addon of applicableAddOns) {
        // Check if this add-on item has stock
        const inventoryResponse = await fetch(`/api/warehouse/inventory?search=${encodeURIComponent(addon.addOnItem.sku)}&limit=1`)
        if (!inventoryResponse.ok) continue

        const inventoryData = await inventoryResponse.json()
        const addOnInventory = (inventoryData.data || []).find(
          (inv: InventoryItem) => inv.item.id === addon.addOnItemId
        )

        // Use bulkQuantity for bulk orders if available, otherwise use regular quantity
        const qtyPerUnit = isBulkOrder && addon.bulkQuantity ? addon.bulkQuantity : addon.quantity
        const addOnQty = qtyPerUnit * requestedQty
        const availableQty = addOnInventory?.totalAvailable || 0

        // Only add if there's stock available
        if (availableQty > 0) {
          addOnItems.push({
            itemId: addon.addOnItemId,
            sku: addon.addOnItem.sku,
            name: addon.addOnItem.name,
            trackByReference: false,
            requestedQty: Math.min(addOnQty, availableQty),
            availableQty,
            isAddOn: true,
            parentItemId: parentItem.itemId,
            parentSku: parentItem.sku,
            addOnQtyPerUnit: qtyPerUnit, // Store the ratio for syncing
            notes: addon.notes || `Add-on for ${parentItem.sku}${isBulkOrder ? ' (bulk)' : ''}`,
          })
        }
      }

      return addOnItems
    } catch (err) {
      console.error('Error fetching add-ons:', err)
      return []
    }
  }

  const addItem = async (inventoryItem: InventoryItem) => {
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
    } else if (inventoryItem.item.canOrderInBulk) {
      // Item has bulk ordering enabled - show order type selection dialog
      setPendingBulkItem(inventoryItem)
      setOrderTypeDialogOpen(true)
      setSearchQuery('')
      setSearchResults([])
    } else {
      // Regular item - aggregate available
      await addItemWithOrderType(inventoryItem, false)
    }
  }

  // Helper function to add item with specific order type
  const addItemWithOrderType = async (inventoryItem: InventoryItem, isBulkOrder: boolean) => {
    // Check if already added (not as an add-on)
    if (items.some(i => i.itemId === inventoryItem.item.id && !i.isAddOn)) {
      alert('Item already added to pick order')
      return
    }

    const newItem: PickItem = {
      itemId: inventoryItem.item.id,
      sku: inventoryItem.item.sku,
      name: inventoryItem.item.name,
      trackByReference: false,
      requestedQty: 1,
      availableQty: inventoryItem.totalAvailable,
      isBulkOrder,
      bulkUnitName: isBulkOrder ? (inventoryItem.item.bulkUnitName || 'Bulk') : undefined,
      unitsPerBulk: isBulkOrder ? (inventoryItem.item.unitsPerBulk || 1) : undefined,
    }

    // Add the main item first
    setItems(prev => [...prev, newItem])

    // Fetch and add add-ons with appropriate order type
    const addOnItems = await fetchAndAddAddOns(newItem, 1, isBulkOrder)
    if (addOnItems.length > 0) {
      setItems(prev => [...prev, ...addOnItems])
    }

    setSearchQuery('')
    setSearchResults([])
  }

  // Handle order type selection from dialog
  const handleOrderTypeSelection = async (isBulkOrder: boolean) => {
    if (!pendingBulkItem) return

    setOrderTypeDialogOpen(false)
    await addItemWithOrderType(pendingBulkItem, isBulkOrder)
    setPendingBulkItem(null)
  }

  const addReferenceItem = async (ref: GroupedReference) => {
    if (!selectedInventoryItem) return

    // Check if this specific reference is already added
    const refKey = ref.referenceNumber || undefined
    if (items.some(i => i.itemId === selectedInventoryItem.item.id && i.referenceNumber === refKey && !i.isAddOn)) {
      alert('This reference is already added to the pick order')
      return
    }

    // Use the first location for this reference
    const firstLoc = ref.locations[0]

    const newItem: PickItem = {
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
    }

    // Add the main item first
    setItems(prev => [...prev, newItem])

    // Fetch and add add-ons
    const addOnItems = await fetchAndAddAddOns(newItem, 1)
    if (addOnItems.length > 0) {
      setItems(prev => [...prev, ...addOnItems])
    }

    setRefDialogOpen(false)
    setSelectedInventoryItem(null)
    setGroupedReferences([])
  }

  const updateItemQty = (index: number, qty: number, isManualEdit: boolean = false) => {
    setItems(prev => {
      const targetItem = prev[index]
      // For bulk orders, max is based on how many bulk units fit in available qty
      const maxQty = targetItem.isBulkOrder && targetItem.unitsPerBulk
        ? Math.floor(targetItem.availableQty / targetItem.unitsPerBulk)
        : targetItem.availableQty
      const newQty = Math.min(qty, maxQty)

      return prev.map((item, i) => {
        // Update the target item
        if (i === index) {
          // If this is an add-on and manually edited, mark it
          if (item.isAddOn && isManualEdit) {
            return { ...item, requestedQty: newQty, isManuallyEdited: true }
          }
          return { ...item, requestedQty: newQty }
        }

        // If target is a parent item, sync its add-ons (unless manually edited)
        if (!targetItem.isAddOn && item.isAddOn && item.parentItemId === targetItem.itemId) {
          if (item.isManuallyEdited) {
            // Don't auto-sync manually edited add-ons
            return item
          }
          // Calculate new add-on qty based on ratio
          const addOnQty = (item.addOnQtyPerUnit || 1) * newQty
          return { ...item, requestedQty: Math.min(addOnQty, item.availableQty) }
        }

        return item
      })
    })
  }

  // Toggle manual edit mode for add-ons
  const toggleAddOnManualEdit = (index: number) => {
    setItems(prev => {
      const addOn = prev[index]
      if (!addOn.isAddOn) return prev

      // If currently manually edited, re-sync with parent qty
      if (addOn.isManuallyEdited) {
        // Find the parent item to get its current qty
        const parentItem = prev.find(item => item.itemId === addOn.parentItemId && !item.isAddOn)
        if (parentItem) {
          const newAddOnQty = (addOn.addOnQtyPerUnit || 1) * parentItem.requestedQty
          return prev.map((item, i) => {
            if (i === index) {
              return {
                ...item,
                isManuallyEdited: false,
                requestedQty: Math.min(newAddOnQty, item.availableQty)
              }
            }
            return item
          })
        }
      }

      // Otherwise just toggle manual edit on (don't change qty)
      return prev.map((item, i) => {
        if (i === index) {
          return { ...item, isManuallyEdited: true }
        }
        return item
      })
    })
  }

  const removeItem = (index: number) => {
    const itemToRemove = items[index]

    // If removing a parent item, also remove its add-ons
    if (!itemToRemove.isAddOn) {
      setItems(prev => prev.filter((item, i) =>
        i !== index && !(item.isAddOn && item.parentItemId === itemToRemove.itemId)
      ))
    } else {
      // Just remove the add-on
      setItems(prev => prev.filter((_, i) => i !== index))
    }
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
                        <div className="flex gap-1 justify-end mt-1 flex-wrap">
                          {inventoryItem.item.trackByReference && (
                            <Badge variant="outline" className="text-xs">By PO#</Badge>
                          )}
                          {inventoryItem.item.canOrderInBulk && (
                            <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                              {inventoryItem.item.bulkUnitName || 'Bulk'}
                            </Badge>
                          )}
                          {inventoryItem.item._count && inventoryItem.item._count.addOns > 0 && (
                            <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-300">
                              +{inventoryItem.item._count.addOns} add-on{inventoryItem.item._count.addOns > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
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
                    <TableRow key={index} className={item.isAddOn ? 'bg-purple-50' : ''}>
                      <TableCell className="font-mono">
                        <div className="flex items-center gap-2">
                          {item.isAddOn && (
                            <span className="text-purple-400">↳</span>
                          )}
                          {item.sku}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.name}
                          {item.isAddOn && (
                            <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-300">
                              Add-on
                            </Badge>
                          )}
                          {item.isBulkOrder && (
                            <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                              {item.bulkUnitName || 'Bulk'}
                            </Badge>
                          )}
                        </div>
                        {item.isAddOn && item.parentSku && (
                          <p className="text-xs text-purple-600">for {item.parentSku}</p>
                        )}
                        {item.isBulkOrder && item.unitsPerBulk && (
                          <p className="text-xs text-blue-600">{item.unitsPerBulk} units per {item.bulkUnitName?.toLowerCase() || 'bulk'}</p>
                        )}
                      </TableCell>
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
                        {item.isBulkOrder && item.unitsPerBulk ? (
                          <div>
                            <span>{Math.floor(item.availableQty / item.unitsPerBulk)}</span>
                            <span className="text-xs text-gray-500 ml-1">{item.bulkUnitName?.toLowerCase() || 'bulk'}</span>
                          </div>
                        ) : (
                          item.availableQty
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {item.isAddOn && !item.isManuallyEdited ? (
                            // Synced with parent - show read-only
                            <span className="w-20 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded border">
                              {item.requestedQty}
                            </span>
                          ) : (
                            // Parent item or manually edited add-on - show editable
                            <Input
                              type="number"
                              min={1}
                              max={item.isBulkOrder && item.unitsPerBulk
                                ? Math.floor(item.availableQty / item.unitsPerBulk)
                                : item.availableQty}
                              value={item.requestedQty}
                              onChange={(e) => updateItemQty(index, parseInt(e.target.value) || 0, item.isAddOn)}
                              className={`w-20 ${item.isAddOn && item.isManuallyEdited ? 'border-orange-400 bg-orange-50' : ''}`}
                            />
                          )}
                          {item.isAddOn && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleAddOnManualEdit(index)}
                              className={`px-1 ${item.isManuallyEdited ? 'text-orange-600 hover:text-orange-800' : 'text-gray-400 hover:text-gray-600'}`}
                              title={item.isManuallyEdited ? 'Click to re-sync with parent qty' : 'Click to edit qty manually'}
                            >
                              {item.isManuallyEdited ? (
                                // Unlocked - can edit, click to re-sync
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                </svg>
                              ) : (
                                // Locked/synced - click to unlock for manual edit
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          title={item.isAddOn ? 'Remove add-on' : 'Remove item and its add-ons'}
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

      {/* Order Type Selection Dialog (Individual vs Bulk) */}
      <Dialog open={orderTypeDialogOpen} onOpenChange={setOrderTypeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>How would you like to order this item?</DialogTitle>
          </DialogHeader>
          {pendingBulkItem && (
            <div>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">{pendingBulkItem.item.sku}</p>
                <p className="text-sm text-gray-600">{pendingBulkItem.item.name}</p>
                <p className="text-sm text-emerald-600 mt-1">{pendingBulkItem.totalAvailable} available</p>
              </div>

              <p className="text-sm text-gray-500 mb-4">
                This item can be ordered individually or in bulk ({pendingBulkItem.item.bulkUnitName || 'cases'}).
                Different add-ons may apply based on your selection.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleOrderTypeSelection(false)}
                  className="p-4 border-2 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <span className="font-medium">Individual</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Order by single units
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleOrderTypeSelection(true)}
                  className="p-4 border-2 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="font-medium">{pendingBulkItem.item.bulkUnitName || 'Bulk'}</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {pendingBulkItem.item.unitsPerBulk} units per {pendingBulkItem.item.bulkUnitName?.toLowerCase() || 'bulk'}
                  </p>
                </button>
              </div>

              <div className="mt-4 flex justify-end">
                <Button variant="outline" onClick={() => {
                  setOrderTypeDialogOpen(false)
                  setPendingBulkItem(null)
                }}>
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
