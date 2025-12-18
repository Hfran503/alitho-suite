'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  ShoppingCart,
  Plus,
  Search,
  Package,
  Truck,
  Loader2,
  MapPin,
  Trash2,
  Eye,
} from 'lucide-react'

interface OrderItem {
  id: string
  quantity: number
  item: {
    id: string
    itemCode: string | null
    sku: string | null
    name: string
  }
}

interface StorefrontOrder {
  id: string
  orderNumber: string
  status: 'CREATED' | 'SHIPPED'
  shipToName: string | null
  shipToCity: string | null
  shipToState: string | null
  trackingNumber: string | null
  carrier: string | null
  shippedAt: string | null
  paceJobNumber: string | null
  createdAt: string
  customer: {
    id: string
    name: string
    company: string | null
    paceCustomerId: string | null
  }
  items: OrderItem[]
  totalItems: number
  _count: {
    items: number
  }
}

const statusColors: Record<string, string> = {
  CREATED: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  CREATED: 'Created',
  SHIPPED: 'Shipped',
  CANCELLED: 'Cancelled',
}

export default function StorefrontOrdersPage() {
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<StorefrontOrder[]>([])
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 })

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  // Ship dialog
  const [shipDialogOpen, setShipDialogOpen] = useState(false)
  const [shippingOrder, setShippingOrder] = useState<StorefrontOrder | null>(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [carrier, setCarrier] = useState('')
  const [shipping, setShipping] = useState(false)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingOrder, setDeletingOrder] = useState<StorefrontOrder | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      })

      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      if (search) {
        params.append('search', search)
      }

      const response = await fetch(`/api/warehouse/storefront-orders?${params}`)
      if (response.ok) {
        const data = await response.json()
        setOrders(data.data || [])
        setPagination(prev => ({ ...prev, total: data.pagination?.total || 0 }))
      }
    } catch (err) {
      console.error('Error fetching orders:', err)
    } finally {
      setLoading(false)
    }
  }, [pagination.limit, pagination.offset, statusFilter, search])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, offset: 0 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const openShipDialog = (order: StorefrontOrder) => {
    setShippingOrder(order)
    setTrackingNumber('')
    setCarrier('')
    setShipDialogOpen(true)
  }

  const handleShip = async () => {
    if (!shippingOrder) return

    setShipping(true)
    try {
      const response = await fetch(`/api/warehouse/storefront-orders/${shippingOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, carrier }),
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: `Order ${shippingOrder.orderNumber} shipped!` })
        setShipDialogOpen(false)
        fetchOrders()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to ship order' })
      }
    } catch (error) {
      console.error('Error shipping order:', error)
      setMessage({ type: 'error', text: 'Failed to ship order' })
    } finally {
      setShipping(false)
    }
  }

  const openDeleteDialog = (order: StorefrontOrder) => {
    setDeletingOrder(order)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingOrder) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/warehouse/storefront-orders/${deletingOrder.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: `Order ${deletingOrder.orderNumber} cancelled` })
        setDeleteDialogOpen(false)
        fetchOrders()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to cancel order' })
      }
    } catch (error) {
      console.error('Error deleting order:', error)
      setMessage({ type: 'error', text: 'Failed to cancel order' })
    } finally {
      setDeleting(false)
    }
  }

  const createdCount = orders.filter(o => o.status === 'CREATED').length

  return (
    <div>
      {/* Message Banner */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/warehouse" className="hover:text-emerald-600">
              Warehouse
            </Link>
            <span>/</span>
            <span>Orders</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-emerald-600" />
            Storefront Orders
          </h1>
          <p className="text-gray-600">Manage customer orders and fulfillment</p>
        </div>
        <Link href="/warehouse/orders/new">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        </Link>
      </div>

      {/* Quick Stats */}
      {createdCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600">Ready to Ship</p>
              <p className="text-2xl font-bold text-blue-800">{createdCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by order # or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="w-44">
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v)
                setPagination(prev => ({ ...prev, offset: 0 }))
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="CREATED">Created</SelectItem>
                <SelectItem value="SHIPPED">Shipped</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>PACE Job</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Ship To</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  No orders found.{' '}
                  <Link href="/warehouse/orders/new" className="text-emerald-600 hover:underline">
                    Create your first order
                  </Link>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link
                      href={`/warehouse/orders/${order.id}`}
                      className="font-mono font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[order.status]}>
                      {statusLabels[order.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {order.paceJobNumber ? (
                      <span className="font-mono text-sm text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                        {order.paceJobNumber}
                      </span>
                    ) : order.customer.paceCustomerId ? (
                      <span className="text-xs text-gray-400">Not sent</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{order.customer.name}</div>
                      {order.customer.company && (
                        <div className="text-sm text-gray-500">{order.customer.company}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.shipToCity && order.shipToState ? (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <MapPin className="h-3 w-3" />
                        {order.shipToCity}, {order.shipToState}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm">{order.totalItems} items</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/warehouse/orders/${order.id}`}>
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      {order.status === 'CREATED' ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => openShipDialog(order)}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <Truck className="h-4 w-4 mr-1" />
                            Ship
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDeleteDialog(order)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <div className="text-sm text-gray-500">
                          {order.trackingNumber && (
                            <span className="font-mono">{order.trackingNumber}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Ship Dialog */}
      <Dialog open={shipDialogOpen} onOpenChange={setShipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ship Order</DialogTitle>
            <DialogDescription>
              Ship order {shippingOrder?.orderNumber} to {shippingOrder?.customer.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="carrier">Carrier (optional)</Label>
              <Input
                id="carrier"
                placeholder="e.g., UPS, FedEx, USPS"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tracking">Tracking Number (optional)</Label>
              <Input
                id="tracking"
                placeholder="Enter tracking number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>Note:</strong> Shipping this order will pull {shippingOrder?.totalItems} items from inventory.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShipDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleShip}
              disabled={shipping}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {shipping ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Shipping...
                </>
              ) : (
                <>
                  <Truck className="h-4 w-4 mr-2" />
                  Ship Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel order {deletingOrder?.orderNumber}? This will release the reserved inventory.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Keep Order
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              variant="destructive"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Cancelling...
                </>
              ) : (
                'Cancel Order'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
