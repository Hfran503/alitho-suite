'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface WarehouseLocation {
  id: string
  barcode: string
  name: string | null
}

interface ReceivingItem {
  id: string
  itemId: string | null
  sku: string
  description: string
  expectedQty: number
  receivedQty: number
  damagedQty: number
  lotNumber: string | null
  referenceNumber: string | null
  expirationDate: string | null
  notes: string | null
  putAwayLocation: WarehouseLocation | null
  item: {
    id: string
    sku: string
    name: string
  } | null
}

interface ReceivingRecord {
  id: string
  status: 'IN_PROGRESS' | 'COMPLETED' | 'COMPLETED_WITH_DISCREPANCY'
  notes: string | null
  discrepancyNotes: string | null
  createdAt: string
  completedAt: string | null
  asn: {
    id: string
    asnNumber: string
    vendorName: string
    warehouse: { id: string; name: string }
    items: Array<{ id: string; sku: string; description: string; expectedQty: number }>
  } | null
  warehouse: {
    id: string
    name: string
  }
  receivedBy: {
    id: string
    name: string | null
    email: string
  }
  items: ReceivingItem[]
}

interface InventoryItem {
  id: string
  sku: string
  name: string
}

const statusColors: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  COMPLETED_WITH_DISCREPANCY: 'bg-yellow-100 text-yellow-800',
}

const statusLabels: Record<string, string> = {
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  COMPLETED_WITH_DISCREPANCY: 'Completed with Discrepancy',
}

