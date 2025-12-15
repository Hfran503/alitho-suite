'use client'

import { useState, useEffect, use } from 'react'
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

interface ItemStockData {
  item: {
    id: string
    sku: string
    name: string
    trackByReference: boolean
  } | null
  totalAvailable: number
  totalReserved: number
  totalDamaged: number
  totalOnHold: number
  locations: Array<{
    location: {
      id: string
      barcode: string
      name: string | null
      warehouseId: string
    }
    available: number
    reserved: number
    damaged: number
    onHold: number
    lotNumber: string | null
    referenceNumber: string | null
  }>
}

interface Transaction {
  id: string
  type: string
  quantity: number
  previousQty: number
  newQty: number
  notes: string | null
  createdAt: string
  lotNumber: string | null
  referenceNumber: string | null
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

interface PendingOrder {
  pickOrder: {
    id: string
    pickOrderNumber: string
    status: string
    priority: string
    destination: string
    createdAt: string
  }
  items: Array<{
    id: string
    referenceNumber: string | null
    lotNumber: string | null
    requestedQty: number
    pickedQty: number
    reservedQty: number
  }>
  totalReserved: number
}

interface PendingStorefrontOrder {
  storefrontOrder: {
    id: string
    orderNumber: string
    status: string
    shipToName: string | null
    shipToCity: string | null
    shipToState: string | null
    createdAt: string
    customer: {
      id: string
      name: string
      company: string | null
    }
  }
  items: Array<{
    id: string
    referenceNumber: string | null
    lotNumber: string | null
    quantity: number
  }>
  totalReserved: number
}

const TRANSACTION_TYPES: Record<string, { label: string; color: string }> = {
  RECEIVE: { label: 'Receive', color: 'bg-green-100 text-green-800' },
  SHIP: { label: 'Ship', color: 'bg-blue-100 text-blue-800' },
  ADJUST: { label: 'Adjust', color: 'bg-yellow-100 text-yellow-800' },
  TRANSFER: { label: 'Transfer', color: 'bg-purple-100 text-purple-800' },
  RESERVE: { label: 'Reserve', color: 'bg-orange-100 text-orange-800' },
  UNRESERVE: { label: 'Unreserve', color: 'bg-gray-100 text-gray-800' },
  DAMAGE: { label: 'Damage', color: 'bg-red-100 text-red-800' },
  PICK: { label: 'Pick', color: 'bg-indigo-100 text-indigo-800' },
}

export default function ItemInventoryPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = use(params)
  const [stockData, setStockData] = useState<ItemStockData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])
  const [pendingStorefrontOrders, setPendingStorefrontOrders] = useState<PendingStorefrontOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch stock data
        const stockResponse = await fetch(`/api/warehouse/inventory/item/${itemId}`)
        if (!stockResponse.ok) {
          throw new Error('Failed to fetch stock data')
        }
        const stockJson = await stockResponse.json()
        setStockData(stockJson.data)

        // Fetch recent transactions
        const txnResponse = await fetch(`/api/warehouse/inventory/transactions?itemId=${itemId}&limit=20`)
        if (txnResponse.ok) {
          const txnJson = await txnResponse.json()
          setTransactions(txnJson.data || [])
        }

        // Fetch pending pick orders
        const pendingResponse = await fetch(`/api/warehouse/inventory/item/${itemId}/pending-orders`)
        if (pendingResponse.ok) {
          const pendingJson = await pendingResponse.json()
          setPendingOrders(pendingJson.data?.pendingOrders || [])
        }

        // Fetch pending storefront orders
        const storefrontResponse = await fetch(`/api/warehouse/inventory/item/${itemId}/pending-storefront-orders`)
        if (storefrontResponse.ok) {
          const storefrontJson = await storefrontResponse.json()
          setPendingStorefrontOrders(storefrontJson.data?.pendingOrders || [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [itemId])

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
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

  if (error || !stockData?.item) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
        <p className="text-red-600">{error || 'Item not found'}</p>
        <Link href="/warehouse/inventory" className="text-emerald-600 hover:underline mt-4 inline-block">
          Back to Inventory
        </Link>
      </div>
    )
  }

  const totalQty = stockData.totalAvailable + stockData.totalReserved + stockData.totalDamaged + stockData.totalOnHold

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
            <span>{stockData.item.sku}</span>
          </div>
          <h1 className="text-2xl font-bold">{stockData.item.name}</h1>
          <p className="text-gray-600 font-mono">{stockData.item.sku}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/warehouse/items/${stockData.item.id}`}>
            <Button variant="outline">
              Edit Item
            </Button>
          </Link>
          <Link href={`/warehouse/inventory/adjust?itemId=${stockData.item.id}`}>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              Adjust Stock
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Stock</p>
          <p className="text-2xl font-bold">{totalQty}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Available</p>
          <p className="text-2xl font-bold text-green-600">{stockData.totalAvailable}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Reserved</p>
          <p className="text-2xl font-bold text-yellow-600">{stockData.totalReserved}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">On Hold</p>
          <p className="text-2xl font-bold text-orange-600">{stockData.totalOnHold}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Damaged</p>
          <p className="text-2xl font-bold text-red-600">{stockData.totalDamaged}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock by Location */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Stock by Location</h2>
            {stockData.item?.trackByReference && (
              <p className="text-sm text-gray-500">This item is tracked by reference number (PO#)</p>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                {stockData.item?.trackByReference && <TableHead>Ref # (PO)</TableHead>}
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">Damaged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockData.locations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={stockData.item?.trackByReference ? 5 : 4} className="text-center py-8 text-gray-500">
                    No stock at any location
                  </TableCell>
                </TableRow>
              ) : (
                stockData.locations.map((loc, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <div className="font-mono">{loc.location.barcode}</div>
                      {loc.lotNumber && (
                        <div className="text-xs text-gray-500">Lot: {loc.lotNumber}</div>
                      )}
                    </TableCell>
                    {stockData.item?.trackByReference && (
                      <TableCell>
                        {loc.referenceNumber ? (
                          <Badge variant="outline" className="font-mono">
                            {loc.referenceNumber}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right text-green-600 font-medium">
                      {loc.available}
                    </TableCell>
                    <TableCell className="text-right text-yellow-600">
                      {loc.reserved}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {loc.damaged}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Transactions</h2>
            <Link href={`/warehouse/inventory/transactions?itemId=${stockData.item.id}`}>
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Ref #</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No transactions yet
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="text-sm text-gray-600">
                      {formatDateTime(txn.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge className={TRANSACTION_TYPES[txn.type]?.color || 'bg-gray-100'}>
                        {TRANSACTION_TYPES[txn.type]?.label || txn.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {txn.referenceNumber ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {txn.referenceNumber}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${txn.quantity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {txn.quantity >= 0 ? '+' : ''}{txn.quantity}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 max-w-[150px] truncate" title={txn.notes || ''}>
                      {txn.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pending Pick Orders */}
      {stockData.totalReserved > 0 && (
        <div className="bg-white rounded-lg shadow mt-6">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">
              Pending Pick Orders
              <span className="font-normal text-sm text-yellow-600 ml-2">
                {stockData.totalReserved} units reserved across {pendingOrders.length} order{pendingOrders.length !== 1 ? 's' : ''}
              </span>
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pick Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Ref #</TableHead>
                <TableHead className="text-right">Reserved Qty</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No pending pick orders
                  </TableCell>
                </TableRow>
              ) : (
                pendingOrders.map((order) => (
                  <TableRow key={order.pickOrder.id}>
                    <TableCell>
                      <span className="font-mono font-medium text-emerald-600">
                        {order.pickOrder.pickOrderNumber}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          order.pickOrder.status === 'PENDING'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }
                      >
                        {order.pickOrder.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          order.pickOrder.priority === 'urgent' ? 'bg-red-50 text-red-700 border-red-200' :
                          order.pickOrder.priority === 'high' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          'bg-gray-50 text-gray-700 border-gray-200'
                        }
                      >
                        {order.pickOrder.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {order.pickOrder.destination}
                    </TableCell>
                    <TableCell>
                      {order.items.map((item, idx) => (
                        <div key={idx}>
                          {item.referenceNumber ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {item.referenceNumber}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="text-right font-medium text-yellow-600">
                      {order.totalReserved}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatDateTime(order.pickOrder.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/warehouse/pick-orders/${order.pickOrder.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pending Storefront Orders */}
      {pendingStorefrontOrders.length > 0 && (
        <div className="bg-white rounded-lg shadow mt-6">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">
              Pending Storefront Orders
              <span className="font-normal text-sm text-emerald-600 ml-2">
                {pendingStorefrontOrders.reduce((sum, o) => sum + o.totalReserved, 0)} units reserved across {pendingStorefrontOrders.length} order{pendingStorefrontOrders.length !== 1 ? 's' : ''}
              </span>
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Ship To</TableHead>
                <TableHead>Ref #</TableHead>
                <TableHead className="text-right">Reserved Qty</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingStorefrontOrders.map((order) => (
                <TableRow key={order.storefrontOrder.id}>
                  <TableCell>
                    <span className="font-mono font-medium text-emerald-600">
                      {order.storefrontOrder.orderNumber}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{order.storefrontOrder.customer.name}</div>
                      {order.storefrontOrder.customer.company && (
                        <div className="text-xs text-gray-500">{order.storefrontOrder.customer.company}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {order.storefrontOrder.shipToCity && order.storefrontOrder.shipToState
                      ? `${order.storefrontOrder.shipToCity}, ${order.storefrontOrder.shipToState}`
                      : order.storefrontOrder.shipToName || '-'}
                  </TableCell>
                  <TableCell>
                    {order.items.map((item, idx) => (
                      <div key={idx}>
                        {item.referenceNumber ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {item.referenceNumber}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="text-right font-medium text-emerald-600">
                    {order.totalReserved}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDateTime(order.storefrontOrder.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Link href="/warehouse/orders">
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
