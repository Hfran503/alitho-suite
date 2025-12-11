import Link from 'next/link'
import { WarehouseForm } from '@/components/warehouse/warehouses/WarehouseForm'

export default function NewWarehousePage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/warehouse/warehouses" className="hover:text-emerald-600">
            Warehouses
          </Link>
          <span>/</span>
          <span>New Warehouse</span>
        </div>
        <h1 className="text-2xl font-bold">Create New Warehouse</h1>
        <p className="text-gray-600">Add a new warehouse facility to your operations</p>
      </div>

      <WarehouseForm />
    </div>
  )
}
