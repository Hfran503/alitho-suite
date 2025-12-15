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
import { CustomerSelect } from '@/components/warehouse/customers/CustomerSelect'
import { ItemAddOnsManager } from '@/components/warehouse/items/ItemAddOnsManager'
import { KitComponentsManager } from '@/components/warehouse/items/KitComponentsManager'
import { DEFAULT_ITEM_CATEGORIES } from '@/lib/warehouse/constants'

type ItemType = 'STANDARD' | 'KIT_COMPONENT' | 'KIT_AND_COMPONENT' | 'KIT'

interface InventoryItemFormData {
  id?: string
  customerId: string | null
  sku: string
  upc: string
  name: string
  description: string
  category: string
  itemType: ItemType
  weight: string
  length: string
  width: string
  height: string
  dimensionUnit: 'in' | 'cm'
  isActive: boolean
  trackByReference: boolean
  // Pricing
  sellPrice: string
  // Bulk ordering
  canOrderInBulk: boolean
  bulkUnitName: string
  unitsPerBulk: string
  bulkSellPrice: string
  // Add-ons
  hasAddOns: boolean
}

interface InventoryItemFormProps {
  initialData?: InventoryItemFormData
  isEdit?: boolean
}

export function InventoryItemForm({ initialData, isEdit = false }: InventoryItemFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<InventoryItemFormData>(
    initialData || {
      customerId: null,
      sku: '',
      upc: '',
      name: '',
      description: '',
      category: '',
      itemType: 'STANDARD',
      weight: '',
      length: '',
      width: '',
      height: '',
      dimensionUnit: 'in',
      isActive: true,
      trackByReference: false,
      sellPrice: '',
      canOrderInBulk: false,
      bulkUnitName: '',
      unitsPerBulk: '',
      bulkSellPrice: '',
      hasAddOns: false,
    }
  )

  const handleChange = (field: keyof InventoryItemFormData, value: string | boolean | null) => {
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
          customerId: formData.customerId || null,
          sku: formData.sku || null,
          upc: formData.upc || null,
          name: formData.name,
          description: formData.description || null,
          category: formData.category || null,
          itemType: formData.itemType,
          weight: formData.weight ? parseFloat(formData.weight) : null,
          dimensions,
          isActive: formData.isActive,
          trackByReference: formData.trackByReference,
          // Pricing
          sellPrice: formData.sellPrice ? parseFloat(formData.sellPrice) : null,
          // Bulk ordering fields
          canOrderInBulk: formData.canOrderInBulk,
          bulkUnitName: formData.canOrderInBulk ? formData.bulkUnitName || null : null,
          unitsPerBulk: formData.canOrderInBulk && formData.unitsPerBulk ? parseInt(formData.unitsPerBulk) : null,
          bulkSellPrice: formData.canOrderInBulk && formData.bulkSellPrice ? parseFloat(formData.bulkSellPrice) : null,
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
              <Label htmlFor="sku">SKU (Optional)</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => handleChange('sku', e.target.value.toUpperCase())}
                placeholder="SKU-001"
                disabled={isEdit} // SKU shouldn't be changed after creation
                className="font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                {isEdit ? 'SKU cannot be changed after creation' : 'Leave empty to use Item # only'}
              </p>
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
              <Label htmlFor="customer">Customer (Optional)</Label>
              <CustomerSelect
                value={formData.customerId}
                onValueChange={(value) => handleChange('customerId', value)}
                placeholder="Select customer..."
                showNoneOption={true}
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty for company-owned inventory
              </p>
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
                  {DEFAULT_ITEM_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="itemType">Item Type</Label>
              <Select
                value={formData.itemType}
                onValueChange={(v) => handleChange('itemType', v as ItemType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select item type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STANDARD">Standard Item</SelectItem>
                  <SelectItem value="KIT_COMPONENT">Kit Component Only</SelectItem>
                  <SelectItem value="KIT_AND_COMPONENT">Kit & Standalone</SelectItem>
                  <SelectItem value="KIT">Kit (Assembly)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {formData.itemType === 'STANDARD' && 'Regular item that is used/sold on its own'}
                {formData.itemType === 'KIT_COMPONENT' && 'Only used as part of kits, not sold separately'}
                {formData.itemType === 'KIT_AND_COMPONENT' && 'Can be sold alone and used in kits'}
                {formData.itemType === 'KIT' && 'Assembled product made from components'}
              </p>
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

        {/* Tracking Options */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Tracking Options</h2>

          <div className="flex items-start gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={formData.trackByReference}
              onClick={() => handleChange('trackByReference', !formData.trackByReference)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 mt-0.5 ${
                formData.trackByReference ? 'bg-emerald-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.trackByReference ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <div>
              <Label className="cursor-pointer font-medium">
                Track by Reference Number (PO#)
              </Label>
              <p className="text-sm text-gray-500 mt-1">
                When enabled, inventory of this item will be tracked separately by PO# or reference number.
                Useful for customer goods where you need to see quantities per PO.
              </p>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Pricing</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sellPrice">Sell Price (per unit)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  id="sellPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.sellPrice}
                  onChange={(e) => handleChange('sellPrice', e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Price when selling individual units
              </p>
            </div>
          </div>
        </div>

        {/* Bulk/Case Ordering */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Bulk/Case Ordering</h2>

          <div className="flex items-start gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={formData.canOrderInBulk}
              onClick={() => handleChange('canOrderInBulk', !formData.canOrderInBulk)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 mt-0.5 ${
                formData.canOrderInBulk ? 'bg-emerald-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.canOrderInBulk ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <div>
              <Label className="cursor-pointer font-medium">
                Enable Bulk/Case Ordering
              </Label>
              <p className="text-sm text-gray-500 mt-1">
                Allow this item to be ordered in bulk units (cases, cartons, pallets, etc.)
              </p>
            </div>
          </div>

          {formData.canOrderInBulk && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t mt-4">
              <div>
                <Label htmlFor="bulkUnitName">Bulk Unit Name *</Label>
                <Select
                  value={formData.bulkUnitName || '_custom'}
                  onValueChange={(v) => handleChange('bulkUnitName', v === '_custom' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select or enter bulk unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Case">Case</SelectItem>
                    <SelectItem value="Carton">Carton</SelectItem>
                    <SelectItem value="Box">Box</SelectItem>
                    <SelectItem value="Pallet">Pallet</SelectItem>
                    <SelectItem value="Pack">Pack</SelectItem>
                    <SelectItem value="Bundle">Bundle</SelectItem>
                    <SelectItem value="_custom">Custom...</SelectItem>
                  </SelectContent>
                </Select>
                {formData.bulkUnitName === '' && (
                  <Input
                    className="mt-2"
                    value={formData.bulkUnitName}
                    onChange={(e) => handleChange('bulkUnitName', e.target.value)}
                    placeholder="Enter custom unit name"
                  />
                )}
              </div>

              <div>
                <Label htmlFor="unitsPerBulk">Units per {formData.bulkUnitName || 'Bulk Unit'} *</Label>
                <Input
                  id="unitsPerBulk"
                  type="number"
                  min="1"
                  step="1"
                  value={formData.unitsPerBulk}
                  onChange={(e) => handleChange('unitsPerBulk', e.target.value)}
                  placeholder="e.g., 24"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How many individual units are in one {formData.bulkUnitName?.toLowerCase() || 'bulk unit'}
                </p>
              </div>

              <div>
                <Label htmlFor="bulkSellPrice">Sell Price per {formData.bulkUnitName || 'Bulk Unit'}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <Input
                    id="bulkSellPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.bulkSellPrice}
                    onChange={(e) => handleChange('bulkSellPrice', e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Price when selling by {formData.bulkUnitName?.toLowerCase() || 'bulk unit'}
                </p>
              </div>

              {formData.bulkUnitName && formData.unitsPerBulk && (
                <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                  <p className="text-sm text-blue-800">
                    <strong>Example:</strong> Ordering 2 {formData.bulkUnitName.toLowerCase()}s = {parseInt(formData.unitsPerBulk) * 2} units
                  </p>
                  {formData.sellPrice && formData.bulkSellPrice && formData.unitsPerBulk && (
                    <p className="text-sm text-blue-800">
                      <strong>Savings:</strong> ${((parseFloat(formData.sellPrice) * parseInt(formData.unitsPerBulk)) - parseFloat(formData.bulkSellPrice)).toFixed(2)} per {formData.bulkUnitName.toLowerCase()} vs. buying individually
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Kit Components Section (only in edit mode for KIT types) */}
        {isEdit && initialData?.id && (formData.itemType === 'KIT' || formData.itemType === 'KIT_AND_COMPONENT') && (
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">Kit Components</h2>
            <p className="text-sm text-gray-600 -mt-2">
              Define the items that make up this kit. When assembled, these components will be deducted from inventory.
            </p>
            <KitComponentsManager itemId={initialData.id} />
          </div>
        )}

        {/* Add-Ons Section (only in edit mode) */}
        {isEdit && initialData?.id && (
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">Add-Ons / Bundled Items</h2>

            <div className="flex items-start gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={formData.hasAddOns}
                onClick={() => handleChange('hasAddOns', !formData.hasAddOns)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 mt-0.5 ${
                  formData.hasAddOns ? 'bg-emerald-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.hasAddOns ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <div>
                <Label className="cursor-pointer font-medium">
                  This item has add-ons
                </Label>
                <p className="text-sm text-gray-500 mt-1">
                  Enable to configure items that should be automatically included when this item is ordered.
                </p>
              </div>
            </div>

            {formData.hasAddOns && (
              <div className="pt-4 border-t mt-4">
                <ItemAddOnsManager
                  itemId={initialData.id}
                  canOrderInBulk={formData.canOrderInBulk}
                />
              </div>
            )}
          </div>
        )}

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
