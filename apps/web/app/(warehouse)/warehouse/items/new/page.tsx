'use client'

import Link from 'next/link'
import { InventoryItemForm } from '@/components/warehouse/items/InventoryItemForm'

export default function NewInventoryItemPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/warehouse/items" className="hover:text-emerald-600">
            Inventory Items
          </Link>
          <span>/</span>
          <span>New Item</span>
        </div>
        <h1 className="text-2xl font-bold">Create Inventory Item</h1>
        <p className="text-gray-600">Add a new SKU to your inventory catalog</p>
      </div>

      <InventoryItemForm />
    </div>
  )
}
