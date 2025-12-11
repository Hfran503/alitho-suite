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

interface Warehouse {
  id: string
  name: string
}

interface InventoryItem {
  id: string
  sku: string
  name: string
}

interface ASNLineItem {
  id: string
  itemId: string | null
  sku: string
  description: string
  expectedQty: number
  lotNumber: string
  expirationDate: string
}

export default function NewASNPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [itemSearch, setItemSearch] = useState('')

  const [formData, setFormData] = useState({
    vendorName: '',
    vendorEmail: '',
    warehouseId: '',
    expectedDate: '',
    carrier: '',
    trackingNumber: '',
    poNumber: '',
    notes: '',
  })

  const [lineItems, setLineItems] = useState<ASNLineItem[]>([])

  // Fetch warehouses
  useEffect(() => {
    async function fetchWarehouses() {
      try {
        const response = await fetch('/api/warehouses')
        if (response.ok) {
          const data = await response.json()
          setWarehouses(data.warehouses || [])
        }
      } catch (err) {
        console.error('Error fetching warehouses:', err)
      }
    }
    fetchWarehouses()
  }, [])

  // Fetch inventory items for selection
  useEffect(() => {
    async function fetchItems() {
      try {
        const response = await fetch(`/api/warehouse/items?search=${itemSearch}&limit=50`)
        if (response.ok) {
          const data = await response.json()
          setInventoryItems(data.data || [])
        }
      } catch (err) {
        console.error('Error fetching items:', err)
      }
    }
    fetchItems()
  }, [itemSearch])

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        itemId: null,
        sku: '',
        description: '',
        expectedQty: 1,
        lotNumber: '',
        expirationDate: '',
      },
    ])
  }

  const updateLineItem = (id: string, field: keyof ASNLineItem, value: string | number | null) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item

        // If selecting an inventory item, auto-fill SKU and description
        if (field === 'itemId' && value) {
          const inventoryItem = inventoryItems.find((i) => i.id === value)
          if (inventoryItem) {
            return {
              ...item,
              itemId: value as string,
              sku: inventoryItem.sku,
              description: inventoryItem.name,
            }
          }
        }

        return { ...item, [field]: value }
      })
    )
  }

  const removeLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!formData.warehouseId) {
        throw new Error('Please select a warehouse')
      }
      if (!formData.expectedDate) {
        throw new Error('Please enter expected date')
      }
      if (lineItems.length === 0) {
        throw new Error('Please add at least one line item')
      }

      // Validate line items
      for (const item of lineItems) {
        if (!item.sku || !item.description || item.expectedQty < 1) {
          throw new Error('All line items must have SKU, description, and quantity > 0')
        }
      }

      const response = await fetch('/api/warehouse/asn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorName: formData.vendorName,
          vendorEmail: formData.vendorEmail || null,
          warehouseId: formData.warehouseId,
          expectedDate: formData.expectedDate,
          carrier: formData.carrier || null,
          trackingNumber: formData.trackingNumber || null,
          poNumber: formData.poNumber || null,
          notes: formData.notes || null,
          items: lineItems.map((item) => ({
            itemId: item.itemId || null,
            sku: item.sku,
            description: item.description,
            expectedQty: item.expectedQty,
            lotNumber: item.lotNumber || null,
            expirationDate: item.expirationDate || null,
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create ASN')
      }

      router.push(`/warehouse/asn/${data.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/warehouse/asn" className="hover:text-emerald-600">
            ASN
          </Link>
          <span>/</span>
          <span>New</span>
        </div>
        <h1 className="text-2xl font-bold">Create ASN</h1>
        <p className="text-gray-600">Create a new Advanced Shipping Notice for inbound shipments</p>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Vendor & Shipment Info */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">Vendor & Shipment Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="vendorName">Vendor/Supplier Name *</Label>
                <Input
                  id="vendorName"
                  value={formData.vendorName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, vendorName: e.target.value }))}
                  placeholder="Acme Supplies Inc."
                  required
                />
              </div>

              <div>
                <Label htmlFor="vendorEmail">Vendor Email</Label>
                <Input
                  id="vendorEmail"
                  type="email"
                  value={formData.vendorEmail}
                  onChange={(e) => setFormData((prev) => ({ ...prev, vendorEmail: e.target.value }))}
                  placeholder="vendor@example.com"
                />
              </div>

              <div>
                <Label htmlFor="warehouseId">Destination Warehouse *</Label>
                <Select
                  value={formData.warehouseId || '_select'}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, warehouseId: v === '_select' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_select">Select warehouse</SelectItem>
                    {warehouses.map((wh) => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="expectedDate">Expected Arrival Date *</Label>
                <Input
                  id="expectedDate"
                  type="date"
                  value={formData.expectedDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, expectedDate: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="carrier">Carrier</Label>
                <Input
                  id="carrier"
                  value={formData.carrier}
                  onChange={(e) => setFormData((prev) => ({ ...prev, carrier: e.target.value }))}
                  placeholder="FedEx, UPS, etc."
                />
              </div>

              <div>
                <Label htmlFor="trackingNumber">Tracking Number</Label>
                <Input
                  id="trackingNumber"
                  value={formData.trackingNumber}
                  onChange={(e) => setFormData((prev) => ({ ...prev, trackingNumber: e.target.value }))}
                  placeholder="1Z999AA10123456784"
                />
              </div>

              <div>
                <Label htmlFor="poNumber">Purchase Order #</Label>
                <Input
                  id="poNumber"
                  value={formData.poNumber}
                  onChange={(e) => setFormData((prev) => ({ ...prev, poNumber: e.target.value }))}
                  placeholder="PO-12345"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Special handling instructions..."
                  rows={2}
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Expected Items</h2>
              <Button type="button" variant="outline" onClick={addLineItem}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Item
              </Button>
            </div>

            {lineItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p>No items added yet</p>
                <Button type="button" variant="outline" className="mt-4" onClick={addLineItem}>
                  Add First Item
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Inventory Item</TableHead>
                    <TableHead>SKU *</TableHead>
                    <TableHead>Description *</TableHead>
                    <TableHead className="w-[100px]">Expected Qty *</TableHead>
                    <TableHead>Lot #</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Select
                          value={item.itemId || '_manual'}
                          onValueChange={(v) => updateLineItem(item.id, 'itemId', v === '_manual' ? null : v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Manual entry" />
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
                            <SelectItem value="_manual">Manual entry</SelectItem>
                            {inventoryItems.map((inv) => (
                              <SelectItem key={inv.id} value={inv.id}>
                                {inv.sku} - {inv.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.sku}
                          onChange={(e) => updateLineItem(item.id, 'sku', e.target.value)}
                          placeholder="SKU"
                          className="font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          placeholder="Item description"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.expectedQty}
                          onChange={(e) => updateLineItem(item.id, 'expectedQty', parseInt(e.target.value) || 1)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.lotNumber}
                          onChange={(e) => updateLineItem(item.id, 'lotNumber', e.target.value)}
                          placeholder="Lot"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={item.expirationDate}
                          onChange={(e) => updateLineItem(item.id, 'expirationDate', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(item.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Link href="/warehouse/asn">
              <Button type="button" variant="outline" disabled={loading}>
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={loading || lineItems.length === 0}
            >
              {loading ? 'Creating...' : 'Create ASN'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
