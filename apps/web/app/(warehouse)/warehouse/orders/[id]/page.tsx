'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Package,
  Truck,
  MapPin,
  Pencil,
  Check,
  Loader2,
  Trash2,
  X,
  Send,
  Calendar,
  FileText,
} from 'lucide-react'

interface ShipViaOption {
  id: number
  description: string
  active: boolean
  providerId: number | null
  providerName: string | null
}

interface AvailableReference {
  referenceNumber: string | null
  available: number
  isCurrent: boolean
}

interface OrderItem {
  id: string
  quantity: number
  unitPrice: number | null
  isBulkOrder: boolean
  referenceNumber: string | null
  lotNumber: string | null
  notes: string | null
  paceJobPart: string | null
  item: {
    id: string
    itemCode: string | null
    sku: string | null
    name: string
    category: string | null
    sellPrice: number | null
    canOrderInBulk: boolean
    bulkUnitName: string | null
    unitsPerBulk: number | null
    bulkSellPrice: number | null
  }
}

interface StorefrontOrder {
  id: string
  orderNumber: string
  status: 'CREATED' | 'SHIPPED' | 'CANCELLED'
  shipToName: string | null
  shipToAddress1: string | null
  shipToAddress2: string | null
  shipToCity: string | null
  shipToState: string | null
  shipToZip: string | null
  shipToCountry: string | null
  shipToPhone: string | null
  trackingNumber: string | null
  carrier: string | null
  notes: string | null
  shippedAt: string | null
  paceJobNumber: string | null
  createdAt: string
  customer: {
    id: string
    name: string
    company: string | null
    email: string | null
    phone: string | null
    paceCustomerId: string | null
  }
  createdBy: {
    id: string
    name: string | null
    email: string
  }
  items: OrderItem[]
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [order, setOrder] = useState<StorefrontOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Edit state
  const [editingAddress, setEditingAddress] = useState(false)
  const [saving, setSaving] = useState(false)
  const [shippingAddress, setShippingAddress] = useState({
    shipToName: '',
    shipToAddress1: '',
    shipToAddress2: '',
    shipToCity: '',
    shipToState: '',
    shipToZip: '',
    shipToCountry: '',
    shipToPhone: '',
  })

  // Ship dialog
  const [shipDialogOpen, setShipDialogOpen] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [carrier, setCarrier] = useState('')
  const [shipping, setShipping] = useState(false)

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // PACE integration
  const [sendingToPace, setSendingToPace] = useState(false)
  const [shipViaOptions, setShipViaOptions] = useState<ShipViaOption[]>([])
  const [loadingShipVia, setLoadingShipVia] = useState(false)
  const [paceShipDate, setPaceShipDate] = useState('')
  const [paceShipProvider, setPaceShipProvider] = useState<string>('')
  const [paceShipVia, setPaceShipVia] = useState<string>('')

