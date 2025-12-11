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

interface Transaction {
  id: string
  type: string
  quantity: number
  previousQty: number
  newQty: number
  referenceType: string | null
  referenceId: string | null
  notes: string | null
  createdAt: string
  item: {
    id: string
    sku: string
    name: string
  }
  location: {
    id: string
    barcode: string
    name: string | null
  }
  user: {
    id: string
    name: string | null
    email: string
  } | null
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

const TRANSACTION_TYPES = [
  { value: 'RECEIVE', label: 'Receive', color: 'bg-green-100 text-green-800' },
  { value: 'SHIP', label: 'Ship', color: 'bg-blue-100 text-blue-800' },
  { value: 'ADJUST', label: 'Adjust', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'TRANSFER', label: 'Transfer', color: 'bg-purple-100 text-purple-800' },
  { value: 'RESERVE', label: 'Reserve', color: 'bg-orange-100 text-orange-800' },
  { value: 'UNRESERVE', label: 'Unreserve', color: 'bg-gray-100 text-gray-800' },
  { value: 'DAMAGE', label: 'Damage', color: 'bg-red-100 text-red-800' },
]

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', pagination.page.toString())
      params.set('limit', pagination.limit.toString())
      if (typeFilter) params.set('type', typeFilter)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const response = await fetch(`/api/warehouse/inventory/transactions?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch transactions')
      }

      const data = await response.json()
      setTransactions(data.data || [])
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
  }, [pagination.page, pagination.limit, typeFilter, startDate, endDate])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [typeFilter, startDate, endDate])

  const getTypeBadge = (type: string) => {
    const typeConfig = TRANSACTION_TYPES.find((t) => t.value === type)
    return (
      <Badge className={typeConfig?.color || 'bg-gray-100 text-gray-800'}>
        {typeConfig?.label || type}
      </Badge>
    )
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/warehouse/inventory" className="hover:text-emerald-600">
              Inventory
            </Link>
            <span>/</span>
            <span>Transactions</span>
          </div>
          <h1 className="text-2xl font-bold">Transaction History</h1>
          <p className="text-gray-600">View all inventory movements and adjustments</p>
        </div>
        <Link href="/warehouse/inventory">
          <Button variant="outline">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Inventory
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-gray-600 block mb-1">Transaction Type</label>
            <Select
              value={typeFilter || '_all'}
              onValueChange={(v) => setTypeFilter(v === '_all' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Types</SelectItem>
                {TRANSACTION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">End Date</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setTypeFilter('')
                setStartDate('')
                setEndDate('')
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
              <TableHead>Date/Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead className="text-right">Before</TableHead>
              <TableHead className="text-right">After</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Notes</TableHead>
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
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <div className="text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="mb-2">No transactions found</p>
                    <p className="text-sm">Stock adjustments and transfers will appear here.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="text-sm text-gray-600">
                    {formatDateTime(txn.createdAt)}
                  </TableCell>
                  <TableCell>{getTypeBadge(txn.type)}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-mono text-sm">{txn.item.sku}</div>
                      <div className="text-xs text-gray-500">{txn.item.name}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {txn.location.barcode}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${txn.quantity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {txn.quantity >= 0 ? '+' : ''}{txn.quantity}
                  </TableCell>
                  <TableCell className="text-right text-gray-500">
                    {txn.previousQty}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {txn.newQty}
                  </TableCell>
                  <TableCell className="text-sm">
                    {txn.user?.name || txn.user?.email || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                    {txn.notes || '-'}
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
              {pagination.total} transactions
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