export default function ReceivingDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [record, setRecord] = useState<ReceivingRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [locations, setLocations] = useState<WarehouseLocation[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [itemSearch, setItemSearch] = useState('')

  // Complete dialog
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [discrepancyNotes, setDiscrepancyNotes] = useState('')
  const [completing, setCompleting] = useState(false)

  // Add item dialog
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [newItem, setNewItem] = useState({
    itemId: '',
    sku: '',
    description: '',
    receivedQty: 1,
    damagedQty: 0,
    putAwayLocationId: '',
    lotNumber: '',
    expirationDate: '',
    referenceNumber: '',
    notes: '',
  })

  const fetchRecord = useCallback(async () => {
    try {
      const response = await fetch(`/api/warehouse/receiving/${id}`)
      if (response.ok) {
        const data = await response.json()
        setRecord(data.data)
      } else {
        setError('Failed to load receiving record')
      }
    } catch (err) {
      console.error('Error fetching receiving record:', err)
      setError('Failed to load receiving record')
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchLocations = useCallback(async (warehouseId: string) => {
    try {
      const response = await fetch(`/api/warehouse/locations?warehouseId=${warehouseId}&isActive=true&limit=500`)
      if (response.ok) {
        const data = await response.json()
        setLocations(data.data || [])
      }
    } catch (err) {
      console.error('Error fetching locations:', err)
    }
  }, [])

  const fetchInventoryItems = useCallback(async () => {
    try {
      const response = await fetch(`/api/warehouse/items?search=${itemSearch}&limit=50&isActive=true`)
      if (response.ok) {
        const data = await response.json()
        setInventoryItems(data.data || [])
      }
    } catch (err) {
      console.error('Error fetching inventory items:', err)
    }
  }, [itemSearch])

  useEffect(() => {
    fetchRecord()
  }, [fetchRecord])

  useEffect(() => {
    if (record?.warehouse.id) {
      fetchLocations(record.warehouse.id)
    }
  }, [record?.warehouse.id, fetchLocations])

  useEffect(() => {
    fetchInventoryItems()
  }, [fetchInventoryItems])

  const updateItem = async (itemId: string, updates: { receivedQty?: number; damagedQty?: number; putAwayLocationId?: string | null; notes?: string }) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/warehouse/receiving/${id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        fetchRecord()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to update item')
      }
    } catch (err) {
      console.error('Error updating item:', err)
      alert('Failed to update item')
    } finally {
      setSaving(false)
    }
  }

  const handleAddItem = async () => {
    if (!newItem.sku || !newItem.description) {
      alert('SKU and description are required')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/warehouse/receiving/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: newItem.itemId || undefined,
          sku: newItem.sku,
          description: newItem.description,
          receivedQty: newItem.receivedQty,
          damagedQty: newItem.damagedQty,
          putAwayLocationId: newItem.putAwayLocationId || undefined,
          lotNumber: newItem.lotNumber || undefined,
          expirationDate: newItem.expirationDate || undefined,
          referenceNumber: newItem.referenceNumber || undefined,
          notes: newItem.notes || undefined,
        }),
      })

      if (response.ok) {
        setShowAddItemDialog(false)
        setNewItem({
          itemId: '',
          sku: '',
          description: '',
          receivedQty: 1,
          damagedQty: 0,
          putAwayLocationId: '',
          lotNumber: '',
          expirationDate: '',
          referenceNumber: '',
          notes: '',
        })
        fetchRecord()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to add item')
      }
    } catch (err) {
      console.error('Error adding item:', err)
      alert('Failed to add item')
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    setCompleting(true)
    try {
      const response = await fetch(`/api/warehouse/receiving/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discrepancyNotes }),
      })

      const data = await response.json()

      if (response.ok) {
        setShowCompleteDialog(false)
        fetchRecord()
      } else {
        alert(data.error || 'Failed to complete receiving')
      }
    } catch (err) {
      console.error('Error completing receiving:', err)
      alert('Failed to complete receiving')
    } finally {
      setCompleting(false)
    }
  }

  const selectInventoryItem = (itemId: string) => {
    const item = inventoryItems.find((i) => i.id === itemId)
    if (item) {
      setNewItem((prev) => ({
        ...prev,
        itemId: item.id,
        sku: item.sku,
        description: item.name,
      }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-emerald-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="ml-2">Loading...</span>
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error || 'Receiving record not found'}</p>
        <Link href="/warehouse/receiving">
          <Button variant="outline" className="mt-4">Back to Receiving</Button>
        </Link>
      </div>
    )
  }

  const isEditable = record.status === 'IN_PROGRESS'

  // Calculate totals
  const totalExpected = record.items.reduce((sum, item) => sum + item.expectedQty, 0)
  const totalReceived = record.items.reduce((sum, item) => sum + item.receivedQty, 0)
  const totalDamaged = record.items.reduce((sum, item) => sum + item.damagedQty, 0)
  const hasDiscrepancy = record.items.some((item) => item.expectedQty !== item.receivedQty + item.damagedQty)
  const itemsWithoutLocation = record.items.filter((item) => item.receivedQty > 0 && !item.putAwayLocation)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/warehouse" className="hover:text-emerald-600">Warehouse</Link>
            <span>/</span>
            <Link href="/warehouse/receiving" className="hover:text-emerald-600">Receiving</Link>
            <span>/</span>
            <span>Session</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Receiving Session</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[record.status]}`}>
              {statusLabels[record.status]}
            </span>
          </div>
        </div>
        {isEditable && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAddItemDialog(true)}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Item
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShowCompleteDialog(true)}
              disabled={record.items.length === 0 || itemsWithoutLocation.length > 0}
            >
              Complete Receiving
            </Button>
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {record.asn && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-1">ASN</h3>
            <Link href={`/warehouse/asn/${record.asn.id}`} className="text-emerald-600 hover:underline font-semibold">
              {record.asn.asnNumber}
            </Link>
            <p className="text-sm text-gray-600">{record.asn.vendorName}</p>
          </div>
        )}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Warehouse</h3>
          <p className="font-semibold">{record.warehouse.name}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Received By</h3>
          <p className="font-semibold">{record.receivedBy.name || record.receivedBy.email}</p>
          <p className="text-sm text-gray-600">{new Date(record.createdAt).toLocaleString()}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{record.items.length}</p>
            <p className="text-sm text-gray-500">Line Items</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{totalExpected}</p>
            <p className="text-sm text-gray-500">Expected Units</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{totalReceived}</p>
            <p className="text-sm text-gray-500">Received Units</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{totalDamaged}</p>
            <p className="text-sm text-gray-500">Damaged Units</p>
          </div>
        </div>
        {hasDiscrepancy && isEditable && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
            <strong>Note:</strong> There are discrepancies between expected and received quantities.
          </div>
        )}
        {itemsWithoutLocation.length > 0 && isEditable && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-800 text-sm">
            <strong>Warning:</strong> {itemsWithoutLocation.length} item(s) need a put-away location before completing.
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[100px]">Expected</TableHead>
              <TableHead className="w-[120px]">Received</TableHead>
              <TableHead className="w-[120px]">Damaged</TableHead>
              <TableHead className="w-[200px]">Put-Away Location</TableHead>
              <TableHead>Lot #</TableHead>
              <TableHead>Ref # (PO)</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {record.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  No items to receive. {isEditable && 'Click "Add Item" to start.'}
                </TableCell>
              </TableRow>
            ) : (
              record.items.map((item) => (
                <TableRow key={item.id} className={!item.putAwayLocation && item.receivedQty > 0 ? 'bg-orange-50' : ''}>
                  <TableCell className="font-mono">{item.sku}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-center">{item.expectedQty}</TableCell>
                  <TableCell>
                    {isEditable ? (
                      <Input
                        type="number"
                        min="0"
                        value={item.receivedQty}
                        onChange={(e) => updateItem(item.id, { receivedQty: parseInt(e.target.value) || 0 })}
                        className="w-20"
                        disabled={saving}
                      />
                    ) : (
                      <span className="text-center block">{item.receivedQty}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditable ? (
                      <Input
                        type="number"
                        min="0"
                        value={item.damagedQty}
                        onChange={(e) => updateItem(item.id, { damagedQty: parseInt(e.target.value) || 0 })}
                        className="w-20"
                        disabled={saving}
                      />
                    ) : (
                      <span className="text-center block">{item.damagedQty}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditable ? (
                      <Select
                        value={item.putAwayLocation?.id || '_none'}
                        onValueChange={(v) => updateItem(item.id, { putAwayLocationId: v === '_none' ? null : v })}
                        disabled={saving}
                      >
                        <SelectTrigger className={!item.putAwayLocation && item.receivedQty > 0 ? 'border-orange-400' : ''}>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">No location</SelectItem>
                          {locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.barcode}{loc.name ? ` (${loc.name})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      item.putAwayLocation?.barcode || '-'
                    )}
                  </TableCell>
                  <TableCell>{item.lotNumber || '-'}</TableCell>
                  <TableCell className="font-mono text-sm">{item.referenceNumber || '-'}</TableCell>
                  <TableCell className="text-sm text-gray-600 max-w-[150px] truncate" title={item.notes || undefined}>
                    {item.notes || '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Received Item</DialogTitle>
            <DialogDescription>
              Add an unexpected item to this receiving session
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Search Existing Items</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search by SKU or name..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                />
              </div>
              {inventoryItems.length > 0 && itemSearch && (
                <div className="mt-2 border rounded-lg max-h-32 overflow-auto">
                  {inventoryItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                      onClick={() => selectInventoryItem(item.id)}
                    >
                      <span className="font-mono">{item.sku}</span> - {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>SKU *</Label>
                <Input
                  value={newItem.sku}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, sku: e.target.value }))}
                  placeholder="Enter SKU"
                />
              </div>
              <div>
                <Label>Received Qty *</Label>
                <Input
                  type="number"
                  min="0"
                  value={newItem.receivedQty}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, receivedQty: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div>
              <Label>Description *</Label>
              <Input
                value={newItem.description}
                onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Item description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Damaged Qty</Label>
                <Input
                  type="number"
                  min="0"
                  value={newItem.damagedQty}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, damagedQty: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label>Lot Number</Label>
                <Input
                  value={newItem.lotNumber}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, lotNumber: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div>
              <Label>Reference Number (PO#)</Label>
              <Input
                value={newItem.referenceNumber}
                onChange={(e) => setNewItem((prev) => ({ ...prev, referenceNumber: e.target.value }))}
                placeholder="PO number or other reference"
              />
              <p className="text-xs text-gray-500 mt-1">Required for items with reference tracking enabled</p>
            </div>

            <div>
              <Label>Put-Away Location</Label>
              <Select
                value={newItem.putAwayLocationId || '_none'}
                onValueChange={(v) => setNewItem((prev) => ({ ...prev, putAwayLocationId: v === '_none' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Select later</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.barcode}{loc.name ? ` (${loc.name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleAddItem}
              disabled={saving || !newItem.sku || !newItem.description}
            >
              {saving ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Receiving</DialogTitle>
            <DialogDescription>
              This will update inventory levels and mark the receiving as complete.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold">{totalExpected}</p>
                  <p className="text-sm text-gray-500">Expected</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600">{totalReceived}</p>
                  <p className="text-sm text-gray-500">Received</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-red-600">{totalDamaged}</p>
                  <p className="text-sm text-gray-500">Damaged</p>
                </div>
              </div>
            </div>

            {hasDiscrepancy && (
              <div className="mb-4">
                <Label>Discrepancy Notes</Label>
                <textarea
                  value={discrepancyNotes}
                  onChange={(e) => setDiscrepancyNotes(e.target.value)}
                  placeholder="Explain any discrepancies..."
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            )}

            {hasDiscrepancy && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                <strong>Warning:</strong> There are discrepancies in this receiving session. The status will be marked as &quot;Completed with Discrepancy&quot;.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleComplete}
              disabled={completing}
            >
              {completing ? 'Completing...' : 'Complete Receiving'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
