'use client'

import { useState } from 'react'
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

interface InventoryItemFormData {
  id?: string
  sku: string
  upc: string
  name: string
  description: string
  category: string
  weight: string
  length: string
  width: string
  height: string
  dimensionUnit: 'in' | 'cm'
  isActive: boolean
}

interface InventoryItemFormProps {
  initialData?: InventoryItemFormData
  isEdit?: boolean
}

const COMMON_CATEGORIES = [
  'Raw Materials',
  'Finished Goods',
  'Packaging',
  'Components',
  'Supplies',
  'Equipment',
  'Other',
]

export function InventoryItemForm({ initialData, isEdit = false }: InventoryItemFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<InventoryItemFormData>(
    initialData || {
      sku: '',
      upc: '',
      name: '',
      description: '',
      category: '',
      weight: '',
      length: '',
      width: '',
      height: '',
      dimensionUnit: 'in',
      isActive: true,
    }
  )

  const handleChange = (field: keyof InventoryItemFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const url = isEdit && initialData?.id
        ? `/api/warehouse/items/${initialData.id}`
        : '/api/warehouse/items'
      const method = isEdit ? 'PATCH' : 'POST'

      // Build dimensions object if any dimension is provided
      let dimensions = null
      if (formData.length || formData.width || formData.height) {
        dimensions = {
          length: formData.length ? parseFloat(formData.length) : undefined,
          width: formData.width ? parseFloat(formData.width) : undefined,
          height: formData.height ? parseFloat(formData.height) : undefined,
          unit: formData.dimensionUnit,
        }
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: formData.sku,
          upc: formData.upc || null,
          name: formData.name,
          description: formData.description || null,
          category: formData.category || null,
          weight: formData.weight ? parseFloat(formData.weight) : null,
          dimensions,
          isActive: formData.isActive,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save item')
      }

      router.push('/warehouse/items')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Basic Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => handleChange('sku', e.target.value.toUpperCase())}
                placeholder="SKU-001"
                required
                disabled={isEdit} // SKU shouldn't be changed after creation
                className="font-mono"
              />
              {isEdit && (
                <p className="text-xs text-gray-500 mt-1">SKU cannot be changed after creation</p>
              )}
            </div>

            <div>
              <Label htmlFor="upc">UPC / Barcode</Label>
              <Input
                id="upc"
                value={formData.upc}
                onChange={(e) => handleChange('upc', e.target.value)}
                placeholder="012345678901"
                className="font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Product Name"
                required
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Product description..."
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category || '_none'}
                onValueChange={(v) => handleChange('category', v === '_none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No Category</SelectItem>
                  {COMMON_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 pt-6">
              <button
                type="button"
                role="switch"
                aria-checked={formData.isActive}
                onClick={() => handleChange('isActive', !formData.isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.isActive ? 'bg-emerald-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.isActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <Label htmlFor="isActive" className="cursor-pointer">
                Active item
              </Label>
            </div>
          </div>
        </div>

        {/* Physical Attributes */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Physical Attributes</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="weight">Weight (lbs)</Label>
              <Input
                id="weight"
                type="number"
                step="0.001"
                min="0"
                value={formData.weight}
                onChange={(e) => handleChange('weight', e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="length">Length</Label>
              <Input
                id="length"
                type="number"
                step="0.01"
                min="0"
                value={formData.length}
                onChange={(e) => handleChange('length', e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="width">Width</Label>
              <Input
                id="width"
                type="number"
                step="0.01"
                min="0"
                value={formData.width}
                onChange={(e) => handleChange('width', e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="height">Height</Label>
              <Input
                id="height"
                type="number"
                step="0.01"
                min="0"
                value={formData.height}
                onChange={(e) => handleChange('height', e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="dimensionUnit">Dimension Unit</Label>
              <Select
                value={formData.dimensionUnit}
                onValueChange={(v) => handleChange('dimensionUnit', v as 'in' | 'cm')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Inches (in)</SelectItem>
                  <SelectItem value="cm">Centimeters (cm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/warehouse/items">
            <Button type="button" variant="outline" disabled={loading}>
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={loading}
          >
            {loading ? 'Saving...' : isEdit ? 'Update Item' : 'Create Item'}
          </Button>
        </div>
      </div>
    </form>
  )
}
