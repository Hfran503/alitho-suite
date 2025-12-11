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

interface ASN {
  id: string
  asnNumber: string
  vendorName: string
  expectedDate: string
  carrier: string | null
  trackingNumber: string | null
  poNumber: string | null
  status: string
  warehouse: {
    id: string
    name: string
  }
  items: Array<{
    id: string
    sku: string
    expectedQty: number
    receivedQty: number
  }>
  createdAt: string
}

interface Warehouse {
  id: string
  name: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  IN_TRANSIT: { label: 'In Transit', color: 'bg-blue-100 text-blue-800' },
  ARRIVED: { label: 'Arrived', color: 'bg-purple-100 text-purple-800' },
  RECEIVING: { label: 'Receiving', color: 'bg-orange-100 text-orange-800' },
  RECEIVED: { label: 'Received', color: 'bg-green-100 text-green-800' },
  PARTIALLY_RECEIVED: { label: 'Partial', color: 'bg-amber-100 text-amber-800' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
}

export default function ASNListPage() {
  const [asns, setAsns] = useState<ASN[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')

  const fetchASNs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', pagination.page.toString())
      params.set('limit', pagination.limit.toString())
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (warehouseFilter) params.set('warehouseId', warehouseFilter)

      const response = await fetch(`/api/warehouse/asn?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch ASNs')
      }

      const data = await response.json()
      setAsns(data.data || [])
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
  }, [pagination.page, pagination.limit, search, statusFilter, warehouseFilter])

  // Fetch warehouses on mount
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

  useEffect(() => {
    fetchASNs()
  }, [fetchASNs])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [search, statusFilter, warehouseFilter])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getItemsSummary = (items: ASN['items']) => {
    const totalExpected = items.reduce((sum, item) => sum + item.expectedQty, 0)
    const totalReceived = items.reduce((sum, item) => sum + item.receivedQty, 0)
    return { totalExpected, totalReceived, lineCount: items.length }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Advanced Shipping Notices</h1>
          <p className="text-gray-600">Manage inbound shipment notifications</p>
        </div>
        <Link href="/warehouse/asn/new">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New ASN
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <Input
              placeholder="Search by ASN#, vendor, PO, tracking..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <Select
              value={statusFilter || '_all'}
              onValueChange={(v) => setStatusFilter(v === '_all' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <div>
            <Button
              variant="outline"
              onClick={() => {
                setSearch('')
                setStatusFilter('')
                setWarehouseFilter('')
              }}
              className="w-full"
            >
              Clear Filters
            </Button>
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
              <TableHead>ASN #</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tracking</TableHead>
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
            ) : asns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="mb-2">No ASNs found</p>
                    <p className="text-sm">Create your first ASN to start tracking inbound shipments.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              asns.map((asn) => {
                const summary = getItemsSummary(asn.items)
                const statusConfig = STATUS_CONFIG[asn.status] || { label: asn.status, color: 'bg-gray-100' }
                return (
                  <TableRow key={asn.id}>
                    <TableCell>
                      <Link href={`/warehouse/asn/${asn.id}`} className="font-mono font-medium text-emerald-600 hover:underline">
                        {asn.asnNumber}
                      </Link>
                      {asn.poNumber && (
                        <div className="text-xs text-gray-500">PO: {asn.poNumber}</div>
                      )}
                    </TableCell>
                    <TableCell>{asn.vendorName}</TableCell>
                    <TableCell className="text-sm">{asn.warehouse.name}</TableCell>
                    <TableCell className="text-sm">{formatDate(asn.expectedDate)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {summary.lineCount} line{summary.lineCount !== 1 ? 's' : ''}
                        <div className="text-xs text-gray-500">
                          {summary.totalReceived}/{summary.totalExpected} units
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig.color}>
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {asn.trackingNumber ? (
                        <div>
                          <div className="text-gray-500">{asn.carrier || 'N/A'}</div>
                          <div>{asn.trackingNumber}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/warehouse/asn/${asn.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-gray-600">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} ASNs
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
