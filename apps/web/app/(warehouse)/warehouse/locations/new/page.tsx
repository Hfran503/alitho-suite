import Link from 'next/link'
import { LocationForm } from '@/components/warehouse/locations/LocationForm'

export default function NewLocationPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/warehouse/locations" className="hover:text-emerald-600">
            Locations
          </Link>
          <span>/</span>
          <span>New Location</span>
        </div>
        <h1 className="text-2xl font-bold">Create New Location</h1>
        <p className="text-gray-600">Add a new storage location to your warehouse</p>
      </div>

      <LocationForm />
    </div>
  )
}
