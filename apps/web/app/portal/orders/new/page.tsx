'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ShoppingCart,
  ArrowLeft,
  Search,
  Plus,
  Minus,
  MapPin,
  Loader2,
  Package,
  ShoppingBag,
  Hash,
  Pencil,
  Check,
  AlertCircle,
  Trash2,
  LayoutGrid,
  List,
  X,
  Send,
} from 'lucide-react'

interface Customer {
  id: string
  name: string
  company: string | null
  paceCustomerId: string
  shipToName: string | null
  shipToAddress1: string | null
  shipToAddress2: string | null
  shipToCity: string | null
  shipToState: string | null
  shipToZip: string | null
  shipToCountry: string | null
  shipToPhone: string | null
}

interface StockByReference {
  referenceNumber: string | null
  available: number
}

interface InventoryItem {
  id: string
  itemCode: string | null
  sku: string | null
  name: string
  description: string | null
  category: string | null
  available: number
  sellPrice: number | null
  bulkSellPrice: number | null
  trackByReference: boolean
  stockByReference?: StockByReference[]
  canOrderInBulk?: boolean
  bulkUnitName?: string | null
  unitsPerBulk?: number | null
}

interface OrderLine {
  itemId: string
  item: InventoryItem
  quantity: number
  referenceNumber?: string | null
  isBulkOrder?: boolean
  bulkUnitName?: string
  unitsPerBulk?: number
  unitPrice?: number
}

const STORAGE_KEY = 'portal-order-draft'

