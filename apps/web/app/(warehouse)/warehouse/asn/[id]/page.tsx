'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ASNItem {
  id: string
  itemId: string | null
  sku: string
  description: string
  expectedQty: number
  receivedQty: number
  lotNumber: string | null
  expirationDate: string | null
  item: {
    id: string
    sku: string
    name: string
  } | null
}

interface ReceivingRecord {
  id: string
  status: string
}

interface ASN {
  id: string
  asnNumber: string
  vendorName: string
  vendorEmail: string | null
  expectedDate: string
  carrier: string | null
  trackingNumber: string | null
  poNumber: string | null
  status: string
  notes: string | null
  arrivedAt: string | null
  receivedAt: string | null
  createdAt: string
  updatedAt: string
  warehouse: {
    id: string
    name: string
  }
  items: ASNItem[]
  receivingRecord: ReceivingRecord | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Draft', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  PENDING: { label: 'Pending', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  IN_TRANSIT: { label: 'In Transit', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  ARRIVED: { label: 'Arrived', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  RECEIVING: { label: 'Receiving', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  RECEIVED: { label: 'Received', color: 'text-green-700', bgColor: 'bg-green-100' },
  PARTIALLY_RECEIVED: { label: 'Partially Received', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100' },
}

const STATUS_ACTIONS: Record<string, { next: string; label: string; variant: 'default' | 'outline' | 'destructive' }[]> = {
  DRAFT: [
    { next: 'PENDING', label: 'Submit', variant: 'default' },
    { next: 'CANCELLED', label: 'Cancel', variant: 'destructive' },
  ],
  PENDING: [
    { next: 'IN_TRANSIT', label: 'Mark In Transit', variant: 'outline' },
    { next: 'ARRIVED', label: 'Mark Arrived', variant: 'default' },
    { next: 'CANCELLED', label: 'Cancel', variant: 'destructive' },
  ],
  IN_TRANSIT: [
    { next: 'ARRIVED', label: 'Mark Arrived', variant: 'default' },
    { next: 'CANCELLED', label: 'Cancel', variant: 'destructive' },
  ],
  ARRIVED: [
    // Start Receiving is handled separately to create receiving record
    { next: 'CANCELLED', label: 'Cancel', variant: 'destructive' },
  ],
  RECEIVING: [
    // Receiving completion is handled in the Receiving module
  ],
  PARTIALLY_RECEIVED: [
    // Continue receiving is handled in the Receiving module
  ],
  RECEIVED: [],
  CANCELLED: [],
}

export default function ASNDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [asn, setAsn] = useState<ASN | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    async function fetchASN() {
      try {
        const response = await fetch(`/api/warehouse/asn/${id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch ASN')
        }
        const data = await response.json()
        setAsn(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchASN()
  }, [id])

  const updateStatus = async (newStatus: string) => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/warehouse/asn/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update status')
      }

      const data = await response.json()
      setAsn(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setUpdating(false)
    }
  }

  const deleteASN = async () => {
    if (!confirm('Are you sure you want to delete this ASN?')) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/warehouse/asn/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete ASN')
      }

      router.push('/warehouse/asn')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setUpdating(false)
    }
  }

  const startReceiving = async () => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/warehouse/receiving/from-asn/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start receiving')
      }

      const data = await response.json()
      router.push(`/warehouse/receiving/${data.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setUpdating(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

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

  if (error || !asn) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
        <p className="text-red-600">{error || 'ASN not found'}</p>
        <Link href="/warehouse/asn" className="text-emerald-600 hover:underline mt-4 inline-block">
          Back to ASN List
        </Link>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[asn.status] || { label: asn.status, color: 'text-gray-700', bgColor: 'bg-gray-100' }
  const statusActions = STATUS_ACTIONS[asn.status] || []
  const totalExpected = asn.items.reduce((sum, item) => sum + item.expectedQty, 0)
  const totalReceived = asn.items.reduce((sum, item) => sum + item.receivedQty, 0)
  const canEdit = ['DRAFT', 'PENDING'].includes(asn.status)
  const canDelete = ['DRAFT', 'CANCELLED'].includes(asn.status)

  return (
    <div>
      {/* Breadcrumb & Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/warehouse/asn" className="hover:text-emerald-600">
              ASN
            </Link>
            <span>/</span>
            <span>{asn.asnNumber}</span>
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">{asn.asnNumber}</h1>
            <Badge className={`${statusConfig.bgColor} ${statusConfig.color}`}>
              {statusConfig.label}
            </Badge>
          </div>
          <p className="text-gray-600 mt-1">From: {asn.vendorName}</p>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && (
            <Button variant="outline" onClick={deleteASN} disabled={updating} className="text-red-600 border-red-200 hover:bg-red-50">
              Delete
            </Button>
          )}
          {/* Start Receiving button for ARRIVED status */}
          {asn.status === 'ARRIVED' && !asn.receivingRecord && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={startReceiving}
              disabled={updating}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Start Receiving
            </Button>
          )}
          {/* Continue/View Receiving for statuses with active receiving */}
          {['RECEIVING', 'PARTIALLY_RECEIVED'].includes(asn.status) && asn.receivingRecord && (
            <Link href={`/warehouse/receiving/${asn.receivingRecord.id}`}>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                {asn.status === 'RECEIVING' ? 'Continue Receiving' : 'View Receiving'}
              </Button>
            </Link>
          )}
          {/* View Receiving link for RECEIVED status */}
          {asn.status === 'RECEIVED' && asn.receivingRecord && (
            <Link href={`/warehouse/receiving/${asn.receivingRecord.id}`}>
              <Button variant="outline">
                View Receiving
              </Button>
            </Link>
          )}
          {statusActions.map((action) => (
            <Button
              key={action.next}
              variant={action.variant}
              onClick={() => updateStatus(action.next)}
              disabled={updating}
              className={action.variant === 'default' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Status Timeline */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Status Timeline</h2>
        <div className="flex items-center justify-between">
          {['DRAFT', 'PENDING', 'IN_TRANSIT', 'ARRIVED', 'RECEIVING', 'RECEIVED'].map((status, idx) => {
            const config = STATUS_CONFIG[status]
            const isActive = asn.status === status
            const isPast = ['DRAFT', 'PENDING', 'IN_TRANSIT', 'ARRIVED', 'RECEIVING', 'RECEIVED'].indexOf(asn.status) > idx
            const isCancelled = asn.status === 'CANCELLED'

            return (
              <div key={status} className="flex items-center">
                <div className={`flex flex-col items-center ${idx > 0 ? 'ml-4' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isActive ? `${config.bgColor} ${config.color}` :
                    isPast && !isCancelled ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {isPast && !isCancelled && !isActive ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span className={`text-xs mt-1 ${isActive ? 'font-medium' : 'text-gray-500'}`}>
                    {config.label}
                  </span>
                </div>
                {idx < 5 && (
                  <div className={`w-16 h-0.5 mx-2 ${
                    isPast && !isCancelled ? 'bg-green-300' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
        {asn.status === 'CANCELLED' && (
          <div className="mt-4 text-center text-red-600 text-sm">
            This ASN has been cancelled
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ASN Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Shipment Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Shipment Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Expected Date</p>
                <p className="font-medium">{formatDate(asn.expectedDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Destination</p>
                <p className="font-medium">{asn.warehouse.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Carrier</p>
                <p className="font-medium">{asn.carrier || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tracking #</p>
                <p className="font-medium font-mono">{asn.trackingNumber || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">PO Number</p>
                <p className="font-medium">{asn.poNumber || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Vendor Email</p>
                <p className="font-medium">{asn.vendorEmail || '-'}</p>
              </div>
              {asn.arrivedAt && (
                <div>
                  <p className="text-sm text-gray-500">Arrived At</p>
                  <p className="font-medium">{formatDateTime(asn.arrivedAt)}</p>
                </div>
              )}
              {asn.receivedAt && (
                <div>
                  <p className="text-sm text-gray-500">Received At</p>
                  <p className="font-medium">{formatDateTime(asn.receivedAt)}</p>
                </div>
              )}
            </div>
            {asn.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">Notes</p>
                <p className="text-sm">{asn.notes}</p>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Line Items</h2>
              <div className="text-sm text-gray-500">
                {totalReceived}/{totalExpected} units received
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead>Lot #</TableHead>
                  <TableHead>Expiration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asn.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.sku}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.expectedQty}</TableCell>
                    <TableCell className={`text-right font-medium ${
                      item.receivedQty === item.expectedQty ? 'text-green-600' :
                      item.receivedQty > 0 ? 'text-amber-600' : ''
                    }`}>
                      {item.receivedQty}
                    </TableCell>
                    <TableCell className="text-sm">{item.lotNumber || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {item.expirationDate ? formatDate(item.expirationDate) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Line Items</span>
                <span className="font-medium">{asn.items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Expected Units</span>
                <span className="font-medium">{totalExpected}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Received Units</span>
                <span className="font-medium text-green-600">{totalReceived}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Remaining</span>
                <span className={`font-medium ${totalExpected - totalReceived > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {totalExpected - totalReceived}
                </span>
              </div>
            </div>
          </div>

          {/* Activity */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Activity</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span>{formatDateTime(asn.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last Updated</span>
                <span>{formatDateTime(asn.updatedAt)}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          {canEdit && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  Edit functionality will be available in a future update.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
