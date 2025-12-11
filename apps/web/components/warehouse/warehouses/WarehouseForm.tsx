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

interface WarehouseFormData {
  id?: string
  name: string
  companyName: string
  addressLine1: string
  addressLine2: string
  cityLocality: string
  stateProvince: string
  postalCode: string
  countryCode: string
  phone: string
  isDefault: boolean
  warehouseType: 'STORAGE_FACILITY' | 'BOTH'
}

interface WarehouseFormProps {
  initialData?: WarehouseFormData
  isEdit?: boolean
}

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
]

export function WarehouseForm({ initialData, isEdit = false }: WarehouseFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<WarehouseFormData>(
    initialData || {
      name: '',
      companyName: '',
      addressLine1: '',
      addressLine2: '',
      cityLocality: '',
      stateProvince: '',
      postalCode: '',
      countryCode: 'US',
      phone: '',
      isDefault: false,
      warehouseType: 'STORAGE_FACILITY',
    }
  )

  const handleChange = (field: keyof WarehouseFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const url = isEdit && initialData?.id
        ? `/api/warehouses/${initialData.id}`
        : '/api/warehouses'
      const method = isEdit ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          companyName: formData.companyName || null,
          addressLine2: formData.addressLine2 || null,
          phone: formData.phone || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save warehouse')
      }

      router.push('/warehouse/warehouses')
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
              <Label htmlFor="name">Warehouse Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Main Warehouse"
                required
              />
            </div>

            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                placeholder="Calitho LLC"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <Label htmlFor="warehouseType">Warehouse Type</Label>
              <Select
                value={formData.warehouseType}
                onValueChange={(v) => handleChange('warehouseType', v as 'STORAGE_FACILITY' | 'BOTH')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STORAGE_FACILITY">Storage Facility Only</SelectItem>
                  <SelectItem value="BOTH">Storage + Shipping Origin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Select &quot;Both&quot; if you also ship from this location
              </p>
            </div>

            <div className="flex items-center gap-3 pt-6">
              <button
                type="button"
                role="switch"
                aria-checked={formData.isDefault}
                onClick={() => handleChange('isDefault', !formData.isDefault)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.isDefault ? 'bg-emerald-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.isDefault ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <Label htmlFor="isDefault" className="cursor-pointer">
                Set as default warehouse
              </Label>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Address</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="addressLine1">Address Line 1 *</Label>
              <Input
                id="addressLine1"
                value={formData.addressLine1}
                onChange={(e) => handleChange('addressLine1', e.target.value)}
                placeholder="123 Warehouse Blvd"
                required
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input
                id="addressLine2"
                value={formData.addressLine2}
                onChange={(e) => handleChange('addressLine2', e.target.value)}
                placeholder="Suite 100"
              />
            </div>

            <div>
              <Label htmlFor="cityLocality">City *</Label>
              <Input
                id="cityLocality"
                value={formData.cityLocality}
                onChange={(e) => handleChange('cityLocality', e.target.value)}
                placeholder="Los Angeles"
                required
              />
            </div>

            <div>
              <Label htmlFor="stateProvince">State *</Label>
              <Select
                value={formData.stateProvince || '_select'}
                onValueChange={(v) => handleChange('stateProvince', v === '_select' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_select">Select state</SelectItem>
                  {US_STATES.map((state) => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="postalCode">Postal Code *</Label>
              <Input
                id="postalCode"
                value={formData.postalCode}
                onChange={(e) => handleChange('postalCode', e.target.value)}
                placeholder="90001"
                required
              />
            </div>

            <div>
              <Label htmlFor="countryCode">Country</Label>
              <Select
                value={formData.countryCode}
                onValueChange={(v) => handleChange('countryCode', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                  <SelectItem value="MX">Mexico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/warehouse/warehouses">
            <Button type="button" variant="outline" disabled={loading}>
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={loading}
          >
            {loading ? 'Saving...' : isEdit ? 'Update Warehouse' : 'Create Warehouse'}
          </Button>
        </div>
      </div>
    </form>
  )
}
