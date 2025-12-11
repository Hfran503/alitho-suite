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

export default function TransferStockPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [items, setItems] = useState<InventoryItem[]>([])
  const [locations, setLocations] = useState<WarehouseLocation[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [locationSearch, setLocationSearch] = useState('')

  const [formData, setFormData] = useState({
    itemId: '',
    fromLocationId: '',
    toLocationId: '',
    quantity: '',
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
        const response = await fetch(`/api/warehouse/locations?search=${locationSearch}&limit=30`)
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
      if (isNaN(quantity) || quantity <= 0) {
        throw new Error('Quantity must be a positive number')
      }

      if (formData.fromLocationId === formData.toLocationId) {
        throw new Error('Source and destination locations must be different')
      }

      const response = await fetch('/api/warehouse/inventory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: formData.itemId,
          fromLocationId: formData.fromLocationId,
          toLocationId: formData.toLocationId,
          quantity,
          notes: formData.notes || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to transfer stock')
      }

      setSuccess('Stock transferred successfully!')
      setFormData({
        itemId: '',
        fromLocationId: '',
        toLocationId: '',
        quantity: '',
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
  const fromLocation = locations.find((l) => l.id === formData.fromLocationId)
  const toLocation = locations.find((l) => l.id === formData.toLocationId)

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/warehouse/inventory" className="hover:text-emerald-600">
            Inventory
          </Link>
          <span>/</span>
          <span>Transfer Stock</span>
        </div>
        <h1 className="text-2xl font-bold">Transfer Stock</h1>
        <p className="text-gray-600">Move inventory between locations</p>
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
            <h2 className="text-lg font-semibold border-b pb-2">Transfer Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Item Selection */}
              <div className="md:col-span-2">
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

              {/* From Location */}
              <div>
                <Label htmlFor="fromLocationId">From Location *</Label>
                <Select
                  value={formData.fromLocationId || '_select'}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, fromLocationId: v === '_select' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source location" />
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
                      <SelectItem key={loc.id} value={loc.id} disabled={loc.id === formData.toLocationId}>
                        {loc.barcode} - {loc.warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fromLocation && (
                  <p className="text-sm text-gray-500 mt-1">
                    {fromLocation.name || fromLocation.barcode} at {fromLocation.warehouse.name}
                  </p>
                )}
              </div>

              {/* To Location */}
              <div>
                <Label htmlFor="toLocationId">To Location *</Label>
                <Select
                  value={formData.toLocationId || '_select'}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, toLocationId: v === '_select' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination location" />
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
                      <SelectItem key={loc.id} value={loc.id} disabled={loc.id === formData.fromLocationId}>
                        {loc.barcode} - {loc.warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {toLocation && (
                  <p className="text-sm text-gray-500 mt-1">
                    {toLocation.name || toLocation.barcode} at {toLocation.warehouse.name}
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div>
                <Label htmlFor="quantity">Quantity to Transfer *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                  placeholder="10"
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
                  placeholder="Reason for transfer..."
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Transfer Arrow Visual */}
          {fromLocation && toLocation && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-center gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg flex-1">
                  <p className="text-sm text-gray-500">From</p>
                  <p className="font-mono font-bold">{fromLocation.barcode}</p>
                  <p className="text-sm text-gray-600">{fromLocation.warehouse.name}</p>
                </div>
                <div className="flex-shrink-0">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg flex-1">
                  <p className="text-sm text-gray-500">To</p>
                  <p className="font-mono font-bold">{toLocation.barcode}</p>
                  <p className="text-sm text-gray-600">{toLocation.warehouse.name}</p>
                </div>
              </div>
            </div>
          )}

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
              disabled={
                loading ||
                !formData.itemId ||
                !formData.fromLocationId ||
                !formData.toLocationId ||
                !formData.quantity
              }
            >
              {loading ? 'Processing...' : 'Transfer Stock'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