export default function PortalNewOrderPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  // View mode
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Customer (auto-loaded based on logged-in user)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loadingCustomer, setLoadingCustomer] = useState(true)
  const [customerError, setCustomerError] = useState<string | null>(null)

  // Items
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [categories, setCategories] = useState<string[]>([])

  // Cart
  const [orderLines, setOrderLines] = useState<OrderLine[]>([])
  const [cartOpen, setCartOpen] = useState(false)

  // Quantity input per item (before adding to cart)
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({})

  // Reference number dialog
  const [refDialogOpen, setRefDialogOpen] = useState(false)
  const [refDialogItem, setRefDialogItem] = useState<InventoryItem | null>(null)
  const [selectedRef, setSelectedRef] = useState<string | null>(null)
  const [refQty, setRefQty] = useState(1)
  const [refDialogIsBulk, setRefDialogIsBulk] = useState(false)

  // Shipping address
  const [shippingAddress, setShippingAddress] = useState({
    shipToName: '',
    shipToAddress1: '',
    shipToAddress2: '',
    shipToCity: '',
    shipToState: '',
    shipToZip: '',
    shipToCountry: 'US',
    shipToPhone: '',
  })
  const [editingAddress, setEditingAddress] = useState(false)

  // Notes
  const [notes, setNotes] = useState('')

  // Bulk order type selection dialog
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkDialogItem, setBulkDialogItem] = useState<InventoryItem | null>(null)
  const [bulkDialogOrderType, setBulkDialogOrderType] = useState<'individual' | 'bulk'>('individual')
  const [bulkDialogQty, setBulkDialogQty] = useState(1)

  // Load customer info on mount
  useEffect(() => {
    fetchCustomer()
  }, [])

  // Load saved draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const draft = JSON.parse(saved)
        if (draft.orderLines) setOrderLines(draft.orderLines)
        if (draft.shippingAddress) setShippingAddress(draft.shippingAddress)
        if (draft.notes) setNotes(draft.notes)
      }
    } catch (e) {
      console.error('Error loading draft:', e)
    }
    setIsHydrated(true)
  }, [])

  // Save draft to localStorage when state changes
  useEffect(() => {
    if (!isHydrated) return

    const draft = {
      orderLines,
      shippingAddress,
      notes,
      savedAt: new Date().toISOString(),
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    } catch (e) {
      console.error('Error saving draft:', e)
    }
  }, [isHydrated, orderLines, shippingAddress, notes])

  const clearDraft = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      console.error('Error clearing draft:', e)
    }
  }

  const fetchCustomer = async () => {
    setLoadingCustomer(true)
    setCustomerError(null)
    try {
      const response = await fetch('/api/portal/customer')
      const data = await response.json()
      if (data.success && data.data) {
        setCustomer(data.data)
        setShippingAddress({
          shipToName: data.data.shipToName || '',
          shipToAddress1: data.data.shipToAddress1 || '',
          shipToAddress2: data.data.shipToAddress2 || '',
          shipToCity: data.data.shipToCity || '',
          shipToState: data.data.shipToState || '',
          shipToZip: data.data.shipToZip || '',
          shipToCountry: data.data.shipToCountry || 'US',
          shipToPhone: data.data.shipToPhone || '',
        })
        fetchItems('', '')
      } else {
        setCustomerError(data.error || 'Failed to load customer information')
      }
    } catch (error) {
      console.error('Error fetching customer:', error)
      setCustomerError('Failed to load customer information')
    } finally {
      setLoadingCustomer(false)
    }
  }

  const fetchItems = async (search: string, category: string) => {
    setLoadingItems(true)
    try {
      const params = new URLSearchParams({ limit: '500' })
      if (search) params.set('search', search)
      if (category) params.set('category', category)

      const response = await fetch(`/api/portal/items?${params}`)
      const data = await response.json()
      if (data.success) {
        setItems(data.data || [])
        setCategories(data.filters?.categories || [])
      }
    } catch (error) {
      console.error('Error fetching items:', error)
    } finally {
      setLoadingItems(false)
    }
  }

  useEffect(() => {
    if (customer) fetchItems(itemSearch, categoryFilter)
  }, [categoryFilter])

  useEffect(() => {
    if (!customer) return
    const timer = setTimeout(() => fetchItems(itemSearch, categoryFilter), 300)
    return () => clearTimeout(timer)
  }, [itemSearch])

  const getCartQuantity = (itemId: string, referenceNumber?: string | null) => {
    const lines = orderLines.filter(l => l.itemId === itemId)
    if (referenceNumber !== undefined) {
      const line = lines.find(l => l.referenceNumber === referenceNumber)
      return line?.quantity || 0
    }
    return lines.reduce((sum, l) => sum + l.quantity, 0)
  }

  const getItemQtyInput = (itemId: string) => itemQuantities[itemId] || 1
  const setItemQtyInput = (itemId: string, qty: number) => {
    setItemQuantities(prev => ({ ...prev, [itemId]: Math.max(1, qty) }))
  }

  const openRefDialog = (item: InventoryItem, isBulkOrder: boolean = false) => {
    setRefDialogItem(item)
    setSelectedRef(item.stockByReference?.[0]?.referenceNumber || null)
    setRefQty(getItemQtyInput(item.id))
    setRefDialogIsBulk(isBulkOrder)
    setRefDialogOpen(true)
  }

  const addToCart = (
    item: InventoryItem,
    quantity: number = 1,
    referenceNumber?: string | null,
    isBulkOrder: boolean = false
  ) => {
    const existing = orderLines.find(l =>
      l.itemId === item.id &&
      l.isBulkOrder === isBulkOrder &&
      (item.trackByReference ? l.referenceNumber === referenceNumber : true)
    )

    let maxAvailable = item.available
    if (item.trackByReference && referenceNumber !== undefined) {
      const refStock = item.stockByReference?.find(s => s.referenceNumber === referenceNumber)
      maxAvailable = refStock?.available || 0
    }
    if (isBulkOrder && item.unitsPerBulk) {
      maxAvailable = Math.floor(maxAvailable / item.unitsPerBulk)
    }

    const currentInCart = existing?.quantity || 0
    const newQty = Math.min(currentInCart + quantity, maxAvailable)

    if (existing) {
      if (newQty > currentInCart) {
        setOrderLines(prev => prev.map(l =>
          (l.itemId === item.id && l.isBulkOrder === isBulkOrder &&
           (item.trackByReference ? l.referenceNumber === referenceNumber : true))
            ? { ...l, quantity: newQty }
            : l
        ))
      }
    } else if (newQty > 0) {
      const unitPrice = isBulkOrder
        ? (item.bulkSellPrice ? Number(item.bulkSellPrice) : undefined)
        : (item.sellPrice ? Number(item.sellPrice) : undefined)

      setOrderLines(prev => [...prev, {
        itemId: item.id,
        item,
        quantity: newQty,
        referenceNumber: item.trackByReference ? referenceNumber : undefined,
        isBulkOrder,
        bulkUnitName: isBulkOrder ? (item.bulkUnitName || 'Bulk') : undefined,
        unitsPerBulk: isBulkOrder ? (item.unitsPerBulk || 1) : undefined,
        unitPrice,
      }])
    }
    setItemQuantities(prev => ({ ...prev, [item.id]: 1 }))
  }

  const handleAddToCart = (item: InventoryItem) => {
    if (item.canOrderInBulk) {
      setBulkDialogItem(item)
      setBulkDialogOrderType('individual')
      setBulkDialogQty(1)
      setBulkDialogOpen(true)
      return
    }
    proceedToAddItem(item, false)
  }

  const proceedToAddItem = (item: InventoryItem, isBulkOrder: boolean) => {
    const qty = getItemQtyInput(item.id)
    if (item.trackByReference && item.stockByReference && item.stockByReference.length > 0) {
      openRefDialog(item, isBulkOrder)
    } else {
      addToCart(item, qty, undefined, isBulkOrder)
    }
  }

  const handleBulkDialogAdd = () => {
    if (!bulkDialogItem) return
    const isBulkOrder = bulkDialogOrderType === 'bulk'

    if (bulkDialogItem.trackByReference && bulkDialogItem.stockByReference && bulkDialogItem.stockByReference.length > 0) {
      setBulkDialogOpen(false)
      setRefDialogItem(bulkDialogItem)
      setSelectedRef(bulkDialogItem.stockByReference[0]?.referenceNumber || null)
      setRefQty(bulkDialogQty)
      setRefDialogIsBulk(isBulkOrder)
      setRefDialogOpen(true)
      setBulkDialogItem(null)
    } else {
      addToCart(bulkDialogItem, bulkDialogQty, undefined, isBulkOrder)
      setBulkDialogOpen(false)
      setBulkDialogItem(null)
    }
  }

  const confirmAddWithRef = () => {
    if (refDialogItem && refQty > 0) {
      addToCart(refDialogItem, refQty, selectedRef, refDialogIsBulk)
      setRefDialogOpen(false)
      setRefDialogItem(null)
      setRefDialogIsBulk(false)
    }
  }

  const removeFromCart = (itemId: string, referenceNumber?: string | null, isBulkOrder?: boolean) => {
    setOrderLines(prev => prev.filter(l =>
      !(l.itemId === itemId &&
        (referenceNumber !== undefined ? l.referenceNumber === referenceNumber : true) &&
        (isBulkOrder !== undefined ? l.isBulkOrder === isBulkOrder : true))
    ))
  }

  const updateCartQuantity = (itemId: string, referenceNumber: string | null | undefined, isBulkOrder: boolean, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(itemId, referenceNumber, isBulkOrder)
      return
    }
    setOrderLines(prev => prev.map(l =>
      (l.itemId === itemId && l.referenceNumber === referenceNumber && l.isBulkOrder === isBulkOrder)
        ? { ...l, quantity: newQty }
        : l
    ))
  }

  const generateSpecialInfo = () => {
    const lines: string[] = []
    for (const line of orderLines) {
      const sku = line.item.itemCode || line.item.sku || ''
      const description = line.item.name || ''
      const isBulk = line.isBulkOrder && line.unitsPerBulk
      const unitsPerBulk = line.unitsPerBulk || 1
      const bulkUnitName = line.bulkUnitName || 'Case'
      const actualUnits = isBulk ? line.quantity * unitsPerBulk : line.quantity

      if (isBulk) {
        lines.push(`${sku} - ${description} (Bulk): ${line.quantity} ${bulkUnitName}${line.quantity !== 1 ? 's' : ''} (${line.quantity} x ${unitsPerBulk} = ${actualUnits} units)`)
      } else {
        lines.push(`${sku} - ${description}: ${line.quantity} units`)
      }
    }
    if (notes) {
      lines.push('')
      lines.push(`Notes: ${notes}`)
    }
    return lines.join('\n')
  }

  const handleSubmit = async () => {
    if (!customer) {
      setMessage({ type: 'error', text: 'Customer information not loaded' })
      return
    }
    if (orderLines.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one item' })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/portal/storefront-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...shippingAddress,
          notes: notes || undefined,
          items: orderLines.map(line => ({
            itemId: line.itemId,
            quantity: line.isBulkOrder && line.unitsPerBulk
              ? line.quantity * line.unitsPerBulk
              : line.quantity,
            unitPrice: line.unitPrice !== undefined
              ? (line.isBulkOrder && line.unitsPerBulk
                  ? line.unitPrice / line.unitsPerBulk
                  : line.unitPrice)
              : undefined,
            isBulkOrder: line.isBulkOrder || false,
            referenceNumber: line.referenceNumber || undefined,
          })),
        }),
      })

      const data = await response.json()
      if (data.success) {
        const orderId = data.data.id
        if (customer.paceCustomerId) {
          try {
            await fetch(`/api/portal/storefront-orders/${orderId}/send-to-pace`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                shipmentType: 205,
                specialInformation: generateSpecialInfo(),
              }),
            })
          } catch (paceError) {
            console.error('Error auto-sending to PACE:', paceError)
          }
        }
        clearDraft()
        router.push('/portal/orders')
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create order' })
      }
    } catch (error) {
      console.error('Error creating order:', error)
      setMessage({ type: 'error', text: 'Failed to create order' })
    } finally {
      setSubmitting(false)
    }
  }

  const totalItems = orderLines.reduce((sum, line) => {
    const qty = line.isBulkOrder && line.unitsPerBulk ? line.quantity * line.unitsPerBulk : line.quantity
    return sum + qty
  }, 0)
  const totalLineItems = orderLines.length
  const totalPrice = orderLines.reduce((sum, line) => {
    if (line.unitPrice !== undefined) return sum + (line.unitPrice * line.quantity)
    return sum
  }, 0)

  if (loadingCustomer) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-900 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Your Account</h2>
          <p className="text-gray-500">Please wait while we set things up...</p>
        </div>
      </div>
    )
  }

  if (customerError) {
    return (
      <div className="max-w-lg mx-auto mt-16">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Unable to Create Order</h2>
          <p className="text-gray-500 mb-6">{customerError}</p>
          <Link href="/portal">
            <Button variant="outline" className="rounded-xl px-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Portal
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const hasShippingAddress = shippingAddress.shipToAddress1 && shippingAddress.shipToCity && shippingAddress.shipToState && shippingAddress.shipToZip
  const canSubmit = orderLines.length > 0 && hasShippingAddress

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-white to-gray-50 w-full">
      {/* Premium Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/portal/orders"
                className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Create New Order</h1>
                {customer && (
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    {customer.name}
                  </p>
                )}
              </div>
            </div>

            {/* Cart Button */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative flex items-center gap-3 px-5 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl shadow-lg shadow-gray-900/25 transition-all hover:shadow-xl hover:shadow-gray-900/30"
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="font-semibold">
                {totalLineItems > 0 ? `${totalLineItems} items` : 'Cart'}
              </span>
              {totalPrice > 0 && (
                <>
                  <span className="w-px h-5 bg-white/30" />
                  <span className="font-bold">${totalPrice.toFixed(2)}</span>
                </>
              )}
              {totalLineItems > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
                  {totalLineItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-6 py-8">
        {/* Search and Filters Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[300px] relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search products by name, SKU, or item code..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="pl-12 h-12 rounded-xl border-gray-200 focus:border-gray-900 focus:ring-gray-900 text-base"
              />
            </div>

            {/* Category Filter */}
            <div className="w-56">
              <Select value={categoryFilter || '_all'} onValueChange={(v) => setCategoryFilter(v === '_all' ? '' : v)}>
                <SelectTrigger className="h-12 rounded-xl border-gray-200">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Categories</SelectItem>
                  {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <List className="h-5 w-5" />
              </button>
            </div>

            {/* Product Count */}
            <div className="text-sm text-gray-500">
              <span className="font-semibold text-gray-900">{items.length}</span> products
            </div>
          </div>
        </div>

        {/* Products Display */}
        {loadingItems ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-gray-900 mb-4" />
              <p className="text-gray-500">Loading products...</p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
                <Package className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Products Found</h3>
              <p className="text-gray-500">
                {itemSearch || categoryFilter ? 'Try adjusting your search or filters' : 'No products available'}
              </p>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
            {items.map(item => {
              const inCart = getCartQuantity(item.id)
              const isOutOfStock = item.available <= 0
              const qtyInput = getItemQtyInput(item.id)

              return (
                <div
                  key={item.id}
                  className={`group bg-white rounded-2xl border transition-all hover:shadow-lg hover:border-gray-300 ${
                    inCart > 0 ? 'border-gray-400 ring-2 ring-gray-200' : 'border-gray-200'
                  } ${isOutOfStock ? 'opacity-60' : ''}`}
                >
                  {/* Card Header */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs text-gray-400 mb-1 truncate">
                          {item.sku || item.itemCode}
                        </p>
                        <h3 className="font-semibold text-gray-900 leading-tight line-clamp-2 group-hover:text-gray-700 transition-colors">
                          {item.name}
                        </h3>
                      </div>
                      {inCart > 0 && (
                        <div className="shrink-0 px-2 py-1 rounded-full bg-gray-900 text-white text-xs font-semibold">
                          {inCart} in cart
                        </div>
                      )}
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {item.category && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
                          {item.category}
                        </span>
                      )}
                      {item.trackByReference && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium flex items-center gap-1">
                          <Hash className="h-3 w-3" />PO#
                        </span>
                      )}
                      {item.canOrderInBulk && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                          {item.bulkUnitName || 'Bulk'}
                        </span>
                      )}
                    </div>

                    {/* Stock & Price */}
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className={`font-medium ${item.available <= 0 ? 'text-red-500' : item.available < 10 ? 'text-amber-600' : 'text-green-600'}`}>
                          {item.available.toLocaleString()}
                        </span>
                        <span className="text-gray-400 ml-1">available</span>
                      </div>
                      {item.sellPrice && (
                        <div className="text-right">
                          <span className="font-bold text-gray-900">${Number(item.sellPrice).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="px-5 pb-5 pt-3 border-t border-gray-100 space-y-2">
                    {/* Compact Quantity Selector */}
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-500">Qty</label>
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          className="w-8 h-8 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors flex items-center justify-center"
                          onClick={() => setItemQtyInput(item.id, qtyInput - 1)}
                          disabled={qtyInput <= 1 || isOutOfStock}
                        >
                          <Minus className="h-3.5 w-3.5 text-gray-600" />
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={qtyInput}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '')
                            setItemQtyInput(item.id, Math.max(1, parseInt(val) || 1))
                          }}
                          className="w-20 text-center text-sm font-semibold h-8 focus:outline-none bg-white border-x border-gray-300"
                          disabled={isOutOfStock}
                        />
                        <button
                          type="button"
                          className="w-8 h-8 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors flex items-center justify-center"
                          onClick={() => setItemQtyInput(item.id, qtyInput + 1)}
                          disabled={isOutOfStock}
                        >
                          <Plus className="h-3.5 w-3.5 text-gray-600" />
                        </button>
                      </div>
                    </div>

                    {/* Add Button */}
                    <button
                      onClick={() => handleAddToCart(item)}
                      disabled={isOutOfStock}
                      className={`w-full h-9 px-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-1.5 ${
                        isOutOfStock
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-900 hover:bg-gray-800 text-white shadow-sm'
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {item.trackByReference ? 'Select PO#' : 'Add to Cart'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* List View */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                  <TableHead className="w-[140px] font-semibold text-gray-700">Item Code</TableHead>
                  <TableHead className="font-semibold text-gray-700">Product</TableHead>
                  <TableHead className="w-[120px] font-semibold text-gray-700">Category</TableHead>
                  <TableHead className="w-[100px] text-right font-semibold text-gray-700">Available</TableHead>
                  <TableHead className="w-[100px] text-right font-semibold text-gray-700">Price</TableHead>
                  <TableHead className="w-[180px] text-center font-semibold text-gray-700">Quantity</TableHead>
                  <TableHead className="w-[130px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => {
                  const inCart = getCartQuantity(item.id)
                  const isOutOfStock = item.available <= 0
                  const qtyInput = getItemQtyInput(item.id)

                  return (
                    <TableRow key={item.id} className={`${isOutOfStock ? 'opacity-50' : ''} hover:bg-gray-50`}>
                      <TableCell>
                        <div className="font-mono text-sm text-gray-900">{item.itemCode}</div>
                        {item.sku && item.sku !== item.itemCode && (
                          <div className="font-mono text-xs text-gray-400">{item.sku}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {item.trackByReference && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs">
                              <Hash className="h-3 w-3 mr-0.5" />PO#
                            </span>
                          )}
                          {item.canOrderInBulk && (
                            <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">
                              {item.bulkUnitName || 'Bulk'}
                            </span>
                          )}
                          {inCart > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-gray-900 text-white text-xs font-medium">
                              {inCart} in cart
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.category && (
                          <span className="text-sm text-gray-600">{item.category}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-medium ${item.available <= 0 ? 'text-red-500' : item.available < 10 ? 'text-amber-600' : 'text-green-600'}`}>
                          {item.available.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.sellPrice && (
                          <span className="font-semibold text-gray-900">${Number(item.sellPrice).toFixed(2)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
                            onClick={() => setItemQtyInput(item.id, qtyInput - 1)}
                            disabled={qtyInput <= 1 || isOutOfStock}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <Input
                            type="number"
                            min="1"
                            value={qtyInput}
                            onChange={(e) => setItemQtyInput(item.id, Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-16 text-center h-9 rounded-lg"
                            disabled={isOutOfStock}
                          />
                          <button
                            type="button"
                            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
                            onClick={() => setItemQtyInput(item.id, qtyInput + 1)}
                            disabled={isOutOfStock}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleAddToCart(item)}
                          disabled={isOutOfStock}
                          className={`w-full py-2 px-4 rounded-xl font-semibold text-sm transition-all ${
                            isOutOfStock
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-900 hover:bg-gray-800 text-white'
                          }`}
                        >
                          {item.trackByReference ? 'Select PO#' : 'Add'}
                        </button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Cart Slide-over */}
      {cartOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setCartOpen(false)}
          />

          {/* Cart Panel */}
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl flex flex-col">
            {/* Cart Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-gray-900">
              <div className="flex items-center gap-3 text-white">
                <ShoppingCart className="h-6 w-6" />
                <div>
                  <h2 className="text-xl font-bold">Your Order</h2>
                  <p className="text-sm text-white/80">{totalLineItems} items, {totalItems} units</p>
                </div>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {orderLines.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
                      <ShoppingBag className="h-10 w-10 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Your cart is empty</h3>
                    <p className="text-gray-500">Add products to get started</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {orderLines.map(line => {
                    const lineKey = `${line.itemId}|${line.referenceNumber || ''}|${line.isBulkOrder ? 'bulk' : 'single'}`
                    const actualQty = line.isBulkOrder && line.unitsPerBulk ? line.quantity * line.unitsPerBulk : line.quantity

                    return (
                      <div
                        key={lineKey}
                        className={`p-4 rounded-xl border-2 ${
                          line.isBulkOrder
                            ? 'bg-blue-50/50 border-blue-200'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 truncate">{line.item.name}</h4>
                            <p className="text-sm text-gray-500 font-mono">
                              {line.item.itemCode || line.item.sku}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              {line.referenceNumber && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                                  <Hash className="h-3 w-3 mr-1" />{line.referenceNumber}
                                </span>
                              )}
                              {line.isBulkOrder && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                                  {line.bulkUnitName}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(line.itemId, line.referenceNumber, line.isBulkOrder)}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200/50">
                          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden bg-white">
                            <button
                              type="button"
                              className="p-1.5 hover:bg-gray-100 disabled:opacity-40"
                              onClick={() => updateCartQuantity(line.itemId, line.referenceNumber, line.isBulkOrder || false, line.quantity - 1)}
                              disabled={line.quantity <= 1}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-10 text-center text-sm font-semibold">{line.quantity}</span>
                            <button
                              type="button"
                              className="p-1.5 hover:bg-gray-100"
                              onClick={() => updateCartQuantity(line.itemId, line.referenceNumber, line.isBulkOrder || false, line.quantity + 1)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="text-right">
                            {line.unitPrice !== undefined && (
                              <div className="font-bold text-gray-900">${(line.unitPrice * line.quantity).toFixed(2)}</div>
                            )}
                            <div className="text-xs text-gray-500">{actualQty} units</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Shipping & Notes Section */}
            {orderLines.length > 0 && (
              <div className="border-t border-gray-200 p-6 space-y-5 bg-gray-50">
                {/* Shipping Address */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-700" />
                      Shipping Address
                    </h3>
                    <button
                      onClick={() => setEditingAddress(!editingAddress)}
                      className="text-sm text-gray-700 hover:text-gray-900 font-medium flex items-center gap-1"
                    >
                      {editingAddress ? <><Check className="h-4 w-4" />Done</> : <><Pencil className="h-4 w-4" />Edit</>}
                    </button>
                  </div>

                  {editingAddress ? (
                    <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-200">
                      <Input
                        value={shippingAddress.shipToName}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, shipToName: e.target.value }))}
                        placeholder="Recipient name"
                        className="rounded-lg"
                      />
                      <Input
                        value={shippingAddress.shipToAddress1}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, shipToAddress1: e.target.value }))}
                        placeholder="Address line 1"
                        className="rounded-lg"
                      />
                      <Input
                        value={shippingAddress.shipToAddress2}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, shipToAddress2: e.target.value }))}
                        placeholder="Address line 2"
                        className="rounded-lg"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          value={shippingAddress.shipToCity}
                          onChange={(e) => setShippingAddress(prev => ({ ...prev, shipToCity: e.target.value }))}
                          placeholder="City"
                          className="rounded-lg"
                        />
                        <Input
                          value={shippingAddress.shipToState}
                          onChange={(e) => setShippingAddress(prev => ({ ...prev, shipToState: e.target.value }))}
                          placeholder="State"
                          className="rounded-lg"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          value={shippingAddress.shipToZip}
                          onChange={(e) => setShippingAddress(prev => ({ ...prev, shipToZip: e.target.value }))}
                          placeholder="ZIP Code"
                          className="rounded-lg"
                        />
                        <Input
                          value={shippingAddress.shipToPhone}
                          onChange={(e) => setShippingAddress(prev => ({ ...prev, shipToPhone: e.target.value }))}
                          placeholder="Phone"
                          className="rounded-lg"
                        />
                      </div>
                    </div>
                  ) : shippingAddress.shipToAddress1 ? (
                    <div className="text-sm text-gray-600 bg-white p-4 rounded-xl border border-gray-200">
                      {shippingAddress.shipToName && <div className="font-medium text-gray-900">{shippingAddress.shipToName}</div>}
                      <div>{shippingAddress.shipToAddress1}</div>
                      {shippingAddress.shipToAddress2 && <div>{shippingAddress.shipToAddress2}</div>}
                      <div>{shippingAddress.shipToCity}, {shippingAddress.shipToState} {shippingAddress.shipToZip}</div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">Please add a shipping address</span>
                    </div>
                  )}
                </div>

                {/* Order Notes */}
                <div>
                  <Label htmlFor="notes" className="text-sm font-semibold text-gray-900 mb-2 block">
                    Order Notes (Optional)
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any special instructions..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="rounded-xl resize-none"
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* Cart Footer */}
            <div className="border-t border-gray-200 p-6 bg-white">
              {message && (
                <div className={`p-3 rounded-xl mb-4 flex items-center gap-2 ${
                  message.type === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">{message.text}</span>
                </div>
              )}

              <div className="flex items-center justify-between mb-5">
                <div>
                  <span className="text-gray-500">Total</span>
                  <span className="text-sm text-gray-400 ml-1">({totalItems} units)</span>
                </div>
                <span className="text-3xl font-bold text-gray-900">${totalPrice.toFixed(2)}</span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || !canSubmit}
                className={`w-full py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                  submitting || !canSubmit
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-900 hover:bg-gray-800 text-white shadow-lg shadow-gray-900/25 hover:shadow-xl hover:shadow-gray-900/30'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creating Order...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Place Order
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reference Number Selection Dialog */}
      <Dialog open={refDialogOpen} onOpenChange={setRefDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-xl bg-amber-100">
                <Hash className="h-5 w-5 text-amber-700" />
              </div>
              Select PO# (Reference Number)
              {refDialogIsBulk && (
                <Badge className="bg-blue-100 text-blue-700 border-0">
                  {refDialogItem?.bulkUnitName || 'Bulk'} Order
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Select a reference number for {refDialogItem?.name}
            </DialogDescription>
            {refDialogItem && (
              <div className="bg-gray-50 rounded-xl p-3 mt-2">
                <p className="font-medium text-gray-900">{refDialogItem.name}</p>
                <p className="text-sm font-mono text-gray-500">{refDialogItem.sku || refDialogItem.itemCode}</p>
              </div>
            )}
          </DialogHeader>

          {refDialogItem?.stockByReference && refDialogItem.stockByReference.length > 0 ? (
            (() => {
              const getInCartForRef = (refNum: string | null) => {
                const cartLine = orderLines.find(l => l.itemId === refDialogItem.id && l.referenceNumber === refNum && l.isBulkOrder === refDialogIsBulk)
                if (cartLine?.isBulkOrder && cartLine?.unitsPerBulk) return cartLine.quantity * cartLine.unitsPerBulk
                return cartLine?.quantity || 0
              }

              const stockWithRemaining = refDialogItem.stockByReference.map(stock => {
                const inCartUnits = getInCartForRef(stock.referenceNumber)
                const remainingUnits = stock.available - inCartUnits
                const remaining = refDialogIsBulk && refDialogItem.unitsPerBulk
                  ? Math.floor(remainingUnits / refDialogItem.unitsPerBulk)
                  : remainingUnits
                return {
                  ...stock,
                  inCart: refDialogIsBulk && refDialogItem.unitsPerBulk ? Math.floor(inCartUnits / refDialogItem.unitsPerBulk) : inCartUnits,
                  remaining,
                }
              })

              const selectedStock = stockWithRemaining.find(s => s.referenceNumber === selectedRef)
              const maxQtyForSelected = selectedStock?.remaining || 0

              return (
                <div className="space-y-5 py-4">
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-3 block">Available by PO#</Label>
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                      {stockWithRemaining.map((stock) => {
                        const isSelected = selectedRef === stock.referenceNumber
                        const isMaxedOut = stock.remaining <= 0
                        return (
                          <button
                            key={stock.referenceNumber || '__no_ref__'}
                            type="button"
                            disabled={isMaxedOut}
                            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                              isMaxedOut
                                ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
                                : isSelected
                                  ? 'border-gray-900 bg-gray-100 ring-2 ring-gray-900/10'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                            onClick={() => !isMaxedOut && (setSelectedRef(stock.referenceNumber), setRefQty(Math.min(refQty, stock.remaining) || 1))}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                  isSelected ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
                                }`}>
                                  {isSelected && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <span className="font-mono font-semibold text-gray-900">{stock.referenceNumber || '(No PO#)'}</span>
                              </div>
                              <Badge variant={isMaxedOut ? 'destructive' : 'secondary'} className="rounded-lg">
                                {isMaxedOut ? 'Max in Cart' : `${stock.remaining} available`}
                              </Badge>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-3 block">Quantity</Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="px-4 py-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors rounded-xl"
                        onClick={() => setRefQty(Math.max(1, refQty - 1))}
                        disabled={refQty <= 1}
                      >
                        <span className="text-lg font-bold text-gray-700">−</span>
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={refQty}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '')
                          setRefQty(Math.min(Math.max(1, parseInt(val) || 1), maxQtyForSelected))
                        }}
                        className="flex-1 text-center text-lg font-semibold py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-gray-900"
                      />
                      <button
                        type="button"
                        className="px-4 py-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors rounded-xl"
                        onClick={() => setRefQty(Math.min(refQty + 1, maxQtyForSelected))}
                        disabled={refQty >= maxQtyForSelected}
                      >
                        <span className="text-lg font-bold text-gray-700">+</span>
                      </button>
                    </div>
                    {refDialogIsBulk && refDialogItem.unitsPerBulk && (
                      <p className="text-sm text-gray-500 mt-2 text-center">= {refQty * refDialogItem.unitsPerBulk} units</p>
                    )}
                  </div>
                </div>
              )
            })()
          ) : (
            <div className="text-center py-10">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <Package className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500">No stock available</p>
            </div>
          )}

          <DialogFooter className="gap-3 pt-2">
            <Button variant="outline" onClick={() => setRefDialogOpen(false)} className="rounded-xl px-6">Cancel</Button>
            <Button
              onClick={confirmAddWithRef}
              className="bg-gray-900 hover:bg-gray-800 rounded-xl px-6"
            >
              <Plus className="h-4 w-4 mr-2" />Add to Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Order Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={(open) => { setBulkDialogOpen(open); if (!open) setBulkDialogItem(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-xl bg-gray-100">
                <Package className="h-5 w-5 text-gray-700" />
              </div>
              Choose Order Type
            </DialogTitle>
            <DialogDescription className="pt-2">
              {bulkDialogItem && (
                <div className="bg-gray-50 rounded-xl p-3 mt-2">
                  <p className="font-medium text-gray-900">{bulkDialogItem.name}</p>
                  <p className="text-sm text-gray-500">{bulkDialogItem.available} units available</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {bulkDialogItem && (() => {
            const isBulk = bulkDialogOrderType === 'bulk'
            const maxIndividual = bulkDialogItem.available
            const maxBulk = Math.floor(bulkDialogItem.available / (bulkDialogItem.unitsPerBulk || 1))
            const maxQty = isBulk ? maxBulk : maxIndividual

            return (
              <div className="space-y-5 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => { setBulkDialogOrderType('individual'); setBulkDialogQty(Math.min(bulkDialogQty, maxIndividual) || 1) }}
                    className={`p-5 border-2 rounded-2xl text-left transition-all ${
                      bulkDialogOrderType === 'individual'
                        ? 'border-gray-900 bg-gray-100 ring-2 ring-gray-900/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                      <Package className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="font-semibold text-gray-900 mb-1">Individual Units</div>
                    {bulkDialogItem.sellPrice && (
                      <div className="text-lg font-bold text-gray-900">${Number(bulkDialogItem.sellPrice).toFixed(2)}<span className="text-sm font-normal text-gray-500">/unit</span></div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">Max: {maxIndividual}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBulkDialogOrderType('bulk'); setBulkDialogQty(Math.min(bulkDialogQty, maxBulk) || 1) }}
                    className={`p-5 border-2 rounded-2xl text-left transition-all ${
                      bulkDialogOrderType === 'bulk'
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20'
                        : 'border-gray-200 hover:border-blue-200'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                      <ShoppingBag className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="font-semibold text-blue-700 mb-1">{bulkDialogItem.bulkUnitName || 'Bulk'}</div>
                    {bulkDialogItem.bulkSellPrice && (
                      <div className="text-lg font-bold text-blue-600">
                        ${Number(bulkDialogItem.bulkSellPrice).toFixed(2)}
                        <span className="text-sm font-normal text-gray-500">/{(bulkDialogItem.bulkUnitName || 'bulk').toLowerCase()}</span>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">{bulkDialogItem.unitsPerBulk} units each | Max: {maxBulk}</div>
                  </button>
                </div>

                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-3 block">Quantity</Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-4 py-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors rounded-xl"
                      onClick={() => setBulkDialogQty(Math.max(1, bulkDialogQty - 1))}
                      disabled={bulkDialogQty <= 1}
                    >
                      <span className="text-lg font-bold text-gray-700">−</span>
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={bulkDialogQty}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '')
                        setBulkDialogQty(Math.min(Math.max(1, parseInt(val) || 1), maxQty))
                      }}
                      className="flex-1 text-center text-lg font-semibold py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-gray-900"
                    />
                    <button
                      type="button"
                      className="px-4 py-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors rounded-xl"
                      onClick={() => setBulkDialogQty(Math.min(bulkDialogQty + 1, maxQty))}
                      disabled={bulkDialogQty >= maxQty}
                    >
                      <span className="text-lg font-bold text-gray-700">+</span>
                    </button>
                  </div>
                  {isBulk && bulkDialogItem.unitsPerBulk && (
                    <p className="text-sm text-gray-500 mt-2 text-center">= {bulkDialogQty * bulkDialogItem.unitsPerBulk} units</p>
                  )}
                </div>

                {bulkDialogItem.trackByReference && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                    <Hash className="h-4 w-4" />
                    <span className="text-sm font-medium">You&apos;ll select a PO# in the next step</span>
                  </div>
                )}
              </div>
            )
          })()}

          <DialogFooter className="gap-3 pt-2">
            <Button variant="outline" onClick={() => { setBulkDialogOpen(false); setBulkDialogItem(null) }} className="rounded-xl px-6">Cancel</Button>
            <Button
              onClick={handleBulkDialogAdd}
              className="bg-gray-900 hover:bg-gray-800 rounded-xl px-6"
            >
              {bulkDialogItem?.trackByReference ? 'Next: Select PO#' : 'Add to Cart'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
