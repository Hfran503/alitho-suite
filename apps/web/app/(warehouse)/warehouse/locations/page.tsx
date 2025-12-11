'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

interface WarehouseLocation {
  id: string
  barcode: string
  name: string | null
  zone: string | null
  aisle: string | null
  rack: string | null
  shelf: string | null
  bin: string | null
  locationType: 'RECEIVING' | 'STORAGE' | 'SHIPPING' | 'STAGING' | 'QUARANTINE'
  maxCapacity: number | null
  isActive: boolean
  warehouse: Warehouse
  createdAt: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

const locationTypeColors: Record<string, string> = {
  RECEIVING: 'bg-blue-100 text-blue-800',
  STORAGE: 'bg-green-100 text-green-800',
  SHIPPING: 'bg-purple-100 text-purple-800',
  STAGING: 'bg-yellow-100 text-yellow-800',
  QUARANTINE: 'bg-red-100 text-red-800',
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<WarehouseLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [zoneFilter, setZoneFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [availableZones, setAvailableZones] = useState<string[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseFilter, setWarehouseFilter] = useState<string>('')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch warehouses for filter
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

  // Fetch locations
  const fetchLocations = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', pagination.page.toString())
      params.set('limit', pagination.limit.toString())
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (zoneFilter) params.set('zone', zoneFilter)
      if (typeFilter) params.set('locationType', typeFilter)
      if (statusFilter) params.set('isActive', statusFilter)
      if (warehouseFilter) params.set('warehouseId', warehouseFilter)

      const response = await fetch(`/api/warehouse/locations?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch locations')
      }

      const data = await response.json()
      setLocations(data.data || [])
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0,
      }))
      setAvailableZones(data.filters?.zones || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, debouncedSearch, zoneFilter, typeFilter, statusFilter, warehouseFilter])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }))
  }, [debouncedSearch, zoneFilter, typeFilter, statusFilter, warehouseFilter])

  const handleToggleStatus = async (location: WarehouseLocation) => {
    try {
      const response = await fetch(`/api/warehouse/locations/${location.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !location.isActive }),
      })

      if (response.ok) {
        fetchLocations()
      }
    } catch (err) {
      console.error('Error toggling location status:', err)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Locations</h1>
          <p className="text-gray-600">Manage warehouse storage locations and bins</p>
        </div>
        <div className="flex gap-2">
          <Link href="/warehouse/locations/bulk">
            <Button variant="outline">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Bulk Create
            </Button>
          </Link>
          <Link href="/warehouse/locations/new">
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Location
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Input
              placeholder="Search by barcode or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Select value={warehouseFilter || '_all'} onValueChange={(v) => setWarehouseFilter(v === '_all' ? '' : v)}>
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
            <Select value={zoneFilter || '_all'} onValueChange={(v) => setZoneFilter(v === '_all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All Zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Zones</SelectItem>
                {availableZones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    Zone {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={typeFilter || '_all'} onValueChange={(v) => setTypeFilter(v === '_all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Types</SelectItem>
                <SelectItem value="RECEIVING">Receiving</SelectItem>
                <SelectItem value="STORAGE">Storage</SelectItem>
                <SelectItem value="SHIPPING">Shipping</SelectItem>
                <SelectItem value="STAGING">Staging</SelectItem>
                <SelectItem value="QUARANTINE">Quarantine</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={statusFilter || '_all'} onValueChange={(v) => setStatusFilter(v === '_all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Status</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Barcode</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin h-6 w-6 text-emerald-600 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : locations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                  No locations found. Create your first location to get started.
                </TableCell>
              </TableRow>
            ) : (
              locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-mono font-medium">{location.barcode}</TableCell>
                  <TableCell>{location.name || '-'}</TableCell>
                  <TableCell>{location.warehouse.name}</TableCell>
                  <TableCell>{location.zone || '-'}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {[location.aisle, location.rack, location.shelf, location.bin]
                      .filter(Boolean)
                      .join('-') || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge className={locationTypeColors[location.locationType]}>
                      {location.locationType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={location.isActive ? 'default' : 'secondary'}>
                      {location.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/warehouse/locations/${location.id}`}>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(location)}
                        className={location.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                      >
                        {location.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-gray-600">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} locations
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
