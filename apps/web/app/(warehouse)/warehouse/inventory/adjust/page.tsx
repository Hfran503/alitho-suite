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
import { ImportAdjustmentDialog } from '@/components/warehouse/inventory/ImportAdjustmentDialog'

interface InventoryItem {
  id: string
  sku: string
  name: string
}

interface WarehouseLocation {
  id: string
  barcode: string
  name: string | null
  warehouse: {
    id: string
    name: string
  }
}

const ADJUSTMENT_TYPES = [
  { value: 'RECEIVE', label: 'Receive (Add Stock)', color: 'text-green-600' },
  { value: 'ADJUST', label: 'Adjustment (Cycle Count)', color: 'text-blue-600' },
  { value: 'DAMAGE', label: 'Mark as Damaged', color: 'text-red-600' },
]

export default function AdjustStockPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  const [items, setItems] = useState<InventoryItem[]>([])
  const [locations, setLocations] = useState<WarehouseLocation[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [locationSearch, setLocationSearch] = useState('')

  const [formData, setFormData] = useState({
    itemId: '',
    locationId: '',
    quantity: '',
    type: 'RECEIVE',
    notes: '',
  })

  // Fetch items
  useEffect(() => {
    async function fetchItems() {
      try {
        const response = await fetch(`/api/warehouse/items?search=${itemSearch}&limit=20`)
        if (response.ok) {
          const data = await response.json()
          setItems(data.data || [])
        }
      } catch (err) {
        console.error('Error fetching items:', err)
      }
    }
    fetchItems()
  }, [itemSearch])

  // Fetch locations
  useEffect(() => {
    async function fetchLocations() {
      try {
        const response = await fetch(`/api/warehouse/locations?search=${locationSearch}&limit=20`)
        if (response.ok) {
          const data = await response.json()
          setLocations(data.data || [])
        }
      } catch (err) {
        console.error('Error fetching locations:', err)
      }
    }
    fetchLocations()
  }, [locationSearch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const quantity = parseInt(formData.quantity)
      if (isNaN(quantity) || quantity === 0) {
        throw new Error('Quantity must be a non-zero number')
      }

      const response = await fetch('/api/warehouse/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: formData.itemId,
          locationId: formData.locationId,
          quantity: formData.type === 'DAMAGE' ? Math.abs(quantity) : quantity,
          type: formData.type,
          notes: formData.notes || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to adjust stock')
      }

      setSuccess('Stock adjusted successfully!')
      setFormData({
        itemId: '',
        locationId: '',
        quantity: '',
        type: 'RECEIVE',
        notes: '',
      })

      // Redirect after short delay
      setTimeout(() => {
        router.push('/warehouse/inventory')
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const selectedItem = items.find((i) => i.id === formData.itemId)
  const selectedLocation = locations.find((l) => l.id === formData.locationId)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/warehouse/inventory" className="hover:text-emerald-600">
              Inventory
            </Link>
            <span>/</span>
            <span>Adjust Stock</span>
          </div>
          <h1 className="text-2xl font-bold">Adjust Stock</h1>
          <p className="text-gray-600">Add or adjust inventory stock levels</p>
        </div>
        <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import from CSV
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-green-800">
            {success}
          </div>
        )}

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">Adjustment Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Item Selection */}
              <div>
                <Label htmlFor="itemId">Item *</Label>
                <Select
                  value={formData.itemId || '_select'}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, itemId: v === '_select' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <Input
                        placeholder="Search items..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="mb-2"
                      />
                    </div>
                    <SelectItem value="_select">Select item</SelectItem>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.sku} - {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedItem && (
                  <p className="text-sm text-gray-500 mt-1">{selectedItem.name}</p>
                )}
              </div>

              {/* Location Selection */}
              <div>
                <Label htmlFor="locationId">Location *</Label>
                <Select
                  value={formData.locationId || '_select'}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, locationId: v === '_select' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <Input
                        placeholder="Search locations..."
                        value={locationSearch}
                        onChange={(e) => setLocationSearch(e.target.value)}
                        className="mb-2"
                      />
                    </div>
                    <SelectItem value="_select">Select location</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.barcode} - {loc.warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedLocation && (
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedLocation.name || selectedLocation.barcode} at {selectedLocation.warehouse.name}
                  </p>
                )}
              </div>

              {/* Adjustment Type */}
              <div>
                <Label htmlFor="type">Adjustment Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADJUSTMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <span className={type.color}>{type.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity */}
              <div>
                <Label htmlFor="quantity">
                  Quantity * {formData.type === 'ADJUST' && '(positive to add, negative to remove)'}
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                  placeholder={formData.type === 'ADJUST' ? '-10 or 10' : '10'}
                  required
                />
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Reason for adjustment..."
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Link href="/warehouse/inventory">
              <Button type="button" variant="outline" disabled={loading}>
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={loading || !formData.itemId || !formData.locationId || !formData.quantity}
            >
              {loading ? 'Processing...' : 'Submit Adjustment'}
            </Button>
          </div>
        </div>
      </form>

      {/* Import Dialog */}
      <ImportAdjustmentDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={() => {
          router.push('/warehouse/inventory')
        }}
      />
    </div>
  )
}
