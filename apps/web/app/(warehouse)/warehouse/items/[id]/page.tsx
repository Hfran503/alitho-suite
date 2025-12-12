'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { InventoryItemForm } from '@/components/warehouse/items/InventoryItemForm'

type ItemType = 'STANDARD' | 'KIT_COMPONENT' | 'KIT_AND_COMPONENT' | 'KIT'

interface InventoryItemData {
  id: string
  customerId: string | null
  sku: string
  upc: string | null
  name: string
  description: string | null
  category: string | null
  itemType: ItemType
  weight: number | null
  dimensions: {
    length?: number
    width?: number
    height?: number
    unit?: 'in' | 'cm'
  } | null
  isActive: boolean
  trackByReference: boolean
  // Pricing
  sellPrice: number | null
  // Bulk ordering
  canOrderInBulk: boolean
  bulkUnitName: string | null
  unitsPerBulk: number | null
  bulkSellPrice: number | null
}

export default function EditInventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [item, setItem] = useState<InventoryItemData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchItem() {
      try {
        const response = await fetch(`/api/warehouse/items/${id}`)
        if (!response.ok) {
          throw new Error('Item not found')
        }
        const data = await response.json()
        setItem(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchItem()
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

  if (error || !item) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
        <p className="text-red-600">{error || 'Item not found'}</p>
        <Link href="/warehouse/items" className="text-emerald-600 hover:underline mt-4 inline-block">
          Back to Items
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/warehouse/items" className="hover:text-emerald-600">
            Inventory Items
          </Link>
          <span>/</span>
          <span>{item.sku}</span>
        </div>
        <h1 className="text-2xl font-bold">Edit Item</h1>
        <p className="text-gray-600">Update details for {item.name}</p>
      </div>

      <InventoryItemForm
        initialData={{
          id: item.id,
          customerId: item.customerId || null,
          sku: item.sku,
          upc: item.upc || '',
          name: item.name,
          description: item.description || '',
          category: item.category || '',
          itemType: item.itemType || 'STANDARD',
          weight: item.weight?.toString() || '',
          length: item.dimensions?.length?.toString() || '',
          width: item.dimensions?.width?.toString() || '',
          height: item.dimensions?.height?.toString() || '',
          dimensionUnit: item.dimensions?.unit || 'in',
          isActive: item.isActive,
          trackByReference: item.trackByReference,
          sellPrice: item.sellPrice?.toString() || '',
          canOrderInBulk: item.canOrderInBulk || false,
          bulkUnitName: item.bulkUnitName || '',
          unitsPerBulk: item.unitsPerBulk?.toString() || '',
          bulkSellPrice: item.bulkSellPrice?.toString() || '',
        }}
        isEdit
      />
    </div>
  )
}
