'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

interface Warehouse {
  id: string
  name: string
}

interface LocationFormData {
  warehouseId: string
  zone: string
  aisle: string
  rack: string
  shelf: string
  bin: string
  barcode: string
  name: string
  locationType: 'RECEIVING' | 'STORAGE' | 'SHIPPING' | 'STAGING' | 'QUARANTINE'
  maxCapacity: string
  isActive: boolean
}

interface LocationFormProps {
  initialData?: Partial<LocationFormData> & { id?: string }
  isEdit?: boolean
}

export function LocationForm({ initialData, isEdit = false }: LocationFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [formData, setFormData] = useState<LocationFormData>({
    warehouseId: initialData?.warehouseId || '',
    zone: initialData?.zone || '',
    aisle: initialData?.aisle || '',
    rack: initialData?.rack || '',
    shelf: initialData?.shelf || '',
    bin: initialData?.bin || '',
    barcode: initialData?.barcode || '',
    name: initialData?.name || '',
    locationType: initialData?.locationType || 'STORAGE',
    maxCapacity: initialData?.maxCapacity?.toString() || '',
    isActive: initialData?.isActive ?? true,
  })

  // Fetch warehouses
  useEffect(() => {
    async function fetchWarehouses() {
      try {
        const response = await fetch('/api/warehouses')
        if (response.ok) {
          const data = await response.json()
          setWarehouses(data.warehouses || [])
          // If only one warehouse, auto-select it
          if (data.warehouses?.length === 1 && !formData.warehouseId) {
            setFormData(prev => ({ ...prev, warehouseId: data.warehouses[0].id }))
          }
        }
      } catch (err) {
        console.error('Error fetching warehouses:', err)
      }
    }
    fetchWarehouses()
  }, [formData.warehouseId])

  // Auto-generate barcode when location parts change
  useEffect(() => {
    if (!isEdit && !formData.barcode) {
      const parts = [formData.zone, formData.aisle, formData.rack, formData.shelf, formData.bin]
        .filter(Boolean)
      if (parts.length > 0) {
        setFormData(prev => ({ ...prev, barcode: parts.join('-') }))
      }
    }
  }, [formData.zone, formData.aisle, formData.rack, formData.shelf, formData.bin, isEdit, formData.barcode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload = {
        warehouseId: formData.warehouseId,
        zone: formData.zone || undefined,
        aisle: formData.aisle || undefined,
        rack: formData.rack || undefined,
        shelf: formData.shelf || undefined,
        bin: formData.bin || undefined,
        barcode: formData.barcode,
        name: formData.name || undefined,
        locationType: formData.locationType,
        maxCapacity: formData.maxCapacity ? parseInt(formData.maxCapacity) : undefined,
        isActive: formData.isActive,
      }

      const url = isEdit
        ? `/api/warehouse/locations/${initialData?.id}`
        : '/api/warehouse/locations'

      const response = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save location')
      }

      router.push('/warehouse/locations')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof LocationFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <h2 className="text-lg font-semibold border-b pb-2">Basic Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="warehouseId">Warehouse *</Label>
            <Select
              value={formData.warehouseId}
              onValueChange={(value) => handleChange('warehouseId', value)}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="locationType">Location Type</Label>
            <Select
              value={formData.locationType}
              onValueChange={(value) => handleChange('locationType', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RECEIVING">Receiving</SelectItem>
                <SelectItem value="STORAGE">Storage</SelectItem>
                <SelectItem value="SHIPPING">Shipping</SelectItem>
                <SelectItem value="STAGING">Staging</SelectItem>
                <SelectItem value="QUARANTINE">Quarantine</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="barcode">Barcode *</Label>
            <Input
              id="barcode"
              value={formData.barcode}
              onChange={(e) => handleChange('barcode', e.target.value)}
              placeholder="e.g., A-01-02-B-03"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Unique identifier for scanning. Auto-generated from location parts below.
            </p>
          </div>

          <div>
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Receiving Dock 1"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <h2 className="text-lg font-semibold border-b pb-2">Location Position</h2>
        <p className="text-sm text-gray-600">
          Define the physical position of this location in your warehouse.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <Label htmlFor="zone">Zone</Label>
            <Input
              id="zone"
              value={formData.zone}
              onChange={(e) => handleChange('zone', e.target.value.toUpperCase())}
              placeholder="A"
              maxLength={10}
            />
          </div>

          <div>
            <Label htmlFor="aisle">Aisle</Label>
            <Input
              id="aisle"
              value={formData.aisle}
              onChange={(e) => handleChange('aisle', e.target.value)}
              placeholder="01"
              maxLength={10}
            />
          </div>

          <div>
            <Label htmlFor="rack">Rack</Label>
            <Input
              id="rack"
              value={formData.rack}
              onChange={(e) => handleChange('rack', e.target.value)}
              placeholder="02"
              maxLength={10}
            />
          </div>

          <div>
            <Label htmlFor="shelf">Shelf</Label>
            <Input
              id="shelf"
              value={formData.shelf}
              onChange={(e) => handleChange('shelf', e.target.value.toUpperCase())}
              placeholder="B"
              maxLength={10}
            />
          </div>

          <div>
            <Label htmlFor="bin">Bin</Label>
            <Input
              id="bin"
              value={formData.bin}
              onChange={(e) => handleChange('bin', e.target.value)}
              placeholder="03"
              maxLength={10}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <h2 className="text-lg font-semibold border-b pb-2">Additional Settings</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="maxCapacity">Max Capacity (units)</Label>
            <Input
              id="maxCapacity"
              type="number"
              min="1"
              value={formData.maxCapacity}
              onChange={(e) => handleChange('maxCapacity', e.target.value)}
              placeholder="Leave empty for unlimited"
            />
          </div>

          {isEdit && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => handleChange('isActive', e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-700"
          disabled={loading || !formData.warehouseId || !formData.barcode}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </>
          ) : isEdit ? (
            'Update Location'
          ) : (
            'Create Location'
          )}
        </Button>
      </div>
    </form>
  )
}
