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

interface Warehouse {
  id: string
  name: string
}

export default function BulkCreateLocationsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ created: number; skipped: number } | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [preview, setPreview] = useState<string[]>([])

  const [formData, setFormData] = useState({
    warehouseId: '',
    locationType: 'STORAGE',
    zoneStart: '',
    zoneEnd: '',
    aisleStart: '',
    aisleEnd: '',
    rackStart: '',
    rackEnd: '',
    shelfStart: '',
    shelfEnd: '',
    binStart: '',
    binEnd: '',
    barcodeFormat: '{zone}-{aisle}-{rack}-{shelf}-{bin}',
  })

  // Fetch warehouses
  useEffect(() => {
    async function fetchWarehouses() {
      try {
        const response = await fetch('/api/warehouses')
        if (response.ok) {
          const data = await response.json()
          setWarehouses(data.warehouses || [])
          if (data.warehouses?.length === 1) {
            setFormData(prev => ({ ...prev, warehouseId: data.warehouses[0].id }))
          }
        }
      } catch (err) {
        console.error('Error fetching warehouses:', err)
      }
    }
    fetchWarehouses()
  }, [])

  // Generate preview
  useEffect(() => {
    const generateRange = (start: string, end: string): string[] => {
      if (!start || !end) return ['']
      const startNum = parseInt(start)
      const endNum = parseInt(end)
      if (!isNaN(startNum) && !isNaN(endNum)) {
        const results: string[] = []
        const padLength = start.length
        for (let i = startNum; i <= Math.min(endNum, startNum + 5); i++) {
          results.push(i.toString().padStart(padLength, '0'))
        }
        if (endNum > startNum + 5) results.push('...')
        return results
      }
      if (start.length === 1 && end.length === 1) {
        const startCode = start.toUpperCase().charCodeAt(0)
        const endCode = end.toUpperCase().charCodeAt(0)
        const results: string[] = []
        for (let i = startCode; i <= Math.min(endCode, startCode + 5); i++) {
          results.push(String.fromCharCode(i))
        }
        if (endCode > startCode + 5) results.push('...')
        return results
      }
      return [start]
    }

    const zones = generateRange(formData.zoneStart, formData.zoneEnd)
    const aisles = generateRange(formData.aisleStart, formData.aisleEnd)
    const racks = generateRange(formData.rackStart, formData.rackEnd)
    const shelves = generateRange(formData.shelfStart, formData.shelfEnd)
    const bins = generateRange(formData.binStart, formData.binEnd)

    const previewBarcodes: string[] = []
    let count = 0
    outer: for (const zone of zones) {
      for (const aisle of aisles) {
        for (const rack of racks) {
          for (const shelf of shelves) {
            for (const bin of bins) {
              if (count >= 10) {
                previewBarcodes.push('...')
                break outer
              }
              if (zone === '...' || aisle === '...' || rack === '...' || shelf === '...' || bin === '...') continue
              let barcode = formData.barcodeFormat
                .replace('{zone}', zone)
                .replace('{aisle}', aisle)
                .replace('{rack}', rack)
                .replace('{shelf}', shelf)
                .replace('{bin}', bin)
              barcode = barcode.replace(/--+/g, '-').replace(/^-|-$/g, '')
              if (barcode) {
                previewBarcodes.push(barcode)
                count++
              }
            }
          }
        }
      }
    }
    setPreview(previewBarcodes)
  }, [formData])

  // Calculate total count
  const calculateTotal = () => {
    const countRange = (start: string, end: string): number => {
      if (!start || !end) return 1
      const startNum = parseInt(start)
      const endNum = parseInt(end)
      if (!isNaN(startNum) && !isNaN(endNum)) {
        return Math.max(1, endNum - startNum + 1)
      }
      if (start.length === 1 && end.length === 1) {
        const startCode = start.toUpperCase().charCodeAt(0)
        const endCode = end.toUpperCase().charCodeAt(0)
        return Math.max(1, endCode - startCode + 1)
      }
      return 1
    }

    return (
      countRange(formData.zoneStart, formData.zoneEnd) *
      countRange(formData.aisleStart, formData.aisleEnd) *
      countRange(formData.rackStart, formData.rackEnd) *
      countRange(formData.shelfStart, formData.shelfEnd) *
      countRange(formData.binStart, formData.binEnd)
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/warehouse/locations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create locations')
      }

      setSuccess(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const totalLocations = calculateTotal()

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/warehouse/locations" className="hover:text-emerald-600">
            Locations
          </Link>
          <span>/</span>
          <span>Bulk Create</span>
        </div>
        <h1 className="text-2xl font-bold">Bulk Create Locations</h1>
        <p className="text-gray-600">Generate multiple locations using a pattern</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-green-800">Success!</h3>
          <p className="text-green-700">
            Created {success.created} location(s). {success.skipped > 0 && `${success.skipped} skipped (already exist).`}
          </p>
          <Link href="/warehouse/locations" className="text-emerald-600 hover:underline mt-2 inline-block">
            View Locations
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <h2 className="text-lg font-semibold border-b pb-2">Basic Settings</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="warehouseId">Warehouse *</Label>
                  <Select
                    value={formData.warehouseId}
                    onValueChange={(value) => handleChange('warehouseId', value)}
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
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <h2 className="text-lg font-semibold border-b pb-2">Location Ranges</h2>
              <p className="text-sm text-gray-600">
                Define start and end values for each position. Use letters (A-Z) or numbers (01-99).
              </p>

              <div className="space-y-4">
                {[
                  { label: 'Zone', startKey: 'zoneStart', endKey: 'zoneEnd', placeholder: 'A' },
                  { label: 'Aisle', startKey: 'aisleStart', endKey: 'aisleEnd', placeholder: '01' },
                  { label: 'Rack', startKey: 'rackStart', endKey: 'rackEnd', placeholder: '01' },
                  { label: 'Shelf', startKey: 'shelfStart', endKey: 'shelfEnd', placeholder: 'A' },
                  { label: 'Bin', startKey: 'binStart', endKey: 'binEnd', placeholder: '01' },
                ].map(({ label, startKey, endKey, placeholder }) => (
                  <div key={label} className="grid grid-cols-3 gap-2 items-center">
                    <Label>{label}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={formData[startKey as keyof typeof formData]}
                        onChange={(e) => handleChange(startKey, e.target.value.toUpperCase())}
                        placeholder={placeholder}
                        maxLength={5}
                        className="w-20"
                      />
                      <span className="text-gray-400">to</span>
                      <Input
                        value={formData[endKey as keyof typeof formData]}
                        onChange={(e) => handleChange(endKey, e.target.value.toUpperCase())}
                        placeholder={placeholder}
                        maxLength={5}
                        className="w-20"
                      />
                    </div>
                    <div className="text-xs text-gray-500">
                      Leave empty to skip
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <h2 className="text-lg font-semibold border-b pb-2">Barcode Format</h2>
              <div>
                <Label htmlFor="barcodeFormat">Format Template</Label>
                <Input
                  id="barcodeFormat"
                  value={formData.barcodeFormat}
                  onChange={(e) => handleChange('barcodeFormat', e.target.value)}
                  placeholder="{zone}-{aisle}-{rack}-{shelf}-{bin}"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available placeholders: {'{zone}'}, {'{aisle}'}, {'{rack}'}, {'{shelf}'}, {'{bin}'}
                </p>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6 sticky top-6">
              <h2 className="text-lg font-semibold border-b pb-2 mb-4">Preview</h2>

              <div className="mb-4">
                <div className="text-3xl font-bold text-emerald-600">{totalLocations.toLocaleString()}</div>
                <div className="text-sm text-gray-600">locations will be created</div>
              </div>

              {totalLocations > 1000 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm text-yellow-800">
                  Maximum 1,000 locations per batch. Please reduce the range.
                </div>
              )}

              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-700 mb-2">Sample barcodes:</div>
                {preview.map((barcode, i) => (
                  <div key={i} className="font-mono text-sm bg-gray-50 px-2 py-1 rounded">
                    {barcode}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  disabled={loading || !formData.warehouseId || totalLocations === 0 || totalLocations > 1000}
                >
                  {loading ? 'Creating...' : 'Create Locations'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
