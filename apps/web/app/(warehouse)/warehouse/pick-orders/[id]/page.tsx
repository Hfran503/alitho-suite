'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

interface AvailableStock {
  locationId: string
  location: {
    id: string
    barcode: string
    name: string | null
  }
  available: number
  referenceNumber: string | null
  lotNumber: string | null
}

interface PickOrderItem {
  id: string
  itemId: string
  locationId: string | null
  referenceNumber: string | null
  lotNumber: string | null
  requestedQty: number
  pickedQty: number
  isPicked: boolean
  pickedAt: string | null
  notes: string | null
  item: {
    id: string
    sku: string
    name: string
    trackByReference: boolean
    customer: {
      id: string
      name: string
      company: string | null
    } | null
  }
  location: {
    id: string
    barcode: string
    name: string | null
  } | null
  availableStock: AvailableStock[]
}

interface PickOrder {
  id: string
  pickOrderNumber: string
  status: 'DRAFT' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  destination: string
  destinationNotes: string | null
  priority: string
  notes: string | null
  createdAt: string
  completedAt: string | null
  createdBy: {
    id: string
    name: string | null
    email: string
  } | null
  items: PickOrderItem[]
  stats: {
    totalItems: number
    pickedItems: number
    totalRequestedQty: number
    totalPickedQty: number
    progress: number
  }
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
}

