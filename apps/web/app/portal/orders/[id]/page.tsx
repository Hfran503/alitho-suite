'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Package,
  Truck,
  MapPin,
  AlertCircle,
  CheckCircle2,
  FileText,
  Calendar,
  Hash,
  ShoppingBag,
  Clock,
  User,
} from 'lucide-react'
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

const statusConfig: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  CREATED: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    icon: 'bg-amber-100',
    label: 'Pending',
  },
  PROCESSING: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    icon: 'bg-blue-100',
    label: 'Processing',
  },
  SHIPPED: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    icon: 'bg-purple-100',
    label: 'Shipped',
  },
  DELIVERED: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    icon: 'bg-emerald-100',
    label: 'Delivered',
  },
  CANCELLED: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    icon: 'bg-red-100',
    label: 'Cancelled',
  },
}

export default function PortalOrderDetailPage() {
  const params = useParams()
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
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const statusInfo = order ? statusConfig[order.status] || statusConfig.CREATED : statusConfig.CREATED

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
            <Package className="h-8 w-8 text-blue-600" />
          </div>
          <div className="absolute inset-0 h-16 w-16 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
        </div>
        <p className="mt-4 text-gray-600 font-medium">Loading order details...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-md mx-auto">
          <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-2xl p-8 text-center">
            <div className="h-16 w-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Order</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link href="/portal/orders">
              <Button className="bg-gray-900 hover:bg-gray-800 text-white">
                Back to Orders
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!order) {
    return null
  }

  return (
    <div className="p-6 space-y-6">
      {/* Premium Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white">{order.orderNumber}</h1>
              </div>
              <div className="flex items-center gap-4 text-gray-300 text-sm">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {formatDate(order.createdAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Hash className="h-4 w-4" />
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <Badge
              className={`${statusInfo.bg} ${statusInfo.text} border-0 px-4 py-2 text-sm font-semibold`}
            >
              {statusInfo.label}
            </Badge>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
            <p className={`text-lg font-bold ${statusInfo.text}`}>{statusInfo.label}</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Items</p>
            <p className="text-lg font-bold text-gray-900">{order.items.length}</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total Units</p>
            <p className="text-lg font-bold text-gray-900">{order.totalItems}</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total</p>
            <p className="text-lg font-bold text-gray-900">
              {order.totalPrice > 0 ? formatCurrency(order.totalPrice) : '-'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <ShoppingBag className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Order Items</h2>
                  <p className="text-sm text-gray-500">
                    {order.items.length} item{order.items.length !== 1 ? 's' : ''} · {order.totalItems} units total
                  </p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {order.items.map((item, index) => {
                const unitPrice = item.unitPrice
                  ? parseFloat(item.unitPrice)
                  : item.item.sellPrice
                    ? parseFloat(item.item.sellPrice)
                    : 0
                const lineTotal = unitPrice * item.quantity

                return (
                  <div key={item.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center text-gray-400 font-semibold text-sm border border-gray-200">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-medium text-gray-900">{item.item.name}</h3>
                            <p className="text-sm text-gray-500 font-mono mt-0.5">
                              {item.item.sku || item.item.itemCode}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {item.isBulkOrder && item.item.bulkUnitName && (
                                <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                                  {item.item.bulkUnitName}
                                </Badge>
                              )}
                              {item.referenceNumber && (
                                <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                                  PO# {item.referenceNumber}
                                </Badge>
                              )}
                              <span className="text-sm text-gray-600">
                                Qty: <span className="font-semibold">{item.quantity}</span>
                              </span>
                              {unitPrice > 0 && (
                                <span className="text-sm text-gray-500">
                                  @ {formatCurrency(unitPrice)}
                                </span>
                              )}
                            </div>
                          </div>
                          {lineTotal > 0 && (
                            <p className="font-bold text-gray-900 text-lg">
                              {formatCurrency(lineTotal)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {order.totalPrice > 0 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Order Total</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {formatCurrency(order.totalPrice)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-xl">
                    <FileText className="h-5 w-5 text-amber-600" />
                  </div>
                  <h2 className="font-semibold text-gray-900">Order Notes</h2>
                </div>
              </div>
              <div className="p-6">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{order.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Timeline */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Clock className="h-5 w-5 text-indigo-600" />
                </div>
                <h2 className="font-semibold text-gray-900">Order Timeline</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {/* Order Placed - Always shown */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center shadow-sm">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    </div>
                    {order.status !== 'CREATED' && order.status !== 'CANCELLED' && (
                      <div className="w-0.5 h-8 bg-emerald-200 mt-2"></div>
                    )}
                  </div>
                  <div className="pt-1">
                    <p className="font-semibold text-gray-900">Order Placed</p>
                    <p className="text-sm text-gray-500">{formatDateTime(order.createdAt)}</p>
                  </div>
                </div>

                {/* Processing */}
                {(order.status === 'PROCESSING' || order.status === 'SHIPPED' || order.status === 'DELIVERED') && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shadow-sm">
                        <Package className="h-5 w-5 text-blue-600" />
                      </div>
                      {(order.status === 'SHIPPED' || order.status === 'DELIVERED') && (
                        <div className="w-0.5 h-8 bg-blue-200 mt-2"></div>
                      )}
                    </div>
                    <div className="pt-1">
                      <p className="font-semibold text-gray-900">Processing</p>
                      <p className="text-sm text-gray-500">Order is being prepared</p>
                    </div>
                  </div>
                )}

                {/* Shipped */}
                {(order.status === 'SHIPPED' || order.status === 'DELIVERED') && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center shadow-sm">
                        <Truck className="h-5 w-5 text-purple-600" />
                      </div>
                      {order.status === 'DELIVERED' && (
                        <div className="w-0.5 h-8 bg-purple-200 mt-2"></div>
                      )}
                    </div>
                    <div className="pt-1">
                      <p className="font-semibold text-gray-900">Shipped</p>
                      <p className="text-sm text-gray-500">On the way to you</p>
                    </div>
                  </div>
                )}

                {/* Delivered */}
                {order.status === 'DELIVERED' && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center shadow-sm">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      </div>
                    </div>
                    <div className="pt-1">
                      <p className="font-semibold text-gray-900">Delivered</p>
                      <p className="text-sm text-gray-500">Order completed</p>
                    </div>
                  </div>
                )}

                {/* Cancelled */}
                {order.status === 'CANCELLED' && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shadow-sm">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      </div>
                    </div>
                    <div className="pt-1">
                      <p className="font-semibold text-gray-900">Cancelled</p>
                      <p className="text-sm text-gray-500">Order was cancelled</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl">
                  <MapPin className="h-5 w-5 text-emerald-600" />
                </div>
                <h2 className="font-semibold text-gray-900">Shipping Address</h2>
              </div>
            </div>
            <div className="p-6">
              {order.shipToAddress1 ? (
                <div className="text-gray-700 space-y-1">
                  {order.shipToName && (
                    <p className="font-semibold text-gray-900">{order.shipToName}</p>
                  )}
                  <p>{order.shipToAddress1}</p>
                  {order.shipToAddress2 && <p>{order.shipToAddress2}</p>}
                  <p>
                    {order.shipToCity}, {order.shipToState} {order.shipToZip}
                  </p>
                  {order.shipToPhone && (
                    <p className="pt-2 text-gray-500 text-sm">{order.shipToPhone}</p>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <MapPin className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No shipping address provided</p>
                </div>
              )}
            </div>
          </div>

          {/* Ordered By */}
          {order.createdBy && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-xl">
                    <User className="h-5 w-5 text-gray-600" />
                  </div>
                  <h2 className="font-semibold text-gray-900">Ordered By</h2>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                    {(order.createdBy.name || order.createdBy.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {order.createdBy.name || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-500">{order.createdBy.email}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
