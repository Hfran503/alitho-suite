'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
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

interface ASN {
  id: string
  asnNumber: string
  vendorName: string
  expectedDate: string
  status: string
  warehouse: {
    id: string
    name: string
  }
  _count: {
    items: number
  }
}

export default function NewReceivingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [pendingASNs, setPendingASNs] = useState<ASN[]>([])

  const [mode, setMode] = useState<'asn' | 'manual'>('asn')
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [selectedASN, setSelectedASN] = useState('')
  const [notes, setNotes] = useState('')

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

  // Fetch pending ASNs (ARRIVED status)
  useEffect(() => {
    async function fetchPendingASNs() {
      try {
        const params = new URLSearchParams({ status: 'ARRIVED', limit: '100' })
        const response = await fetch(`/api/warehouse/asn?${params}`)
        if (response.ok) {
          const data = await response.json()
          setPendingASNs(data.data || [])
        }
      } catch (err) {
        console.error('Error fetching pending ASNs:', err)
      }
    }
    fetchPendingASNs()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (mode === 'asn' && !selectedASN) {
        throw new Error('Please select an ASN')
      }
      if (mode === 'manual' && !selectedWarehouse) {
        throw new Error('Please select a warehouse')
      }

      let response: Response

      if (mode === 'asn') {
        // Start receiving from ASN
        response = await fetch(`/api/warehouse/receiving/from-asn/${selectedASN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes }),
        })
      } else {
        // Start manual receiving
        response = await fetch('/api/warehouse/receiving', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            warehouseId: selectedWarehouse,
            notes,
          }),
        })
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start receiving')
      }

      router.push(`/warehouse/receiving/${data.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Filter ASNs by selected warehouse when in ASN mode
  const filteredASNs = selectedWarehouse
    ? pendingASNs.filter((asn) => asn.warehouse.id === selectedWarehouse)
    : pendingASNs

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/warehouse" className="hover:text-emerald-600">
            Warehouse
          </Link>
          <span>/</span>
          <Link href="/warehouse/receiving" className="hover:text-emerald-600">
            Receiving
          </Link>
          <span>/</span>
          <span>Start</span>
        </div>
        <h1 className="text-2xl font-bold">Start Receiving</h1>
        <p className="text-gray-600">Begin a new receiving session to process inbound goods</p>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Mode Selection */}
          <div>
            <Label className="text-base font-semibold mb-4 block">Receiving Mode</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  mode === 'asn'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setMode('asn')}
              >
                <div className="flex items-center mb-2">
                  <svg className={`w-5 h-5 mr-2 ${mode === 'asn' ? 'text-emerald-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium">From ASN</span>
                </div>
                <p className="text-sm text-gray-600">
                  Select an arrived ASN to receive expected items
                </p>
              </button>

              <button
                type="button"
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  mode === 'manual'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setMode('manual')}
              >
                <div className="flex items-center mb-2">
                  <svg className={`w-5 h-5 mr-2 ${mode === 'manual' ? 'text-emerald-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className="font-medium">Manual Entry</span>
                </div>
                <p className="text-sm text-gray-600">
                  Receive items without an ASN (unexpected deliveries)
                </p>
              </button>
            </div>
          </div>

          {/* ASN Mode */}
          {mode === 'asn' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="warehouse">Filter by Warehouse (Optional)</Label>
                <Select
                  value={selectedWarehouse || '_all'}
                  onValueChange={(v) => {
                    setSelectedWarehouse(v === '_all' ? '' : v)
                    setSelectedASN('')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Warehouses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Warehouses</SelectItem>
                    {warehouses.map((wh) => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="asn">Select ASN *</Label>
                {filteredASNs.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-500 text-center">
                    No pending ASNs available to receive
                  </div>
                ) : (
                  <Select
                    value={selectedASN || '_select'}
                    onValueChange={(v) => setSelectedASN(v === '_select' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an ASN" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_select">Select an ASN</SelectItem>
                      {filteredASNs.map((asn) => (
                        <SelectItem key={asn.id} value={asn.id}>
                          {asn.asnNumber} - {asn.vendorName} ({asn._count.items} items)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedASN && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  {(() => {
                    const asn = pendingASNs.find((a) => a.id === selectedASN)
                    if (!asn) return null
                    return (
                      <div>
                        <h4 className="font-medium text-emerald-800 mb-2">Selected ASN Details</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">ASN Number:</span> {asn.asnNumber}
                          </div>
                          <div>
                            <span className="text-gray-600">Vendor:</span> {asn.vendorName}
                          </div>
                          <div>
                            <span className="text-gray-600">Warehouse:</span> {asn.warehouse.name}
                          </div>
                          <div>
                            <span className="text-gray-600">Expected Items:</span> {asn._count.items}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Manual Mode */}
          {mode === 'manual' && (
            <div>
              <Label htmlFor="warehouse">Destination Warehouse *</Label>
              <Select
                value={selectedWarehouse || '_select'}
                onValueChange={(v) => setSelectedWarehouse(v === '_select' ? '' : v)}
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
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special notes about this receiving session..."
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Link href="/warehouse/receiving">
              <Button type="button" variant="outline" disabled={loading}>
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={loading || (mode === 'asn' && !selectedASN) || (mode === 'manual' && !selectedWarehouse)}
            >
              {loading ? 'Starting...' : 'Start Receiving'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
