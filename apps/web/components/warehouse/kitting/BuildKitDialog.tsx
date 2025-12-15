'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  }
  quantityPerKit: number
  available: number
  canMake: number
  isLimiting: boolean
}

interface Availability {
  kit: {
    id: string
    itemCode: string | null
    sku: string | null
    name: string
  }
  maxAssemblable: number
  components: ComponentAvailability[]
  hasComponents: boolean
}

interface BuildKitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kitId: string
  kitName: string
  kitCode: string | null
  onSuccess?: () => void
}

export function BuildKitDialog({
  open,
  onOpenChange,
  kitId,
  kitName,
  kitCode,
  onSuccess,
}: BuildKitDialogProps) {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [notes, setNotes] = useState<string>('')

  const [availability, setAvailability] = useState<Availability | null>(null)

  // Fetch locations and availability when dialog opens
  useEffect(() => {
    if (!open) return

    async function fetchData() {
      setLoading(true)
      setError(null)
      setSuccess(null)
      setQuantity(1)
      setNotes('')
      setSelectedLocationId('')

      try {
        const [locationsRes, availRes] = await Promise.all([
          fetch('/api/warehouse/locations?limit=200'),
          fetch(`/api/warehouse/kitting/availability?kitId=${kitId}`),
        ])

        if (locationsRes.ok) {
          const locationsData = await locationsRes.json()
          setLocations(locationsData.data || [])
        }

        if (availRes.ok) {
          const availData = await availRes.json()
          setAvailability(availData.data)
        }
      } catch (err) {
        console.error('Error fetching data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [open, kitId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!selectedLocationId || quantity < 1) {
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
          kitId,
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
      const availRes = await fetch(`/api/warehouse/kitting/availability?kitId=${kitId}`)
      if (availRes.ok) {
        const availData = await availRes.json()
        setAvailability(availData.data)
      }

      // Reset form
      setQuantity(1)
      setNotes('')

      // Call success callback
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Build Kit
            {kitCode && (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-mono text-sm rounded">
                {kitCode}
              </span>
            )}
          </DialogTitle>
          <p className="text-sm text-gray-500">{kitName}</p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-6 w-6 text-emerald-600 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading...
          </div>
        ) : availability && !availability.hasComponents ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
            <p className="font-medium">No components defined</p>
            <p className="text-sm mt-1">
              This kit has no components. Add components to the kit before assembling.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
                {success}
              </div>
            )}

            {/* Availability Summary */}
            {availability && (
              <div className={`rounded-lg p-3 ${
                availability.maxAssemblable > 0
                  ? 'bg-emerald-50 border border-emerald-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={availability.maxAssemblable > 0 ? 'text-emerald-800' : 'text-red-800'}>
                    Can assemble:
                  </span>
                  <span className={`text-xl font-bold ${
                    availability.maxAssemblable > 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {availability.maxAssemblable}
                  </span>
                </div>
              </div>
            )}

            {/* Components Table */}
            {availability && availability.components.length > 0 && (
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
                          <span className="block text-gray-900 truncate max-w-[180px]">
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
                            {comp.isLimiting && ' ⚠'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Destination Location *</Label>
                <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        <span className="font-mono mr-2">{loc.barcode}</span>
                        <span className="text-gray-400">- {loc.warehouse.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  max={availability?.maxAssemblable || 999999}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Assembly notes..."
                rows={2}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={submitting || !selectedLocationId || quantity < 1 || (availability?.maxAssemblable === 0)}
              >
                {submitting ? 'Assembling...' : `Build ${quantity} Kit${quantity !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
