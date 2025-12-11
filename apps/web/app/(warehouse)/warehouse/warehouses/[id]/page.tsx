'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { WarehouseForm } from '@/components/warehouse/warehouses/WarehouseForm'

interface WarehouseData {
  id: string
  name: string
  companyName: string | null
  addressLine1: string
  addressLine2: string | null
  cityLocality: string
  stateProvince: string
  postalCode: string
  countryCode: string
  phone: string | null
  isDefault: boolean
  warehouseType: 'STORAGE_FACILITY' | 'BOTH'
}

export default function EditWarehousePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [warehouse, setWarehouse] = useState<WarehouseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchWarehouse() {
      try {
        const response = await fetch(`/api/warehouses/${id}`)
        if (!response.ok) {
          throw new Error('Warehouse not found')
        }
        const data = await response.json()
        setWarehouse(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchWarehouse()
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

  if (error || !warehouse) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
        <p className="text-red-600">{error || 'Warehouse not found'}</p>
        <Link href="/warehouse/warehouses" className="text-emerald-600 hover:underline mt-4 inline-block">
          Back to Warehouses
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/warehouse/warehouses" className="hover:text-emerald-600">
            Warehouses
          </Link>
          <span>/</span>
          <span>{warehouse.name}</span>
        </div>
        <h1 className="text-2xl font-bold">Edit Warehouse</h1>
        <p className="text-gray-600">Update warehouse details for {warehouse.name}</p>
      </div>

      <WarehouseForm
        initialData={{
          id: warehouse.id,
          name: warehouse.name,
          companyName: warehouse.companyName || '',
          addressLine1: warehouse.addressLine1,
          addressLine2: warehouse.addressLine2 || '',
          cityLocality: warehouse.cityLocality,
          stateProvince: warehouse.stateProvince,
          postalCode: warehouse.postalCode,
          countryCode: warehouse.countryCode,
          phone: warehouse.phone || '',
          isDefault: warehouse.isDefault,
          warehouseType: warehouse.warehouseType,
        }}
        isEdit
      />
    </div>
  )
}