export default function PickOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [pickOrder, setPickOrder] = useState<PickOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Pick dialog state
  const [pickDialogOpen, setPickDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<PickOrderItem | null>(null)
  const [pickLocationId, setPickLocationId] = useState<string>('')
  const [pickQty, setPickQty] = useState<number>(0)
  const [picking, setPicking] = useState(false)

  // Complete dialog state
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completeNotes, setCompleteNotes] = useState('')

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const fetchPickOrder = async () => {
    try {
      const response = await fetch(`/api/warehouse/pick-orders/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch pick order')
      }
      const data = await response.json()
      setPickOrder(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPickOrder()
  }, [id])

  const openPickDialog = (item: PickOrderItem) => {
    setSelectedItem(item)
    // Default to first available location or existing location
    const defaultLocation = item.locationId || item.availableStock[0]?.locationId || ''
    setPickLocationId(defaultLocation)
    setPickQty(item.requestedQty)
    setPickDialogOpen(true)
  }

  const handlePick = async () => {
    if (!selectedItem || !pickLocationId) return

    setPicking(true)
    try {
      const selectedStock = selectedItem.availableStock.find(s => s.locationId === pickLocationId)

      const response = await fetch(`/api/warehouse/pick-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          locationId: pickLocationId,
          referenceNumber: selectedStock?.referenceNumber || selectedItem.referenceNumber,
          lotNumber: selectedStock?.lotNumber || selectedItem.lotNumber,
          pickedQty: pickQty,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to pick item')
      }

      setPickDialogOpen(false)
      await fetchPickOrder()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to pick item')
    } finally {
      setPicking(false)
    }
  }

  const handleComplete = async () => {
    setCompleting(true)
    try {
      const response = await fetch(`/api/warehouse/pick-orders/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: completeNotes || undefined }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to complete pick order')
      }

      setCompleteDialogOpen(false)
      await fetchPickOrder()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to complete pick order')
    } finally {
      setCompleting(false)
    }
  }

  const handleCancel = async () => {
    setCancelling(true)
    try {
      const response = await fetch(`/api/warehouse/pick-orders/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to cancel pick order')
      }

      router.push('/warehouse/pick-orders')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel pick order')
      setCancelling(false)
    }
  }

  const handleStartPicking = async () => {
    try {
      const response = await fetch(`/api/warehouse/pick-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start picking')
      }

      await fetchPickOrder()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start picking')
    }
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

  if (error || !pickOrder) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
        <p className="text-red-600">{error || 'Pick order not found'}</p>
        <Link href="/warehouse/pick-orders" className="text-emerald-600 hover:underline mt-4 inline-block">
          Back to Pick Orders
        </Link>
      </div>
    )
  }

  const canPick = ['PENDING', 'IN_PROGRESS'].includes(pickOrder.status)
  const canComplete = pickOrder.status === 'IN_PROGRESS' && pickOrder.stats.progress === 100
  const allItemsPicked = pickOrder.items.every(item => item.isPicked)

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
            <Link href="/warehouse/pick-orders" className="hover:text-emerald-600">
              Pick Orders
            </Link>
            <span>/</span>
            <span>{pickOrder.pickOrderNumber}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{pickOrder.pickOrderNumber}</h1>
            <Badge className={statusColors[pickOrder.status]}>
              {statusLabels[pickOrder.status]}
            </Badge>
            <Badge variant="outline" className={priorityColors[pickOrder.priority]}>
              {pickOrder.priority.charAt(0).toUpperCase() + pickOrder.priority.slice(1)} Priority
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/print/pick-order/${id}`} target="_blank">
            <Button variant="outline">
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </Button>
          </Link>
          {pickOrder.status === 'PENDING' && (
            <Button onClick={handleStartPicking} className="bg-emerald-600 hover:bg-emerald-700">
              Start Picking
            </Button>
          )}
          {canComplete && allItemsPicked && (
            <Button onClick={() => setCompleteDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
              Complete Order
            </Button>
          )}
          {['PENDING', 'IN_PROGRESS'].includes(pickOrder.status) && (
            <Button variant="outline" onClick={() => setCancelDialogOpen(true)} className="text-red-600 border-red-300 hover:bg-red-50">
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {['IN_PROGRESS', 'COMPLETED'].includes(pickOrder.status) && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-gray-600">
              {pickOrder.stats.pickedItems}/{pickOrder.stats.totalItems} items picked
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${pickOrder.status === 'COMPLETED' ? 'bg-green-500' : 'bg-emerald-500'}`}
              style={{ width: `${pickOrder.stats.progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {pickOrder.stats.totalPickedQty} of {pickOrder.stats.totalRequestedQty} units picked
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items to Pick */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Items to Pick</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Ref #</TableHead>
                  <TableHead className="text-center">Requested</TableHead>
                  <TableHead className="text-center">Picked</TableHead>
                  <TableHead>Status</TableHead>
                  {canPick && <TableHead className="w-24"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pickOrder.items.map((item) => (
                  <TableRow key={item.id} className={item.isPicked ? 'bg-green-50' : ''}>
                    <TableCell>
                      <div>
                        <p className="font-mono font-medium">{item.item.sku}</p>
                        <p className="text-sm text-gray-600">{item.item.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.item.customer ? (
                        <span className="text-sm">{item.item.customer.name}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.location ? (
                        <span className="font-mono">{item.location.barcode}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.referenceNumber ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {item.referenceNumber}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {item.requestedQty}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={item.isPicked ? 'text-green-600 font-medium' : 'text-gray-400'}>
                        {item.pickedQty}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.isPicked ? (
                        <Badge className="bg-green-100 text-green-800">Picked</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-600">Pending</Badge>
                      )}
                    </TableCell>
                    {canPick && (
                      <TableCell>
                        {!item.isPicked && (
                          <Button
                            size="sm"
                            onClick={() => openPickDialog(item)}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            Pick
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Order Details */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Order Details</h2>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-600">Destination</Label>
                <p className="font-medium">{pickOrder.destination}</p>
                {pickOrder.destinationNotes && (
                  <p className="text-sm text-gray-500 mt-1">{pickOrder.destinationNotes}</p>
                )}
              </div>

              <div>
                <Label className="text-gray-600">Created</Label>
                <p className="font-medium">
                  {new Date(pickOrder.createdAt).toLocaleString()}
                </p>
              </div>

              <div>
                <Label className="text-gray-600">Ordered By</Label>
                <p className="font-medium">
                  {pickOrder.createdBy?.name || pickOrder.createdBy?.email || 'Unknown'}
                </p>
              </div>

              {pickOrder.completedAt && (
                <div>
                  <Label className="text-gray-600">Completed</Label>
                  <p className="font-medium">
                    {new Date(pickOrder.completedAt).toLocaleString()}
                  </p>
                </div>
              )}

              {pickOrder.notes && (
                <div>
                  <Label className="text-gray-600">Notes</Label>
                  <p className="text-sm whitespace-pre-wrap">{pickOrder.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pick Dialog */}
      <Dialog open={pickDialogOpen} onOpenChange={setPickDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pick Item</DialogTitle>
            <DialogDescription>
              {selectedItem && (
                <span>
                  <strong>{selectedItem.item.sku}</strong> - {selectedItem.item.name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Pick from Location</Label>
                <Select value={pickLocationId} onValueChange={setPickLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedItem.availableStock.map((stock) => (
                      <SelectItem key={`${stock.locationId}-${stock.referenceNumber || ''}`} value={stock.locationId}>
                        <div className="flex items-center justify-between w-full">
                          <span className="font-mono">{stock.location.barcode}</span>
                          <span className="text-emerald-600 ml-2">({stock.available} avail)</span>
                          {stock.referenceNumber && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {stock.referenceNumber}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantity to Pick</Label>
                <Input
                  type="number"
                  min={0}
                  max={selectedItem.requestedQty}
                  value={pickQty}
                  onChange={(e) => setPickQty(parseInt(e.target.value) || 0)}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Requested: {selectedItem.requestedQty}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPickDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePick}
              disabled={picking || !pickLocationId || pickQty <= 0}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {picking ? 'Picking...' : 'Confirm Pick'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Pick Order</DialogTitle>
            <DialogDescription>
              This will finalize the pick order and decrement inventory for all picked items.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-emerald-800">
                <strong>{pickOrder.stats.totalItems}</strong> items ({pickOrder.stats.totalPickedQty} units) will be
                removed from inventory and sent to <strong>{pickOrder.destination}</strong>.
              </p>
            </div>

            <div>
              <Label>Completion Notes (optional)</Label>
              <Input
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                placeholder="Any additional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={completing}
              className="bg-green-600 hover:bg-green-700"
            >
              {completing ? 'Completing...' : 'Complete Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Pick Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this pick order? No inventory changes will be made.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Order
            </Button>
            <Button
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
