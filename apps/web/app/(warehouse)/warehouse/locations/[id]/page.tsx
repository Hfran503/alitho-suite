'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { LocationForm } from '@/components/warehouse/locations/LocationForm'

interface LocationData {
  id: string
  warehouseId: string
  zone: string | null
  aisle: string | null
  rack: string | null
  shelf: string | null
  bin: string | null
  barcode: string
  name: string | null
  locationType: 'RECEIVING' | 'STORAGE' | 'SHIPPING' | 'STAGING' | 'QUARANTINE'
  maxCapacity: number | null
  isActive: boolean
}

export default function EditLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [location, setLocation] = useState<LocationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLocation() {
      try {
        const response = await fetch(`/api/warehouse/locations/${id}`)
        if (!response.ok) {
          throw new Error('Location not found')
        }
        const data = await response.json()
        setLocation(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchLocation()
  }, [id])

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

  if (error || !location) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
        <p className="text-red-600">{error || 'Location not found'}</p>
        <Link href="/warehouse/locations" className="text-emerald-600 hover:underline mt-4 inline-block">
          Back to Locations
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/warehouse/locations" className="hover:text-emerald-600">
            Locations
          </Link>
          <span>/</span>
          <span>{location.barcode}</span>
        </div>
        <h1 className="text-2xl font-bold">Edit Location</h1>
        <p className="text-gray-600">Update location details for {location.barcode}</p>
      </div>

      <LocationForm
        initialData={{
          id: location.id,
          warehouseId: location.warehouseId,
          zone: location.zone || '',
          aisle: location.aisle || '',
          rack: location.rack || '',
          shelf: location.shelf || '',
          bin: location.bin || '',
          barcode: location.barcode,
          name: location.name || '',
          locationType: location.locationType,
          maxCapacity: location.maxCapacity?.toString() || '',
          isActive: location.isActive,
        }}
        isEdit
      />
    </div>
  )
}
