'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Warehouse {
  id: string
  name: string
}

interface ReceivingRecord {
  id: string
  status: 'IN_PROGRESS' | 'COMPLETED' | 'COMPLETED_WITH_DISCREPANCY'
  notes: string | null
  createdAt: string
  completedAt: string | null
  asn: {
    id: string
    asnNumber: string
    vendorName: string
  } | null
  warehouse: {
    id: string
    name: string
  }
  receivedBy: {
    id: string
    name: string | null
    email: string
  }
  _count: {
    items: number
  }
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

const statusColors: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  COMPLETED_WITH_DISCREPANCY: 'bg-yellow-100 text-yellow-800',
}

const statusLabels: Record<string, string> = {
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  COMPLETED_WITH_DISCREPANCY: 'With Discrepancy',
}

export default function ReceivingPage() {
  const [loading, setLoading] = useState(true)
  const [receivingRecords, setReceivingRecords] = useState<ReceivingRecord[]>([])
  const [pendingASNs, setPendingASNs] = useState<ASN[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20 })

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all')

  const fetchReceivingRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: ((pagination.page - 1) * pagination.limit).toString(),
      })

      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      if (warehouseFilter !== 'all') {
        params.append('warehouseId', warehouseFilter)
      }

      const response = await fetch(`/api/warehouse/receiving?${params}`)
      if (response.ok) {
        const data = await response.json()
        setReceivingRecords(data.data || [])
        setPagination((prev) => ({ ...prev, total: data.pagination?.total || 0 }))
      }
    } catch (err) {
      console.error('Error fetching receiving records:', err)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, statusFilter, warehouseFilter])

  // Fetch pending ASNs (ARRIVED status, ready to receive)
  const fetchPendingASNs = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        status: 'ARRIVED',
        limit: '10',
      })

      const response = await fetch(`/api/warehouse/asn?${params}`)
      if (response.ok) {
        const data = await response.json()
        setPendingASNs(data.data || [])
      }
    } catch (err) {
      console.error('Error fetching pending ASNs:', err)
    }
  }, [])

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

  useEffect(() => {
    fetchReceivingRecords()
    fetchPendingASNs()
  }, [fetchReceivingRecords, fetchPendingASNs])

  const handleStartReceiving = async (asnId: string) => {
    try {
      const response = await fetch(`/api/warehouse/receiving/from-asn/${asnId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (response.ok) {
        const data = await response.json()
        // Navigate to the receiving session
        window.location.href = `/warehouse/receiving/${data.data.id}`
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to start receiving')
      }
    } catch (err) {
      console.error('Error starting receiving:', err)
      alert('Failed to start receiving')
    }
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/warehouse" className="hover:text-emerald-600">
              Warehouse
            </Link>
            <span>/</span>
            <span>Receiving</span>
          </div>
          <h1 className="text-2xl font-bold">Receiving</h1>
          <p className="text-gray-600">Process inbound shipments and update inventory</p>
        </div>
        <Link href="/warehouse/receiving/new">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Start Receiving
          </Button>
        </Link>
      </div>

      {/* Pending ASNs */}
      {pendingASNs.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-amber-800 mb-3">
            <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Pending ASNs Ready to Receive ({pendingASNs.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingASNs.map((asn) => (
              <div key={asn.id} className="bg-white rounded-lg p-3 border border-amber-200 flex items-center justify-between">
                <div>
                  <p className="font-medium">{asn.asnNumber}</p>
                  <p className="text-sm text-gray-600">{asn.vendorName}</p>
                  <p className="text-xs text-gray-500">{asn._count.items} items</p>
                </div>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleStartReceiving(asn.id)}
                >
                  Receive
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="w-48">
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v)
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="COMPLETED_WITH_DISCREPANCY">With Discrepancy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-48">
            <Select
              value={warehouseFilter}
              onValueChange={(v) => {
                setWarehouseFilter(v)
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Warehouses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warehouses</SelectItem>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Receiving Records Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>ASN</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Received By</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin h-6 w-6 text-emerald-600" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="ml-2">Loading...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : receivingRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  No receiving records found
                </TableCell>
              </TableRow>
            ) : (
              receivingRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[record.status]}`}>
                      {statusLabels[record.status]}
                    </span>
                  </TableCell>
                  <TableCell>
                    {record.asn ? (
                      <Link href={`/warehouse/asn/${record.asn.id}`} className="text-emerald-600 hover:underline">
                        {record.asn.asnNumber}
                      </Link>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {record.asn?.vendorName || <span className="text-gray-400">-</span>}
                  </TableCell>
                  <TableCell>{record.warehouse.name}</TableCell>
                  <TableCell>{record._count.items}</TableCell>
                  <TableCell>
                    <span className="text-sm">{record.receivedBy.name || record.receivedBy.email}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {new Date(record.createdAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link href={`/warehouse/receiving/${record.id}`}>
                      <Button variant="outline" size="sm">
                        {record.status === 'IN_PROGRESS' ? 'Continue' : 'View'}
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-gray-600">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= totalPages}
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
