'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
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

interface Kit {
  id: string
  itemCode: string | null
  sku: string | null
  name: string
}

interface Location {
  id: string
  barcode: string
  name: string | null
  warehouse: {
    id: string
    name: string
  }
}

interface ComponentAvailability {
  id: string
  componentId: string
  component: {
    id: string
    itemCode: string | null
    sku: string | null
    name: string
    isActive: boolean
  }
  quantityPerKit: number
  available: number
  canMake: number
  isLimiting: boolean
}

interface Availability {
  kit: Kit
  maxAssemblable: number
  components: ComponentAvailability[]
  hasComponents: boolean
}

export default function BuildKitPage() {
  const searchParams = useSearchParams()
  const preselectedKitId = searchParams.get('kitId')

  const [kits, setKits] = useState<Kit[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [selectedKitId, setSelectedKitId] = useState<string>(preselectedKitId || '')
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [notes, setNotes] = useState<string>('')

  const [availability, setAvailability] = useState<Availability | null>(null)
  const [checkingAvailability, setCheckingAvailability] = useState(false)

  // Fetch kits and locations on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [kitsRes, locationsRes] = await Promise.all([
          fetch('/api/warehouse/items?itemType=KIT,KIT_AND_COMPONENT&limit=100'),
          fetch('/api/warehouse/locations?limit=200'),
        ])

        if (kitsRes.ok) {
          const kitsData = await kitsRes.json()
          setKits(kitsData.data || [])
        }

        if (locationsRes.ok) {
          const locationsData = await locationsRes.json()
          setLocations(locationsData.data || [])
        }
      } catch (err) {
        console.error('Error fetching data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Check availability when kit changes
  useEffect(() => {
    if (!selectedKitId) {
      setAvailability(null)
      return
    }

    async function checkAvailability() {
      setCheckingAvailability(true)
      try {
        const response = await fetch(`/api/warehouse/kitting/availability?kitId=${selectedKitId}`)
        if (response.ok) {
          const data = await response.json()
          setAvailability(data.data)
        }
      } catch (err) {
        console.error('Error checking availability:', err)
      } finally {
        setCheckingAvailability(false)
      }
    }
    checkAvailability()
  }, [selectedKitId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!selectedKitId || !selectedLocationId || quantity < 1) {
      setError('Please fill in all required fields')
      return
    }

    if (availability && quantity > availability.maxAssemblable) {
      setError(`Cannot assemble ${quantity} kits. Maximum available: ${availability.maxAssemblable}`)
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/warehouse/kitting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kitId: selectedKitId,
          locationId: selectedLocationId,
          quantity,
          notes: notes || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.shortages) {
          const shortageList = data.shortages
            .map((s: { component: string; required: number; available: number }) =>
              `${s.component}: need ${s.required}, have ${s.available}`
            )
            .join('; ')
          throw new Error(`Insufficient stock: ${shortageList}`)
        }
        throw new Error(data.error || 'Failed to assemble kit')
      }

      setSuccess(data.message)
      // Refresh availability
      const availRes = await fetch(`/api/warehouse/kitting/availability?kitId=${selectedKitId}`)
      if (availRes.ok) {
        const availData = await availRes.json()
        setAvailability(availData.data)
      }
      // Reset form
      setQuantity(1)
      setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/warehouse/kitting" className="hover:text-emerald-600">
            Kit Assembly
          </Link>
          <span>/</span>
          <span>Build Kit</span>
        </div>
        <h1 className="text-2xl font-bold">Build Kit</h1>
        <p className="text-gray-600">Assemble kits from component inventory</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
                {success}
              </div>
            )}

            <div>
              <Label>Select Kit *</Label>
              <Select value={selectedKitId} onValueChange={setSelectedKitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a kit to assemble..." />
                </SelectTrigger>
                <SelectContent>
                  {kits.map((kit) => (
                    <SelectItem key={kit.id} value={kit.id}>
                      <span className="font-mono text-emerald-600 mr-2">
                        {kit.itemCode || kit.sku || '-'}
                      </span>
                      {kit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {kits.length === 0 && (
                <p className="text-sm text-amber-600 mt-1">
                  No kits found. Create a kit item first.
                </p>
              )}
            </div>

            <div>
              <Label>Destination Location *</Label>
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Where to store assembled kits..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      <span className="font-mono mr-2">{loc.barcode}</span>
                      {loc.name && <span className="text-gray-500">({loc.name})</span>}
                      <span className="text-gray-400 ml-2">- {loc.warehouse.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Quantity to Assemble *</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max={availability?.maxAssemblable || 999999}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-32"
                />
                {availability && (
                  <span className="text-sm text-gray-500">
                    Max: <strong className="text-emerald-600">{availability.maxAssemblable}</strong> available
                  </span>
                )}
              </div>
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Assembly notes..."
                rows={2}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Link href="/warehouse/kitting">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={submitting || !selectedKitId || !selectedLocationId || quantity < 1}
              >
                {submitting ? 'Assembling...' : `Assemble ${quantity} Kit${quantity !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </form>
        </div>

        {/* Component Availability */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Component Availability</h2>

          {!selectedKitId ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="mx-auto h-10 w-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Select a kit to see component availability
            </div>
          ) : checkingAvailability ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-5 w-5 text-emerald-600 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Checking availability...
            </div>
          ) : availability && !availability.hasComponents ? (
            <div className="text-center py-8">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
                <p className="font-medium">No components defined</p>
                <p className="text-sm mt-1">
                  This kit has no components. Add components to the kit before assembling.
                </p>
                <Link
                  href={`/warehouse/items/${selectedKitId}`}
                  className="text-sm underline mt-2 inline-block"
                >
                  Edit Kit Components
                </Link>
              </div>
            </div>
          ) : availability ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className={`rounded-lg p-4 ${
                availability.maxAssemblable > 0
                  ? 'bg-emerald-50 border border-emerald-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={availability.maxAssemblable > 0 ? 'text-emerald-800' : 'text-red-800'}>
                    Can assemble:
                  </span>
                  <span className={`text-2xl font-bold ${
                    availability.maxAssemblable > 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {availability.maxAssemblable}
                  </span>
                </div>
              </div>

              {/* Components Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Component</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Per Kit</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Available</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Can Make</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {availability.components.map((comp) => (
                      <tr
                        key={comp.id}
                        className={comp.isLimiting ? 'bg-amber-50' : 'hover:bg-gray-50'}
                      >
                        <td className="px-3 py-2">
                          <span className="font-mono text-xs text-emerald-600">
                            {comp.component.itemCode || comp.component.sku || '-'}
                          </span>
                          <span className="block text-gray-900 truncate max-w-[200px]">
                            {comp.component.name}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-medium">
                          {comp.quantityPerKit}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={comp.available === 0 ? 'text-red-600 font-medium' : ''}>
                            {comp.available}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              comp.isLimiting
                                ? 'bg-amber-100 text-amber-800'
                                : comp.canMake > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {comp.canMake}
                            {comp.isLimiting && ' (limiting)'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Required for current quantity */}
              {quantity > 1 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800 font-medium mb-2">
                    Required for {quantity} kits:
                  </p>
                  <div className="text-xs text-blue-700 space-y-1">
                    {availability.components.map((comp) => (
                      <div key={comp.id} className="flex justify-between">
                        <span>{comp.component.itemCode || comp.component.name}</span>
                        <span className={
                          comp.quantityPerKit * quantity > comp.available
                            ? 'text-red-600 font-medium'
                            : ''
                        }>
                          {comp.quantityPerKit * quantity} / {comp.available} available
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
