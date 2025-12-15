'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Truck, MapPin, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface OrderItem {
  id: string
  quantity: number
  unitPrice: string | null
  isBulkOrder: boolean
  referenceNumber: string | null
  item: {
    id: string
    itemCode: string | null
    sku: string | null
    name: string
    description: string | null
    sellPrice: string | null
    bulkSellPrice: string | null
    canOrderInBulk: boolean
    unitsPerBulk: number | null
    bulkUnitName: string | null
  }
}

interface StorefrontOrder {
  id: string
  orderNumber: string
  status: string
  paceJobNumber: string | null
  shipToName: string | null
  shipToAddress1: string | null
  shipToAddress2: string | null
  shipToCity: string | null
  shipToState: string | null
  shipToZip: string | null
  shipToCountry: string | null
  shipToPhone: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  customer: {
    id: string
    name: string
    company: string | null
    paceCustomerId: string
    email: string | null
    phone: string | null
  }
  items: OrderItem[]
  totalItems: number
  totalPrice: number
  createdBy: {
    id: string
    name: string | null
    email: string
  } | null
}

const statusColors: Record<string, string> = {
  CREATED: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PROCESSING: 'bg-blue-100 text-blue-800 border-blue-200',
  SHIPPED: 'bg-purple-100 text-purple-800 border-purple-200',
  DELIVERED: 'bg-green-100 text-green-800 border-green-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
}

const statusLabels: Record<string, string> = {
  CREATED: 'Pending',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export default function PortalOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<StorefrontOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (params.id) {
      fetchOrder(params.id as string)
    }
  }, [params.id])

  const fetchOrder = async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/portal/storefront-orders/${id}`)
      const data = await response.json()

      if (data.success && data.data) {
        setOrder(data.data)
      } else {
        setError(data.error || 'Order not found')
      }
    } catch (err) {
      console.error('Error fetching order:', err)
      setError('Failed to load order')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number | string | null) => {
    if (amount === null || amount === undefined) return '-'
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        <p className="mt-4 text-gray-600">Loading order details...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">Unable to Load Order</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/portal/orders">
            <Button variant="outline">Back to Orders</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!order) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.push('/portal/orders')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Orders
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{order.orderNumber}</h1>
          <p className="text-gray-600 mt-2">
            Placed on {formatDate(order.createdAt)}
          </p>
          {order.paceJobNumber && (
            <p className="text-sm text-blue-600 mt-1">
              PACE Job: {order.paceJobNumber}
            </p>
          )}
        </div>
        <Badge
          variant="outline"
          className={`px-4 py-2 text-sm font-medium ${
            statusColors[order.status] || 'bg-gray-100 text-gray-800 border-gray-200'
          }`}
        >
          {statusLabels[order.status] || order.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Order Items</h2>
              <p className="text-sm text-gray-600 mt-1">
                {order.items.length} item{order.items.length !== 1 ? 's' : ''} ({order.totalItems} units total)
              </p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {order.items.map((item) => {
                  const unitPrice = item.unitPrice
                    ? parseFloat(item.unitPrice)
                    : item.item.sellPrice
                      ? parseFloat(item.item.sellPrice)
                      : 0
                  const lineTotal = unitPrice * item.quantity

                  return (
                    <div key={item.id} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{item.item.name}</p>
                          {item.isBulkOrder && item.item.bulkUnitName && (
                            <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                              {item.item.bulkUnitName}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 font-mono mt-1">
                          {item.item.itemCode || item.item.sku}
                          {item.referenceNumber && (
                            <span className="text-blue-600 ml-2">PO# {item.referenceNumber}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Quantity: {item.quantity}
                          {item.unitPrice && (
                            <span className="ml-2">x {formatCurrency(item.unitPrice)}</span>
                          )}
                        </p>
                      </div>
                      {lineTotal > 0 && (
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(lineTotal)}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              {order.totalPrice > 0 && (
                <>
                  <div className="border-t border-gray-200 my-6"></div>
                  <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>Total</span>
                    <span>{formatCurrency(order.totalPrice)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Order Notes</h2>
              </div>
              <div className="p-6">
                <p className="text-gray-700 whitespace-pre-wrap">{order.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Shipping Address */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Shipping Address
              </h2>
            </div>
            <div className="p-6">
              {order.shipToAddress1 ? (
                <div className="text-gray-700">
                  {order.shipToName && <p className="font-medium">{order.shipToName}</p>}
                  <p>{order.shipToAddress1}</p>
                  {order.shipToAddress2 && <p>{order.shipToAddress2}</p>}
                  <p>{order.shipToCity}, {order.shipToState} {order.shipToZip}</p>
                  {order.shipToPhone && <p className="mt-2 text-gray-500">{order.shipToPhone}</p>}
                </div>
              ) : (
                <p className="text-gray-500 italic">No shipping address provided</p>
              )}
            </div>
          </div>

          {/* Order Timeline */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Order Timeline</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                    {order.status !== 'CREATED' && (
                      <div className="w-px h-full bg-gray-200 mt-2"></div>
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="font-medium text-gray-900">Order Placed</p>
                    <p className="text-sm text-gray-600">{formatDate(order.createdAt)}</p>
                  </div>
                </div>

                {order.paceJobNumber && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Package className="h-4 w-4 text-blue-600" />
                      </div>
                      {order.status === 'SHIPPED' || order.status === 'DELIVERED' ? (
                        <div className="w-px h-full bg-gray-200 mt-2"></div>
                      ) : null}
                    </div>
                    <div className="pb-4">
                      <p className="font-medium text-gray-900">Sent to PACE</p>
                      <p className="text-sm text-gray-600">Job #{order.paceJobNumber}</p>
                    </div>
                  </div>
                )}

                {(order.status === 'PROCESSING' || order.status === 'SHIPPED' || order.status === 'DELIVERED') && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Truck className="h-4 w-4 text-blue-600" />
                      </div>
                      {order.status === 'DELIVERED' && (
                        <div className="w-px h-full bg-gray-200 mt-2"></div>
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="font-medium text-gray-900">Processing</p>
                      <p className="text-sm text-gray-600">Order is being prepared</p>
                    </div>
                  </div>
                )}

                {order.status === 'SHIPPED' && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <Truck className="h-4 w-4 text-purple-600" />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Shipped</p>
                      <p className="text-sm text-gray-600">On the way</p>
                    </div>
                  </div>
                )}

                {order.status === 'DELIVERED' && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Delivered</p>
                      <p className="text-sm text-gray-600">Order completed</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Customer Information</h2>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <p className="text-sm text-gray-600">Company</p>
                <p className="font-medium text-gray-900">{order.customer.name}</p>
                {order.customer.company && (
                  <p className="text-sm text-gray-500">{order.customer.company}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600">PACE ID</p>
                <p className="font-medium text-gray-900 font-mono">{order.customer.paceCustomerId}</p>
              </div>
              {order.customer.email && (
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium text-gray-900">{order.customer.email}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
