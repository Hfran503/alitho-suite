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

interface InventoryItem {
  item: {
    id: string
    sku: string
    name: string
    category: string | null
    isActive: boolean
  }
  totalAvailable: number
  totalReserved: number
  totalDamaged: number
  totalOnHold: number
  totalQuantity: number
  locationCount: number
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
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
  const [warehouseFilter, setWarehouseFilter] = useState<string>('')
  const [lowStockFilter, setLowStockFilter] = useState(false)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

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

  // Fetch inventory
  const fetchInventory = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', pagination.page.toString())
      params.set('limit', pagination.limit.toString())
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (warehouseFilter) params.set('warehouseId', warehouseFilter)
      if (lowStockFilter) params.set('lowStock', 'true')

      const response = await fetch(`/api/warehouse/inventory?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch inventory')
      }

      const data = await response.json()
      setInventory(data.data || [])
      setPagination((prev) => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, debouncedSearch, warehouseFilter, lowStockFilter])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [debouncedSearch, warehouseFilter, lowStockFilter])

  const getStockStatusBadge = (available: number, reserved: number) => {
    if (available === 0 && reserved === 0) {
      return <Badge variant="secondary">No Stock</Badge>
    }
    if (available === 0) {
      return <Badge className="bg-red-100 text-red-800">Out of Stock</Badge>
    }
    if (available < 10) {
      return <Badge className="bg-yellow-100 text-yellow-800">Low Stock</Badge>
    }
    return <Badge className="bg-green-100 text-green-800">In Stock</Badge>
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-gray-600">View and manage stock levels across all locations</p>
        </div>
        <div className="flex gap-2">
          <Link href="/warehouse/inventory/transactions">
            <Button variant="outline">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Transactions
            </Button>
          </Link>
          <Link href="/warehouse/inventory/transfer">
            <Button variant="outline">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Transfer
            </Button>
          </Link>
          <Link href="/warehouse/inventory/adjust">
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Adjust Stock
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <Input
              placeholder="Search by SKU or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Select
              value={warehouseFilter || '_all'}
              onValueChange={(v) => setWarehouseFilter(v === '_all' ? '' : v)}
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={lowStockFilter}
              onClick={() => setLowStockFilter(!lowStockFilter)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                lowStockFilter ? 'bg-emerald-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  lowStockFilter ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-gray-600">Show only low/out of stock</span>
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
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Damaged</TableHead>
              <TableHead className="text-right">Locations</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin h-6 w-6 text-emerald-600 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : inventory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <div className="text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p className="mb-2">No inventory found</p>
                    <p className="text-sm">Add stock using the Adjust Stock button.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              inventory.map((inv) => (
                <TableRow key={inv.item.id}>
                  <TableCell className="font-mono font-medium">{inv.item.sku}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{inv.item.name}</div>
                      {!inv.item.isActive && (
                        <span className="text-xs text-gray-500">(Inactive)</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {inv.item.category ? (
                      <Badge variant="outline">{inv.item.category}</Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    {inv.totalAvailable}
                  </TableCell>
                  <TableCell className="text-right text-yellow-600">
                    {inv.totalReserved}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {inv.totalDamaged}
                  </TableCell>
                  <TableCell className="text-right">
                    {inv.locationCount}
                  </TableCell>
                  <TableCell>
                    {getStockStatusBadge(inv.totalAvailable, inv.totalReserved)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/warehouse/inventory/${inv.item.id}`}>
                      <Button variant="ghost" size="sm">
                        View Details
                      </Button>
                    </Link>
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
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} items
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
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
