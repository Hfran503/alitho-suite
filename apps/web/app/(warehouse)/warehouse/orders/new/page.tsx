'use client'

import { useState, useEffect, useRef } from 'react'
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
  ShoppingCart,
  ArrowLeft,
  Search,
  Plus,
  Minus,
  MapPin,
  Loader2,
  Package,
  ShoppingBag,
  X,
  Hash,
  Pencil,
  Check,
  Calendar,
  Truck,
} from 'lucide-react'

interface Customer {
  id: string
  name: string
  company: string | null
  paceCustomerId: string | null
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
  unitPrice?: number // Price per unit (or per bulk unit if isBulkOrder)
}

interface ShipViaOption {
  id: number
  description: string
  active: boolean
  providerId: number | null
  providerName: string | null
}

const STORAGE_KEY = 'storefront-order-draft'

export default function NewOrderPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const previousCustomerIdRef = useRef<string | null>(null)

  // Customer selection
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Items
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [itemSearch, setItemSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [categories, setCategories] = useState<string[]>([])

  // Cart
  const [orderLines, setOrderLines] = useState<OrderLine[]>([])

  // Quantity input per item (before adding to cart)
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({})

  // Reference number dialog
  const [refDialogOpen, setRefDialogOpen] = useState(false)
  const [refDialogItem, setRefDialogItem] = useState<InventoryItem | null>(null)
  const [selectedRef, setSelectedRef] = useState<string | null>(null)
  const [refQty, setRefQty] = useState(1)
  const [refDialogIsBulk, setRefDialogIsBulk] = useState(false) // Track bulk order for ref dialog

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

  // Change customer confirmation dialog
  const [changeCustomerDialogOpen, setChangeCustomerDialogOpen] = useState(false)

  // Bulk order type selection dialog
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkDialogItem, setBulkDialogItem] = useState<InventoryItem | null>(null)
  const [bulkDialogOrderType, setBulkDialogOrderType] = useState<'individual' | 'bulk'>('individual')
  const [bulkDialogQty, setBulkDialogQty] = useState(1)

  // PACE settings
  const [shipViaOptions, setShipViaOptions] = useState<ShipViaOption[]>([])
  const [loadingShipVia, setLoadingShipVia] = useState(false)
  const [paceShipDate, setPaceShipDate] = useState('')
  const [paceShipProvider, setPaceShipProvider] = useState<string>('')
  const [paceShipVia, setPaceShipVia] = useState<string>('')

  // Load saved draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const draft = JSON.parse(saved)
        if (draft.selectedCustomerId) setSelectedCustomerId(draft.selectedCustomerId)
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
    if (!isHydrated) return // Don't save until we've loaded

    const draft = {
      selectedCustomerId,
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
  }, [isHydrated, selectedCustomerId, orderLines, shippingAddress, notes])

  // Clear draft from localStorage
  const clearDraft = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      console.error('Error clearing draft:', e)
    }
  }

  // Load customers on mount
  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/warehouse/customers?activeOnly=true')
      const data = await response.json()
      if (data.success) {
        setCustomers(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  // Fetch ship via options when customer has paceCustomerId
  useEffect(() => {
    const fetchShipViaOptions = async () => {
      if (!selectedCustomer?.paceCustomerId) {
        setShipViaOptions([])
        return
      }

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

    fetchShipViaOptions()
  }, [selectedCustomer?.paceCustomerId])

  // Fetch items function (not a useCallback to avoid extra re-renders)
  const fetchItems = async (customerId: string, search: string, category: string) => {
    setLoadingItems(true)
    try {
      const params = new URLSearchParams({
        limit: '200',
        isActive: 'true',
        // Exclude KIT_COMPONENT - they can only be ordered as part of a kit
        itemType: 'STANDARD,KIT_AND_COMPONENT,KIT',
      })
      if (customerId) {
        params.set('customerId', customerId)
      }
      if (search) {
        params.set('search', search)
      }
      if (category) {
        params.set('category', category)
      }

      const response = await fetch(`/api/warehouse/items?${params}`)
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

  // Fetch items when customer or category changes (immediate)
  useEffect(() => {
    if (selectedCustomerId) {
      fetchItems(selectedCustomerId, itemSearch, categoryFilter)
    } else {
      setItems([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId, categoryFilter])

  // Debounced search - only triggers on search text changes
  useEffect(() => {
    if (!selectedCustomerId) return

    const timer = setTimeout(() => {
      fetchItems(selectedCustomerId, itemSearch, categoryFilter)
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemSearch])

  // Update selected customer when ID changes
  useEffect(() => {
    if (selectedCustomerId) {
      const customer = customers.find(c => c.id === selectedCustomerId)
      setSelectedCustomer(customer || null)

      // Only update address and clear cart if this is a REAL customer change
      // (not the initial hydration from localStorage)
      // A real change is when: hydrated AND there was a previous customer AND it's different
      const isRealChange = isHydrated && previousCustomerIdRef.current !== null && previousCustomerIdRef.current !== selectedCustomerId

      if (customer && isRealChange) {
        setShippingAddress({
          shipToName: customer.shipToName || '',
          shipToAddress1: customer.shipToAddress1 || '',
          shipToAddress2: customer.shipToAddress2 || '',
          shipToCity: customer.shipToCity || '',
          shipToState: customer.shipToState || '',
          shipToZip: customer.shipToZip || '',
          shipToCountry: customer.shipToCountry || 'US',
          shipToPhone: customer.shipToPhone || '',
        })
        // Clear cart when customer changes
        setOrderLines([])
      }

      // Track the current customer ID for future comparisons
      previousCustomerIdRef.current = selectedCustomerId
    } else {
      setSelectedCustomer(null)
      // DON'T reset previousCustomerIdRef here - keep it so we can detect
      // when a NEW different customer is selected after clicking "Change Customer"
    }
  }, [selectedCustomerId, customers, isHydrated])

  // Get quantity in cart (for items with reference, use unique key)
  const getCartQuantity = (itemId: string, referenceNumber?: string | null) => {
    const lines = orderLines.filter(l => l.itemId === itemId)
    if (referenceNumber !== undefined) {
      const line = lines.find(l => l.referenceNumber === referenceNumber)
      return line?.quantity || 0
    }
    return lines.reduce((sum, l) => sum + l.quantity, 0)
  }

  // Get quantity input value for an item
  const getItemQtyInput = (itemId: string) => {
    return itemQuantities[itemId] || 1
  }

  const setItemQtyInput = (itemId: string, qty: number) => {
    setItemQuantities(prev => ({ ...prev, [itemId]: Math.max(1, qty) }))
  }

  // Open reference number dialog for trackByReference items
  const openRefDialog = (item: InventoryItem, isBulkOrder: boolean = false) => {
    setRefDialogItem(item)
    setSelectedRef(item.stockByReference?.[0]?.referenceNumber || null)
    setRefQty(getItemQtyInput(item.id))
    setRefDialogIsBulk(isBulkOrder)
    setRefDialogOpen(true)
  }

  // Add item to cart (with optional reference number and bulk order flag)
  const addToCart = (
    item: InventoryItem,
    quantity: number = 1,
    referenceNumber?: string | null,
    isBulkOrder: boolean = false
  ) => {
    // For bulk orders, find existing bulk line; for regular, find existing regular line
    const existing = orderLines.find(l =>
      l.itemId === item.id &&
      l.isBulkOrder === isBulkOrder &&
      (item.trackByReference ? l.referenceNumber === referenceNumber : true)
    )

    // Check available quantity
    let maxAvailable = item.available
    if (item.trackByReference && referenceNumber !== undefined) {
      const refStock = item.stockByReference?.find(s => s.referenceNumber === referenceNumber)
      maxAvailable = refStock?.available || 0
    }

    // For bulk orders, max is in bulk units (e.g., cases)
    if (isBulkOrder && item.unitsPerBulk) {
      maxAvailable = Math.floor(maxAvailable / item.unitsPerBulk)
    }

    const currentInCart = existing?.quantity || 0
    const newQty = Math.min(currentInCart + quantity, maxAvailable)

    if (existing) {
      if (newQty > currentInCart) {
        setOrderLines(prev => prev.map(l =>
          (l.itemId === item.id &&
           l.isBulkOrder === isBulkOrder &&
           (item.trackByReference ? l.referenceNumber === referenceNumber : true))
            ? { ...l, quantity: newQty }
            : l
        ))
      }
    } else if (newQty > 0) {
      // Determine unit price based on order type
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

    // Reset quantity input
    setItemQuantities(prev => ({ ...prev, [item.id]: 1 }))
  }

  // Handle adding to cart button click
  const handleAddToCart = (item: InventoryItem) => {
    // If item has bulk ordering enabled, show order type selection dialog first
    if (item.canOrderInBulk) {
      setBulkDialogItem(item)
      setBulkDialogOrderType('individual')
      setBulkDialogQty(1)
      setBulkDialogOpen(true)
      return
    }

    // Otherwise proceed with normal flow
    proceedToAddItem(item, false)
  }

  // Helper to proceed with adding item after order type is selected
  const proceedToAddItem = (item: InventoryItem, isBulkOrder: boolean) => {
    const qty = getItemQtyInput(item.id)

    if (item.trackByReference && item.stockByReference && item.stockByReference.length > 0) {
      // Open dialog to select reference number with bulk flag
      openRefDialog(item, isBulkOrder)
    } else {
      // Add to cart with selected quantity
      addToCart(item, qty, undefined, isBulkOrder)
    }
  }

  // Handle bulk order type selection - called when Add button is clicked in the dialog
  const handleBulkDialogAdd = () => {
    if (!bulkDialogItem) return

    const isBulkOrder = bulkDialogOrderType === 'bulk'

    // If item has trackByReference, open the ref dialog
    if (bulkDialogItem.trackByReference && bulkDialogItem.stockByReference && bulkDialogItem.stockByReference.length > 0) {
      setBulkDialogOpen(false)
      setRefDialogItem(bulkDialogItem)
      setSelectedRef(bulkDialogItem.stockByReference[0]?.referenceNumber || null)
      setRefQty(bulkDialogQty)
      setRefDialogIsBulk(isBulkOrder)
      setRefDialogOpen(true)
      setBulkDialogItem(null)
    } else {
      // Add directly to cart
      addToCart(bulkDialogItem, bulkDialogQty, undefined, isBulkOrder)
      setBulkDialogOpen(false)
      setBulkDialogItem(null)
    }
  }

  // Confirm add from reference dialog
  const confirmAddWithRef = () => {
    if (refDialogItem && refQty > 0) {
      addToCart(refDialogItem, refQty, selectedRef, refDialogIsBulk)
      setRefDialogOpen(false)
      setRefDialogItem(null)
      setRefDialogIsBulk(false)
    }
  }

  const removeFromCart = (itemId: string, referenceNumber?: string | null) => {
    setOrderLines(prev => prev.filter(l =>
      !(l.itemId === itemId && (referenceNumber !== undefined ? l.referenceNumber === referenceNumber : true))
    ))
  }

  const handleChangeCustomer = () => {
    if (orderLines.length > 0) {
      setChangeCustomerDialogOpen(true)
    } else {
      setSelectedCustomerId('')
    }
  }

  const confirmChangeCustomer = () => {
    setChangeCustomerDialogOpen(false)
    setSelectedCustomerId('')
  }

  // Generate special information for PACE shipment
  const generateSpecialInfo = () => {
    const lines: string[] = []
    for (const line of orderLines) {
      const sku = line.item.itemCode || line.item.sku || ''
      const description = line.item.name || ''
      const isBulk = line.isBulkOrder && line.unitsPerBulk
      const unitsPerBulk = line.unitsPerBulk || 1
      const bulkUnitName = line.bulkUnitName || 'Case'
      // Calculate actual units
      const actualUnits = isBulk ? line.quantity * unitsPerBulk : line.quantity

      if (isBulk) {
        // Format: SKU - Description (Bulk): X Cartons (X x Y = Z units)
        lines.push(`${sku} - ${description} (Bulk): ${line.quantity} ${bulkUnitName}${line.quantity !== 1 ? 's' : ''} (${line.quantity} x ${unitsPerBulk} = ${actualUnits} units)`)
      } else {
        // Format: SKU - Description: X units
        lines.push(`${sku} - ${description}: ${line.quantity} units`)
      }
    }

    // Add notes if present
    if (notes) {
      lines.push('')
      lines.push(`Notes: ${notes}`)
    }

    return lines.join('\n')
  }

  const handleSubmit = async () => {
    if (!selectedCustomerId) {
      setMessage({ type: 'error', text: 'Please select a customer' })
      return
    }

    if (orderLines.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one item' })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/warehouse/storefront-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          ...shippingAddress,
          notes: notes || undefined,
          items: orderLines.map(line => ({
            itemId: line.itemId,
            // For bulk orders, convert bulk units to actual units
            quantity: line.isBulkOrder && line.unitsPerBulk
              ? line.quantity * line.unitsPerBulk
              : line.quantity,
            // For bulk orders, convert bulk price to per-unit price
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

        // Auto-send to PACE if customer has paceCustomerId
        if (selectedCustomer?.paceCustomerId) {
          try {
            const paceResponse = await fetch(`/api/warehouse/storefront-orders/${orderId}/send-to-pace`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                shipDate: paceShipDate || undefined,
                shipVia: paceShipVia ? parseInt(paceShipVia, 10) : undefined,
                shipmentType: 205, // Hardcoded shipment type
                specialInformation: generateSpecialInfo(),
              }),
            })

            const paceData = await paceResponse.json()
            if (!paceData.success) {
              console.error('Failed to auto-send to PACE:', paceData.error)
              // Order was created, just PACE failed - still redirect but could show warning
            }
          } catch (paceError) {
            console.error('Error auto-sending to PACE:', paceError)
            // Order was created, just PACE failed - still redirect
          }
        }

        clearDraft()
        router.push('/warehouse/orders')
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

  // Calculate total units (convert bulk quantities to actual units)
  const totalItems = orderLines.reduce((sum, line) => {
    const qty = line.isBulkOrder && line.unitsPerBulk
      ? line.quantity * line.unitsPerBulk
      : line.quantity
    return sum + qty
  }, 0)
  const totalLineItems = orderLines.length

  // Calculate total price
  const totalPrice = orderLines.reduce((sum, line) => {
    if (line.unitPrice !== undefined) {
      return sum + (line.unitPrice * line.quantity)
    }
    return sum
  }, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/warehouse/orders"
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">New Order</h1>
              {selectedCustomer && (
                <p className="text-sm text-gray-500">{selectedCustomer.name}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {/* Customer Selection */}
        {!selectedCustomerId ? (
          <div className="bg-white rounded-lg shadow p-8 text-center max-w-md mx-auto">
            <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h2 className="text-lg font-semibold mb-2">Select a Customer</h2>
            <p className="text-gray-500 mb-6">Choose a customer to start their order</p>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a customer..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map(customer => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} {customer.company ? `(${customer.company})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Products Section - Left */}
            <div className="flex-1 min-w-0">
              {/* Customer Badge & Change */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-base py-1 px-3">
                    {selectedCustomer?.name}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleChangeCustomer}
                  >
                    Change Customer
                  </Button>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px] max-w-md relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search products..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="w-48">
                    <Select value={categoryFilter || '_all'} onValueChange={(v) => setCategoryFilter(v === '_all' ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">All Categories</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Products Grid */}
              {loadingItems ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                  <p className="mt-2 text-gray-500">Loading products...</p>
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900">No products found</h3>
                  <p className="text-gray-500">
                    {itemSearch || categoryFilter
                      ? 'Try adjusting your filters'
                      : 'No products available for this customer'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                  {items.map(item => {
                    const inCart = getCartQuantity(item.id)
                    const remainingAvailable = item.available - inCart
                    const isOutOfStock = remainingAvailable <= 0
                    const qtyInput = getItemQtyInput(item.id)

                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-lg shadow overflow-hidden ${
                          isOutOfStock ? 'opacity-60' : ''
                        }`}
                      >
                        {/* Product Image Placeholder */}
                        <div className="h-28 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative">
                          <Package className="h-10 w-10 text-gray-300" />
                          <div className="absolute top-2 right-2 flex flex-col gap-1">
                            {item.trackByReference && (
                              <Badge variant="outline" className="bg-white text-xs">
                                <Hash className="h-3 w-3 mr-1" />
                                PO#
                              </Badge>
                            )}
                            {item.canOrderInBulk && (
                              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-xs">
                                {item.bulkUnitName || 'Bulk'}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Product Info */}
                        <div className="p-3">
                          <div className="text-xs font-mono text-gray-500 mb-1 space-x-2">
                            {item.itemCode && <span>{item.itemCode}</span>}
                            {item.itemCode && item.sku && <span className="text-gray-300">|</span>}
                            {item.sku && <span className="text-gray-400">{item.sku}</span>}
                          </div>
                          <h3 className="font-medium text-gray-900 text-sm line-clamp-2 min-h-[2.5rem]">
                            {item.name}
                          </h3>
                          {item.category && (
                            <Badge variant="secondary" className="mt-1 text-xs">
                              {item.category}
                            </Badge>
                          )}

                          {/* Price */}
                          {(item.sellPrice || item.bulkSellPrice) && (
                            <div className="mt-2 text-sm">
                              {item.sellPrice && (
                                <span className="text-gray-700 font-medium">
                                  ${Number(item.sellPrice).toFixed(2)}
                                  <span className="text-gray-400 font-normal">/unit</span>
                                </span>
                              )}
                              {item.sellPrice && item.bulkSellPrice && (
                                <span className="text-gray-300 mx-1">•</span>
                              )}
                              {item.bulkSellPrice && (
                                <span className="text-blue-600 font-medium">
                                  ${Number(item.bulkSellPrice).toFixed(2)}
                                  <span className="text-blue-400 font-normal">/{item.bulkUnitName?.toLowerCase() || 'bulk'}</span>
                                </span>
                              )}
                            </div>
                          )}

                          {/* Stock & In Cart */}
                          <div className="mt-2 flex items-center justify-between text-sm">
                            <span className={isOutOfStock ? 'text-red-600' : 'text-gray-600'}>
                              {item.available <= 0 ? 'Out of stock' : `${item.available} avail`}
                            </span>
                            {inCart > 0 && (
                              <span className="text-emerald-600 font-medium">
                                {inCart} in cart
                              </span>
                            )}
                          </div>

                          {/* Add to Cart */}
                          <div className="mt-3">
                            {!isOutOfStock ? (
                              item.canOrderInBulk ? (
                                // For bulk-enabled items, just show a single Add button
                                <Button
                                  className="w-full bg-emerald-600 hover:bg-emerald-700 h-9"
                                  onClick={() => handleAddToCart(item)}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add to Cart
                                </Button>
                              ) : (
                                // For regular items, show quantity selector
                                <div className="flex gap-2">
                                  <div className="flex items-center border rounded-md bg-gray-50">
                                    <button
                                      type="button"
                                      className="px-2 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-l-md transition-colors disabled:opacity-40"
                                      onClick={() => setItemQtyInput(item.id, qtyInput - 1)}
                                      disabled={qtyInput <= 1}
                                    >
                                      <Minus className="h-4 w-4" />
                                    </button>
                                    <span className="w-10 text-center text-sm font-medium">
                                      {qtyInput}
                                    </span>
                                    <button
                                      type="button"
                                      className="px-2 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-r-md transition-colors disabled:opacity-40"
                                      onClick={() => setItemQtyInput(item.id, Math.min(qtyInput + 1, remainingAvailable))}
                                      disabled={qtyInput >= remainingAvailable}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </button>
                                  </div>
                                  <Button
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-9"
                                    onClick={() => handleAddToCart(item)}
                                  >
                                    {item.trackByReference ? 'Select PO#' : 'Add'}
                                  </Button>
                                </div>
                              )
                            ) : (
                              <Button
                                className="w-full bg-gray-400 cursor-not-allowed h-9"
                                disabled
                              >
                                {inCart > 0 ? 'Max in Cart' : 'Out of Stock'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Cart Sidebar - Right (always visible) */}
            <div className="w-80 lg:w-96 flex-shrink-0">
              <div className="bg-white rounded-lg shadow sticky top-24 flex flex-col max-h-[calc(100vh-8rem)]">
                {/* Cart Header */}
                <div className="p-4 border-b">
                  <h2 className="font-semibold flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Cart
                    {totalItems > 0 && (
                      <Badge className="bg-emerald-600 text-white ml-auto">
                        {totalItems}
                      </Badge>
                    )}
                  </h2>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      {totalLineItems} product{totalLineItems !== 1 ? 's' : ''}, {totalItems} items
                    </p>
                    {totalPrice > 0 && (
                      <p className="text-sm font-medium text-gray-700">
                        ${totalPrice.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-4">
                  {orderLines.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <ShoppingBag className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Your cart is empty</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {orderLines.map(line => {
                        const lineKey = line.referenceNumber
                          ? `${line.itemId}|${line.referenceNumber}|${line.isBulkOrder ? 'bulk' : 'single'}`
                          : `${line.itemId}|${line.isBulkOrder ? 'bulk' : 'single'}`

                        return (
                          <div key={lineKey} className={`p-2 rounded-lg ${line.isBulkOrder ? 'bg-blue-50' : 'bg-gray-50'}`}>
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate flex items-center gap-1">
                                  {line.item.name}
                                  {line.isBulkOrder && (
                                    <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                                      {line.bulkUnitName}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 font-mono flex items-center gap-1.5">
                                  <span>{line.item.sku || line.item.itemCode}</span>
                                  {line.referenceNumber && (
                                    <>
                                      <span className="text-gray-300">•</span>
                                      <span className="text-emerald-600">PO# {line.referenceNumber}</span>
                                    </>
                                  )}
                                </div>
                                <div className="text-xs text-gray-600 mt-1 flex items-center justify-between">
                                  <span>
                                    {line.isBulkOrder && line.unitsPerBulk ? (
                                      <>Qty: {line.quantity} {line.bulkUnitName?.toLowerCase()} ({line.quantity * line.unitsPerBulk} units)</>
                                    ) : (
                                      <>Qty: {line.quantity}</>
                                    )}
                                  </span>
                                  {line.unitPrice !== undefined && (
                                    <span className="font-medium text-gray-700">
                                      ${(line.unitPrice * line.quantity).toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => removeFromCart(line.itemId, line.referenceNumber)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Shipping Address */}
                  {orderLines.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-sm flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          Ship To
                        </h3>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingAddress(!editingAddress)}
                          className="h-6 px-2 text-xs"
                        >
                          {editingAddress ? (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              Done
                            </>
                          ) : (
                            <>
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </>
                          )}
                        </Button>
                      </div>

                      {editingAddress ? (
                        <div className="space-y-2 bg-gray-50 p-2 rounded-lg text-sm">
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
                        </div>
                      ) : shippingAddress.shipToAddress1 ? (
                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg">
                          {shippingAddress.shipToName && <div className="font-medium">{shippingAddress.shipToName}</div>}
                          <div>{shippingAddress.shipToAddress1}</div>
                          {shippingAddress.shipToAddress2 && <div>{shippingAddress.shipToAddress2}</div>}
                          <div>
                            {shippingAddress.shipToCity}, {shippingAddress.shipToState} {shippingAddress.shipToZip}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 italic bg-gray-50 p-2 rounded-lg">
                          No address.{' '}
                          <button
                            type="button"
                            className="text-emerald-600 hover:underline"
                            onClick={() => setEditingAddress(true)}
                          >
                            Add
                          </button>
                        </div>
                      )}

                      {/* Notes */}
                      <div className="mt-3">
                        <Label htmlFor="notes" className="text-xs">Notes</Label>
                        <Textarea
                          id="notes"
                          placeholder="Order notes..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="mt-1 text-sm"
                          rows={2}
                        />
                      </div>

                      {/* PACE Shipment Settings - Only show if customer has paceCustomerId */}
                      {selectedCustomer?.paceCustomerId && (
                        <div className="mt-4 pt-3 border-t">
                          <Label className="text-xs flex items-center gap-1 mb-2">
                            <Truck className="h-3 w-3" />
                            PACE Shipment Settings
                          </Label>
                          <div className="space-y-2">
                            {/* Expected Ship Date */}
                            <div>
                              <Label htmlFor="paceShipDate" className="text-xs text-gray-500">
                                <Calendar className="h-3 w-3 inline mr-1" />
                                Ship Date
                              </Label>
                              <Input
                                id="paceShipDate"
                                type="date"
                                value={paceShipDate}
                                onChange={(e) => setPaceShipDate(e.target.value)}
                                className="h-8 text-sm mt-1"
                              />
                            </div>

                            {/* Carrier (Ship Provider) */}
                            <div>
                              <Label htmlFor="paceShipProvider" className="text-xs text-gray-500">
                                <Truck className="h-3 w-3 inline mr-1" />
                                Carrier
                              </Label>
                              {loadingShipVia ? (
                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Loading...
                                </div>
                              ) : (
                                <Select
                                  value={paceShipProvider}
                                  onValueChange={(value) => {
                                    setPaceShipProvider(value)
                                    setPaceShipVia('') // Reset service when carrier changes
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-sm mt-1">
                                    <SelectValue placeholder="Select carrier" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[...new Map(shipViaOptions
                                      .filter(o => o.providerId && o.providerName)
                                      .map(o => [o.providerId, o.providerName])
                                    ).entries()].map(([id, name]) => (
                                      <SelectItem key={id} value={String(id)}>
                                        {name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>

                            {/* Service (Ship Via) */}
                            <div>
                              <Label htmlFor="paceShipVia" className="text-xs text-gray-500">
                                <Truck className="h-3 w-3 inline mr-1" />
                                Service
                              </Label>
                              <Select
                                value={paceShipVia}
                                onValueChange={setPaceShipVia}
                                disabled={!paceShipProvider}
                              >
                                <SelectTrigger className="h-8 text-sm mt-1">
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
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Cart Footer */}
                <div className="p-4 border-t">
                  {message && (
                    <div className={`p-2 rounded text-sm mb-3 ${
                      message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                    }`}>
                      {message.text}
                    </div>
                  )}
                  {(() => {
                    const hasShippingAddress = shippingAddress.shipToAddress1 && shippingAddress.shipToCity && shippingAddress.shipToState && shippingAddress.shipToZip
                    const canSubmit = orderLines.length > 0 && hasShippingAddress

                    return (
                      <>
                        {orderLines.length > 0 && !hasShippingAddress && (
                          <div className="text-xs text-amber-600 mb-2 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            Shipping address required
                          </div>
                        )}
                        <Button
                          className="w-full bg-emerald-600 hover:bg-emerald-700"
                          onClick={handleSubmit}
                          disabled={submitting || !canSubmit}
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Creating...
                            </>
                          ) : (
                            <>
                              Place Order ({totalItems} items)
                            </>
                          )}
                        </Button>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reference Number Selection Dialog */}
      <Dialog open={refDialogOpen} onOpenChange={setRefDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Select PO# (Reference Number)
              {refDialogIsBulk && (
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                  {refDialogItem?.bulkUnitName || 'Bulk'} Order
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {refDialogItem && (
                <>
                  <span className="font-medium">{refDialogItem.name}</span>
                  <br />
                  <span className="text-xs font-mono">{refDialogItem.itemCode || refDialogItem.sku}</span>
                  {refDialogIsBulk && refDialogItem.unitsPerBulk && (
                    <span className="text-xs text-blue-600 block mt-1">
                      {refDialogItem.unitsPerBulk} units per {refDialogItem.bulkUnitName?.toLowerCase() || 'bulk'}
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {refDialogItem?.stockByReference && refDialogItem.stockByReference.length > 0 ? (
            (() => {
              // Calculate remaining available for each PO# (accounting for cart)
              const getInCartForRef = (refNum: string | null) => {
                const cartLine = orderLines.find(
                  l => l.itemId === refDialogItem.id &&
                       l.referenceNumber === refNum &&
                       l.isBulkOrder === refDialogIsBulk
                )
                // If cart has bulk items, convert to units for comparison
                if (cartLine?.isBulkOrder && cartLine?.unitsPerBulk) {
                  return cartLine.quantity * cartLine.unitsPerBulk
                }
                return cartLine?.quantity || 0
              }

              const stockWithRemaining = refDialogItem.stockByReference.map(stock => {
                const inCartUnits = getInCartForRef(stock.referenceNumber)
                const remainingUnits = stock.available - inCartUnits
                // For bulk orders, convert remaining to bulk units
                const remaining = refDialogIsBulk && refDialogItem.unitsPerBulk
                  ? Math.floor(remainingUnits / refDialogItem.unitsPerBulk)
                  : remainingUnits
                return {
                  ...stock,
                  inCart: refDialogIsBulk && refDialogItem.unitsPerBulk
                    ? Math.floor(inCartUnits / refDialogItem.unitsPerBulk)
                    : inCartUnits,
                  remaining,
                  remainingUnits // Keep for display
                }
              })

              const selectedStock = stockWithRemaining.find(s => s.referenceNumber === selectedRef)
              const maxQtyForSelected = selectedStock?.remaining || 0

              return (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Available by PO#</Label>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {stockWithRemaining.map((stock) => {
                        const refKey = stock.referenceNumber || '__no_ref__'
                        const isSelected = selectedRef === stock.referenceNumber
                        const isMaxedOut = stock.remaining <= 0
                        return (
                          <div
                            key={refKey}
                            className={`p-3 rounded-lg border transition-colors ${
                              isMaxedOut
                                ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                                : isSelected
                                  ? 'border-emerald-500 bg-emerald-50 cursor-pointer'
                                  : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                            }`}
                            onClick={() => {
                              if (!isMaxedOut) {
                                setSelectedRef(stock.referenceNumber)
                                setRefQty(Math.min(refQty, stock.remaining) || 1)
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded-full border-2 ${
                                  isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                                }`}>
                                  {isSelected && (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                    </div>
                                  )}
                                </div>
                                <span className="font-mono font-medium">
                                  {stock.referenceNumber || '(No PO#)'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {stock.inCart > 0 && (
                                  <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                                    {stock.inCart} {refDialogIsBulk ? refDialogItem?.bulkUnitName?.toLowerCase() || 'bulk' : ''} in cart
                                  </Badge>
                                )}
                                <Badge variant={isMaxedOut ? 'destructive' : 'secondary'}>
                                  {isMaxedOut
                                    ? 'Max in Cart'
                                    : refDialogIsBulk
                                      ? `${stock.remaining} ${refDialogItem?.bulkUnitName?.toLowerCase() || 'bulk'}`
                                      : `${stock.remaining} available`}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="refQty">
                      Quantity
                      {refDialogIsBulk && (
                        <span className="text-blue-600 font-normal ml-1">
                          ({refDialogItem?.bulkUnitName || 'bulk'})
                        </span>
                      )}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setRefQty(Math.max(1, refQty - 1))}
                        disabled={refQty <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        id="refQty"
                        type="number"
                        min="1"
                        max={maxQtyForSelected}
                        value={refQty}
                        onChange={(e) => {
                          setRefQty(Math.min(Math.max(1, parseInt(e.target.value) || 1), maxQtyForSelected))
                        }}
                        className="w-20 text-center"
                        disabled={maxQtyForSelected <= 0}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setRefQty(Math.min(refQty + 1, maxQtyForSelected))}
                        disabled={refQty >= maxQtyForSelected}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {refDialogIsBulk && refDialogItem?.unitsPerBulk && refQty > 0 && (
                      <p className="text-xs text-blue-600">
                        = {refQty * refDialogItem.unitsPerBulk} units total
                      </p>
                    )}
                  </div>
                </div>
              )
            })()
          ) : (
            <div className="text-center py-6 text-gray-500">
              <Package className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p>No stock available by reference number</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefDialogOpen(false)}>
              Cancel
            </Button>
            {(() => {
              // Calculate if we can add more
              const cartLine = orderLines.find(
                l => l.itemId === refDialogItem?.id && l.referenceNumber === selectedRef
              )
              const inCart = cartLine?.quantity || 0
              const stockAvailable = refDialogItem?.stockByReference?.find(s => s.referenceNumber === selectedRef)?.available || 0
              const canAdd = stockAvailable - inCart > 0

              return (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={confirmAddWithRef}
                  disabled={!canAdd || (!selectedRef && !refDialogItem?.stockByReference?.some(s => s.referenceNumber === null))}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add {refQty} {refDialogIsBulk ? (refDialogItem?.bulkUnitName || 'Bulk') : ''} to Cart
                </Button>
              )
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Customer Confirmation Dialog */}
      <Dialog open={changeCustomerDialogOpen} onOpenChange={setChangeCustomerDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Customer?</DialogTitle>
            <DialogDescription>
              You have {orderLines.length} item{orderLines.length !== 1 ? 's' : ''} in your cart.
              Changing the customer will clear your cart.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeCustomerDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmChangeCustomer}
            >
              Clear Cart & Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Order Type Selection Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={(open) => {
        setBulkDialogOpen(open)
        if (!open) setBulkDialogItem(null)
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Cart</DialogTitle>
            <DialogDescription>
              {bulkDialogItem && (
                <>
                  <span className="font-medium">{bulkDialogItem.name}</span>
                  <br />
                  <span className="text-xs font-mono">{bulkDialogItem.sku || bulkDialogItem.itemCode}</span>
                  <span className="text-xs text-emerald-600 ml-2">({bulkDialogItem.available} units available)</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {bulkDialogItem && (() => {
            const isBulk = bulkDialogOrderType === 'bulk'
            const maxIndividual = bulkDialogItem.available
            const maxBulk = Math.floor(bulkDialogItem.available / (bulkDialogItem.unitsPerBulk || 1))
            const maxQty = isBulk ? maxBulk : maxIndividual

            return (
              <div className="space-y-4">
                {/* Order Type Selection */}
                <div className="space-y-2">
                  <Label>Order Type</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setBulkDialogOrderType('individual')
                        setBulkDialogQty(Math.min(bulkDialogQty, maxIndividual) || 1)
                      }}
                      className={`p-3 border-2 rounded-lg transition-colors text-left ${
                        bulkDialogOrderType === 'individual'
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Package className="h-4 w-4 text-gray-600" />
                        <span className="font-medium text-sm">Individual</span>
                      </div>
                      {bulkDialogItem.sellPrice && (
                        <p className="text-sm font-medium text-gray-700">
                          ${Number(bulkDialogItem.sellPrice).toFixed(2)}/unit
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Max: {maxIndividual} units
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setBulkDialogOrderType('bulk')
                        setBulkDialogQty(Math.min(bulkDialogQty, maxBulk) || 1)
                      }}
                      className={`p-3 border-2 rounded-lg transition-colors text-left ${
                        bulkDialogOrderType === 'bulk'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Package className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-sm">{bulkDialogItem.bulkUnitName || 'Bulk'}</span>
                      </div>
                      {bulkDialogItem.bulkSellPrice && (
                        <p className="text-sm font-medium text-blue-700">
                          ${Number(bulkDialogItem.bulkSellPrice).toFixed(2)}/{bulkDialogItem.bulkUnitName?.toLowerCase() || 'bulk'}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {bulkDialogItem.unitsPerBulk} units/{bulkDialogItem.bulkUnitName?.toLowerCase() || 'bulk'} • Max: {maxBulk}
                      </p>
                    </button>
                  </div>
                </div>

                {/* Quantity Input */}
                <div className="space-y-2">
                  <Label>
                    Quantity
                    {isBulk && (
                      <span className="text-blue-600 font-normal ml-1">
                        ({bulkDialogItem.bulkUnitName || 'bulk'})
                      </span>
                    )}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setBulkDialogQty(Math.max(1, bulkDialogQty - 1))}
                      disabled={bulkDialogQty <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      max={maxQty}
                      value={bulkDialogQty}
                      onChange={(e) => {
                        setBulkDialogQty(Math.min(Math.max(1, parseInt(e.target.value) || 1), maxQty))
                      }}
                      className="w-20 text-center"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setBulkDialogQty(Math.min(bulkDialogQty + 1, maxQty))}
                      disabled={bulkDialogQty >= maxQty}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  {isBulk && bulkDialogItem.unitsPerBulk && bulkDialogQty > 0 && (
                    <p className="text-xs text-blue-600">
                      = {bulkDialogQty * bulkDialogItem.unitsPerBulk} units total
                    </p>
                  )}
                </div>

                {/* Price summary */}
                {(() => {
                  const unitPrice = isBulk
                    ? bulkDialogItem.bulkSellPrice
                    : bulkDialogItem.sellPrice
                  if (unitPrice) {
                    const total = Number(unitPrice) * bulkDialogQty
                    return (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {bulkDialogQty} × ${Number(unitPrice).toFixed(2)}
                          </span>
                          <span className="font-medium">${total.toFixed(2)}</span>
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Note about PO# selection */}
                {bulkDialogItem.trackByReference && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    You&apos;ll select a PO# in the next step
                  </p>
                )}
              </div>
            )
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setBulkDialogOpen(false)
              setBulkDialogItem(null)
            }}>
              Cancel
            </Button>
            <Button
              className={bulkDialogOrderType === 'bulk' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}
              onClick={handleBulkDialogAdd}
            >
              <Plus className="h-4 w-4 mr-1" />
              {bulkDialogItem?.trackByReference ? 'Next: Select PO#' : `Add ${bulkDialogQty} to Cart`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