  // Item editing
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null)
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false)
  const [editItemQuantity, setEditItemQuantity] = useState<number>(0)
  const [editItemReference, setEditItemReference] = useState<string>('')
  const [savingItem, setSavingItem] = useState(false)
  const [availableReferences, setAvailableReferences] = useState<AvailableReference[]>([])
  const [loadingReferences, setLoadingReferences] = useState(false)

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [message])

  useEffect(() => {
    fetchOrder()
  }, [id])

  // Fetch shipVia options when order can be sent to PACE (or resent)
  useEffect(() => {
    const fetchPaceOptions = async () => {
      if (!order || !order.customer.paceCustomerId) return

      // Fetch shipVia options
      setLoadingShipVia(true)
      try {
        const response = await fetch('/api/pace/ship-via')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data?.items) {
            setShipViaOptions(data.data.items)
          }
        }
      } catch (err) {
        console.error('Failed to fetch shipVia options:', err)
      } finally {
        setLoadingShipVia(false)
      }
    }

    fetchPaceOptions()
  }, [order?.id, order?.customer?.paceCustomerId])

  const fetchOrder = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/warehouse/storefront-orders/${id}`)
      if (!response.ok) {
        throw new Error('Order not found')
      }
      const data = await response.json()
      setOrder(data.data)

      // Initialize edit state
      setShippingAddress({
        shipToName: data.data.shipToName || '',
        shipToAddress1: data.data.shipToAddress1 || '',
        shipToAddress2: data.data.shipToAddress2 || '',
        shipToCity: data.data.shipToCity || '',
        shipToState: data.data.shipToState || '',
        shipToZip: data.data.shipToZip || '',
        shipToCountry: data.data.shipToCountry || '',
        shipToPhone: data.data.shipToPhone || '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch order')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAddress = async () => {
    if (!order) return

    setSaving(true)
    try {
      const response = await fetch(`/api/warehouse/storefront-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...shippingAddress }),
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Shipping address updated' })
        setEditingAddress(false)
        fetchOrder()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update address' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update address' })
    } finally {
      setSaving(false)
    }
  }

  const handleShip = async () => {
    if (!order) return

    setShipping(true)
    try {
      const response = await fetch(`/api/warehouse/storefront-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, carrier }),
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Order shipped successfully!' })
        setShipDialogOpen(false)
        fetchOrder()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to ship order' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to ship order' })
    } finally {
      setShipping(false)
    }
  }

  const handleCancel = async () => {
    if (!order) return

    setCancelling(true)
    try {
      const response = await fetch(`/api/warehouse/storefront-orders/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        router.push('/warehouse/orders')
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to cancel order' })
        setCancelDialogOpen(false)
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to cancel order' })
    } finally {
      setCancelling(false)
    }
  }

  const handleEditItem = async (item: OrderItem) => {
    setEditingItem(item)
    setEditItemQuantity(item.quantity)
    setEditItemReference(item.referenceNumber || '')
    setEditItemDialogOpen(true)

    // Fetch available references for this item
    setLoadingReferences(true)
    try {
      const response = await fetch(`/api/warehouse/storefront-orders/${id}/items/${item.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setAvailableReferences(data.data.availableReferences || [])
        }
      }
    } catch (err) {
      console.error('Failed to fetch available references:', err)
    } finally {
      setLoadingReferences(false)
    }
  }

  const handleSaveItem = async () => {
    if (!editingItem || !order) return

    setSavingItem(true)
    try {
      const updates: { quantity?: number; referenceNumber?: string | null } = {}

      // Only send changes
      if (editItemQuantity !== editingItem.quantity) {
        updates.quantity = editItemQuantity
      }
      if (editItemReference !== (editingItem.referenceNumber || '')) {
        updates.referenceNumber = editItemReference || null
      }

      if (Object.keys(updates).length === 0) {
        setEditItemDialogOpen(false)
        return
      }

      const response = await fetch(`/api/warehouse/storefront-orders/${id}/items/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      const data = await response.json()
      if (data.success) {
        let successMsg = 'Item updated'
        if (data.paceSync?.success) {
          successMsg += ' (PACE synced)'
        } else if (data.paceSync?.error) {
          successMsg += ` (PACE sync failed: ${data.paceSync.error})`
        }
        setMessage({ type: 'success', text: successMsg })
        setEditItemDialogOpen(false)
        fetchOrder()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update item' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update item' })
    } finally {
      setSavingItem(false)
    }
  }

  // Generate special information from order items
  const generateSpecialInfo = () => {
    if (!order) return ''

    const lines: string[] = []
    for (const item of order.items) {
      const sku = item.item.sku || item.item.itemCode || ''
      const description = item.item.name || ''
      const refNum = item.referenceNumber
      const isBulk = item.isBulkOrder && item.item.canOrderInBulk && item.item.unitsPerBulk
      const unitsPerBulk = item.item.unitsPerBulk || 1
      const bulkQty = isBulk ? Math.round(item.quantity / unitsPerBulk) : null
      const bulkUnitName = item.item.bulkUnitName || 'Case'

      // Build SKU part with optional reference
      const skuPart = refNum ? `${sku} (${refNum})` : sku

      if (isBulk && bulkQty) {
        // Format: SKU (Ref) - Description (Bulk): X Cartons (X x Y = Z units)
        lines.push(`${skuPart} - ${description} (Bulk): ${bulkQty} ${bulkUnitName}${bulkQty !== 1 ? 's' : ''} (${bulkQty} x ${unitsPerBulk} = ${item.quantity} units)`)
      } else {
        // Format: SKU (Ref) - Description: X units
        lines.push(`${skuPart} - ${description}: ${item.quantity} units`)
      }
    }

    // Add order notes if present
    if (order.notes) {
      lines.push('')
      lines.push(`Notes: ${order.notes}`)
    }

    return lines.join('\n')
  }

  const handleSendToPace = async (force: boolean = false) => {
    if (!order) return

    setSendingToPace(true)
    try {
      const response = await fetch(`/api/warehouse/storefront-orders/${id}/send-to-pace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipDate: paceShipDate || undefined,
          shipVia: paceShipVia ? parseInt(paceShipVia, 10) : undefined,
          shipmentType: 205, // Hardcoded shipment type
          specialInformation: generateSpecialInfo(),
          force,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: `Order sent to PACE! Job #${data.data.paceJobNumber}` })
        fetchOrder()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send to PACE' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to send to PACE' })
    } finally {
      setSendingToPace(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          Loading...
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
        <p className="text-red-600">{error || 'Order not found'}</p>
        <Link href="/warehouse/orders" className="text-emerald-600 hover:underline mt-4 inline-block">
          Back to Orders
        </Link>
      </div>
    )
  }

  const isEditable = order.status === 'CREATED'
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0)

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
            <Link href="/warehouse/orders" className="hover:text-emerald-600 flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Orders
            </Link>
            <span>/</span>
            <span>{order.orderNumber}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
            <Badge
              className={
                order.status === 'SHIPPED'
                  ? 'bg-green-100 text-green-800'
                  : order.status === 'CANCELLED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-blue-100 text-blue-800'
              }
            >
              {order.status === 'SHIPPED' ? 'Shipped' : order.status === 'CANCELLED' ? 'Cancelled' : 'Created'}
            </Badge>
            {order.paceJobNumber && (
              <Badge variant="outline" className="font-mono">
                PACE #{order.paceJobNumber}
              </Badge>
            )}
          </div>
          <p className="text-gray-600">
            Created {new Date(order.createdAt).toLocaleDateString()} by {order.createdBy?.name || order.createdBy?.email}
          </p>
        </div>

        {isEditable && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setCancelDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Cancel Order
            </Button>
            {!order.paceJobNumber && order.customer.paceCustomerId && (
              <Button
                variant="outline"
                onClick={() => handleSendToPace(false)}
                disabled={sendingToPace}
              >
                {sendingToPace ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send to PACE
                  </>
                )}
              </Button>
            )}
            {order.paceJobNumber && order.customer.paceCustomerId && (
              <Button
                variant="outline"
                onClick={() => handleSendToPace(true)}
                disabled={sendingToPace}
                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              >
                {sendingToPace ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Resend to PACE (Test)
                  </>
                )}
              </Button>
            )}
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShipDialogOpen(true)}
            >
              <Truck className="h-4 w-4 mr-2" />
              Ship Order
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items ({totalItems} items)
              </h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {isEditable && <TableHead className="w-[60px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => {
                  // Calculate display values for bulk orders
                  const isBulk = item.isBulkOrder && item.item.canOrderInBulk && item.item.unitsPerBulk
                  const bulkQty = isBulk ? Math.round(item.quantity / (item.item.unitsPerBulk || 1)) : null
                  const bulkUnitName = item.item.bulkUnitName || 'Case'
                  const unitsPerBulk = item.item.unitsPerBulk || 1

                  // Get stored per-unit price
                  const storedUnitPrice = item.unitPrice !== null
                    ? Number(item.unitPrice)
                    : item.item.sellPrice !== null
                      ? Number(item.item.sellPrice)
                      : null

                  // For display: show bulk price for bulk orders, unit price for regular
                  const displayPrice = storedUnitPrice !== null
                    ? (isBulk ? storedUnitPrice * unitsPerBulk : storedUnitPrice)
                    : null

                  // Line total is always per-unit price * total units
                  const lineTotal = storedUnitPrice !== null ? storedUnitPrice * item.quantity : null

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.item.name}</div>
                          <div className="text-sm text-gray-500 font-mono">
                            {item.item.itemCode || item.item.sku}
                          </div>
                          {item.item.category && (
                            <Badge variant="secondary" className="mt-1 text-xs">
                              {item.item.category}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.referenceNumber ? (
                          <Badge variant="outline" className="font-mono">
                            PO# {item.referenceNumber}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isBulk ? (
                          <div>
                            <div className="font-medium">
                              {bulkQty} {bulkQty === 1 ? bulkUnitName : `${bulkUnitName}s`}
                            </div>
                            <div className="text-sm text-gray-500">
                              ({item.quantity} units)
                            </div>
                          </div>
                        ) : (
                          <span className="font-medium">{item.quantity}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {displayPrice !== null ? (
                          <div>
                            <span className="font-mono">${displayPrice.toFixed(2)}</span>
                            {isBulk && (
                              <span className="text-xs text-gray-500 block">
                                /{bulkUnitName.toLowerCase()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {lineTotal !== null ? (
                          <span className="font-medium font-mono">${lineTotal.toFixed(2)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      {isEditable && (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditItem(item)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {/* Order Total */}
            {(() => {
              const orderTotal = order.items.reduce((sum, item) => {
                const storedUnitPrice = item.unitPrice !== null
                  ? Number(item.unitPrice)
                  : item.item.sellPrice !== null
                    ? Number(item.item.sellPrice)
                    : 0
                return sum + (storedUnitPrice * item.quantity)
              }, 0)
              return orderTotal > 0 ? (
                <div className="border-t p-4 flex justify-end">
                  <div className="text-right">
                    <span className="text-gray-500 mr-4">Order Total:</span>
                    <span className="text-xl font-bold font-mono">${orderTotal.toFixed(2)}</span>
                  </div>
                </div>
              ) : null
            })()}
          </div>

          {/* Shipping Info (if shipped) */}
          {order.status === 'SHIPPED' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 flex items-center gap-2 mb-2">
                <Truck className="h-5 w-5" />
                Shipped
              </h3>
              <div className="text-sm text-green-700 space-y-1">
                <p>Shipped on {order.shippedAt ? new Date(order.shippedAt).toLocaleDateString() : 'N/A'}</p>
                {order.carrier && <p>Carrier: {order.carrier}</p>}
                {order.trackingNumber && (
                  <p>Tracking: <span className="font-mono">{order.trackingNumber}</span></p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">Customer</h3>
            <div className="space-y-2 text-sm">
              <div className="font-medium">{order.customer.name}</div>
              {order.customer.company && (
                <div className="text-gray-500">{order.customer.company}</div>
              )}
              {order.customer.email && (
                <div className="text-gray-500">{order.customer.email}</div>
              )}
              {order.customer.phone && (
                <div className="text-gray-500">{order.customer.phone}</div>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Ship To
              </h3>
              {isEditable && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (editingAddress) {
                      handleSaveAddress()
                    } else {
                      setEditingAddress(true)
                    }
                  }}
                  disabled={saving}
                >
                  {editingAddress ? (
                    saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />
                  ) : (
                    <Pencil className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>

            {editingAddress ? (
              <div className="space-y-2">
                <Input
                  value={shippingAddress.shipToName}
                  onChange={(e) => setShippingAddress(prev => ({ ...prev, shipToName: e.target.value }))}
                  placeholder="Recipient name"
                  className="h-8 text-sm"
                />
                <Input
                  value={shippingAddress.shipToAddress1}
                  onChange={(e) => setShippingAddress(prev => ({ ...prev, shipToAddress1: e.target.value }))}
                  placeholder="Address line 1"
                  className="h-8 text-sm"
                />
                <Input
                  value={shippingAddress.shipToAddress2}
                  onChange={(e) => setShippingAddress(prev => ({ ...prev, shipToAddress2: e.target.value }))}
                  placeholder="Address line 2"
                  className="h-8 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={shippingAddress.shipToCity}
                    onChange={(e) => setShippingAddress(prev => ({ ...prev, shipToCity: e.target.value }))}
                    placeholder="City"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={shippingAddress.shipToState}
                    onChange={(e) => setShippingAddress(prev => ({ ...prev, shipToState: e.target.value }))}
                    placeholder="State"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={shippingAddress.shipToZip}
                    onChange={(e) => setShippingAddress(prev => ({ ...prev, shipToZip: e.target.value }))}
                    placeholder="ZIP"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={shippingAddress.shipToPhone}
                    onChange={(e) => setShippingAddress(prev => ({ ...prev, shipToPhone: e.target.value }))}
                    placeholder="Phone"
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingAddress(false)}
                  className="text-gray-500"
                >
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
              </div>
            ) : order.shipToAddress1 ? (
              <div className="text-sm text-gray-600 space-y-1">
                {order.shipToName && <div className="font-medium">{order.shipToName}</div>}
                <div>{order.shipToAddress1}</div>
                {order.shipToAddress2 && <div>{order.shipToAddress2}</div>}
                <div>
                  {order.shipToCity}, {order.shipToState} {order.shipToZip}
                </div>
                {order.shipToPhone && <div>{order.shipToPhone}</div>}
              </div>
            ) : (
              <div className="text-sm text-gray-400 italic">
                No shipping address
                {isEditable && (
                  <button
                    type="button"
                    className="ml-2 text-emerald-600 hover:underline"
                    onClick={() => setEditingAddress(true)}
                  >
                    Add
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Notes (read-only) */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">Notes</h3>
            {order.notes ? (
              <p className="text-sm text-gray-600">{order.notes}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">No notes</p>
            )}
          </div>

          {/* PACE Shipment Settings - Show when order can be sent to PACE (or resent for testing) */}
          {isEditable && order.customer.paceCustomerId && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <Send className="h-4 w-4" />
                PACE Shipment Settings
              </h3>

              <div className="space-y-4">
                {/* Ship Date */}
                <div className="space-y-2">
                  <Label htmlFor="paceShipDate" className="flex items-center gap-1 text-sm">
                    <Calendar className="h-3 w-3" />
                    Expected Ship Date
                  </Label>
                  <Input
                    id="paceShipDate"
                    type="date"
                    value={paceShipDate}
                    onChange={(e) => setPaceShipDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                {/* Ship Provider */}
                <div className="space-y-2">
                  <Label htmlFor="paceShipProvider" className="flex items-center gap-1 text-sm">
                    <Truck className="h-3 w-3" />
                    Carrier
                  </Label>
                  {loadingShipVia ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading options...
                    </div>
                  ) : (
                    <Select
                      value={paceShipProvider}
                      onValueChange={(value) => {
                        setPaceShipProvider(value)
                        setPaceShipVia('') // Reset ship via when provider changes
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select carrier" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Get unique providers from ship via options */}
                        {[...new Map(
                          shipViaOptions
                            .filter(o => o.providerId !== null && o.providerName !== null)
                            .map(o => [o.providerId, { id: o.providerId!, name: o.providerName! }])
                        ).values()].map((provider) => (
                          <SelectItem key={provider.id} value={String(provider.id)}>
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Ship Via (filtered by provider) */}
                <div className="space-y-2">
                  <Label htmlFor="paceShipVia" className="flex items-center gap-1 text-sm">
                    <Package className="h-3 w-3" />
                    Service
                  </Label>
                  <Select
                    value={paceShipVia}
                    onValueChange={setPaceShipVia}
                    disabled={!paceShipProvider}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder={paceShipProvider ? "Select service" : "Select carrier first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {shipViaOptions
                        .filter(o => String(o.providerId) === paceShipProvider)
                        .map((option) => (
                          <SelectItem key={option.id} value={String(option.id)}>
                            {option.description}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Special Information Preview */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1 text-sm">
                    <FileText className="h-3 w-3" />
                    Special Information (auto-generated)
                  </Label>
                  <div className="bg-gray-50 border rounded p-2 text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {generateSpecialInfo() || 'No items'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ship Dialog */}
      <Dialog open={shipDialogOpen} onOpenChange={setShipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ship Order</DialogTitle>
            <DialogDescription>
              Ship order {order.orderNumber} to {order.customer.name}
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
              <strong>Note:</strong> Shipping this order will pull {totalItems} items from inventory.
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

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel order {order.orderNumber}? This will release the reserved inventory.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Order
            </Button>
            <Button
              onClick={handleCancel}
              disabled={cancelling}
              variant="destructive"
            >
              {cancelling ? (
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

      {/* Edit Item Dialog */}
      <Dialog open={editItemDialogOpen} onOpenChange={setEditItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
            <DialogDescription>
              {editingItem && (
                <>
                  {editingItem.item.name}
                  {editingItem.item.sku && (
                    <span className="font-mono ml-2">({editingItem.item.sku})</span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="editQuantity">Quantity</Label>
              <Input
                id="editQuantity"
                type="number"
                min={1}
                value={editItemQuantity}
                onChange={(e) => setEditItemQuantity(parseInt(e.target.value, 10) || 1)}
              />
              {editingItem?.isBulkOrder && editingItem?.item.unitsPerBulk && (
                <p className="text-sm text-gray-500">
                  = {Math.round(editItemQuantity / editingItem.item.unitsPerBulk)}{' '}
                  {editingItem.item.bulkUnitName || 'Case'}
                  {Math.round(editItemQuantity / editingItem.item.unitsPerBulk) !== 1 && 's'}
                </p>
              )}
            </div>

            {/* Reference Number */}
            <div className="space-y-2">
              <Label htmlFor="editReference">Reference Number (PO#)</Label>
              {loadingReferences ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 h-10">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading available references...
                </div>
              ) : availableReferences.filter((ref) => ref.referenceNumber).length > 0 ? (
                <Select
                  value={editItemReference}
                  onValueChange={setEditItemReference}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reference" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableReferences
                      .filter((ref) => ref.referenceNumber)
                      .map((ref) => (
                        <SelectItem
                          key={ref.referenceNumber!}
                          value={ref.referenceNumber!}
                        >
                          {ref.referenceNumber}{' '}
                          <span className="text-gray-500">
                            ({ref.available} available{ref.isCurrent ? ' - current' : ''})
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="editReference"
                  value={editItemReference}
                  onChange={(e) => setEditItemReference(e.target.value)}
                  placeholder="Enter reference number"
                />
              )}
            </div>

            {/* Warning about PACE sync */}
            {order.paceJobNumber && editingItem?.paceJobPart && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <strong>Note:</strong> Changes will be synced to PACE Job #{order.paceJobNumber}, Part {editingItem.paceJobPart}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveItem}
              disabled={savingItem}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {savingItem ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
