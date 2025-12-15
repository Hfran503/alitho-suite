'use client'

import { useState, useEffect } from 'react'
import { Package, Search, ChevronRight, Plus, Loader2, AlertCircle, User, Users } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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
  status: string
  paceJobNumber: string | null
  shipToName: string | null
  shipToCity: string | null
  shipToState: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  customer: {
    id: string
    name: string
    company: string | null
    paceCustomerId: string
  }
  items: OrderItem[]
  totalItems: number
  _count: {
    items: number
  }
}

const statusColors: Record<string, string> = {
  CREATED: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PROCESSING: 'bg-blue-100 text-blue-800 border-blue-200',
  SHIPPED: 'bg-purple-100 text-purple-800 border-purple-200',
  DELIVERED: 'bg-green-100 text-green-800 border-green-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
  // Lowercase fallbacks
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  processing: 'bg-blue-100 text-blue-800 border-blue-200',
  shipped: 'bg-purple-100 text-purple-800 border-purple-200',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
}

const statusLabels: Record<string, string> = {
  CREATED: 'Pending',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export default function PortalOrdersPage() {
  const [orders, setOrders] = useState<StorefrontOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [myOrdersOnly, setMyOrdersOnly] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [statusFilter, myOrdersOnly])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      if (myOrdersOnly) {
        params.append('myOrders', 'true')
      }

      const response = await fetch(`/api/portal/storefront-orders?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setOrders(data.data || [])
      } else {
        setError(data.error || 'Failed to load orders')
      }
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orders.filter((order) =>
    order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600 mt-2">View and track all your orders</p>
        </div>
        <Link href="/portal/orders/new">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col gap-4">
          {/* My Orders / All Orders Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMyOrdersOnly(false)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !myOrdersOnly
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Users className="h-4 w-4" />
              All Orders
            </button>
            <button
              onClick={() => setMyOrdersOnly(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                myOrdersOnly
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <User className="h-4 w-4" />
              My Orders
            </button>
          </div>

          {/* Search and Status Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by order number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="CREATED">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
          <p className="text-red-700">{error}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={fetchOrders}
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Orders List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      ) : !error && filteredOrders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-600 mb-6">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : myOrdersOnly
                ? "You haven't placed any orders yet"
                : 'Create your first order to get started'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Link href="/portal/orders/new">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Order
              </Button>
            </Link>
          )}
        </div>
      ) : !error && (
        <div className="grid gap-4">
          {filteredOrders.map((order) => (
            <Link key={order.id} href={`/portal/orders/${order.id}`}>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg text-gray-900">
                        {order.orderNumber}
                      </h3>
                      <Badge
                        variant="outline"
                        className={
                          statusColors[order.status] ||
                          'bg-gray-100 text-gray-800 border-gray-200'
                        }
                      >
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                      <span>{formatDate(order.createdAt)}</span>
                      <span>{order.totalItems || order._count?.items || 0} items</span>
                      {order.shipToCity && order.shipToState && (
                        <span>Ship to: {order.shipToCity}, {order.shipToState}</span>
                      )}
                    </div>
                    {order.items && order.items.length > 0 && (
                      <div className="mt-2 text-sm text-gray-500">
                        {order.items.slice(0, 3).map((item, idx) => (
                          <span key={item.id}>
                            {idx > 0 && ', '}
                            {item.item.name} ({item.quantity})
                          </span>
                        ))}
                        {order.items.length > 3 && (
                          <span className="text-gray-400"> +{order.items.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
