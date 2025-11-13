'use client'

import { useEffect, useState } from 'react'

interface Order {
  id: string
  orderNumber: string
  orderId: string
  quantity: number
  position: string
  address: string
  notes: string | null
  printPdfUrl: string | null
  proofPdfUrl: string | null
  status: string
  createdByEmail: string
  createdAt: string
  submittedAt: string | null
  tenant: {
    name: string
    slug: string
  }
}

export default function AdminGcuEnvelopeOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenerateMessage, setRegenerateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/gcu-envelope-orders')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch orders')
      }

      setOrders(data.orders)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders')
      console.error('Error fetching orders:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ordered':
        return 'bg-blue-100 text-blue-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'processing':
        return 'bg-purple-100 text-purple-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  const formatPosition = (position: string) => {
    const normalized = position.toLowerCase().replace(/_/g, ' ').trim()
    if (normalized === 'center back flap') {
      return 'Center Back Flap'
    } else if (normalized === 'front') {
      return 'Front'
    }
    return position // Fallback to original if unknown
  }

  const handleRegeneratePdfs = async (orderId: string) => {
    if (!confirm('Are you sure you want to regenerate the PDFs for this order? This will overwrite the existing files.')) {
      return
    }

    setIsRegenerating(true)
    setRegenerateMessage(null)

    try {
      const response = await fetch(`/api/admin/gcu-envelope-orders/${orderId}/regenerate-pdfs`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate PDFs')
      }

      setRegenerateMessage({ type: 'success', text: 'PDFs regenerated successfully!' })

      // Refresh the orders list
      await fetchOrders()

      // Update selected order if it's the one we regenerated
      if (selectedOrder?.id === orderId) {
        const updatedOrder = orders.find(o => o.id === orderId)
        if (updatedOrder) {
          setSelectedOrder(updatedOrder)
        }
      }
    } catch (err) {
      setRegenerateMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to regenerate PDFs'
      })
      console.error('Error regenerating PDFs:', err)
    } finally {
      setIsRegenerating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">GCU Envelope Orders (Admin)</h1>
          <p className="text-gray-600 mt-2">View all custom envelope orders across all tenants</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading orders...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">GCU Envelope Orders (Admin)</h1>
          <p className="text-gray-600 mt-2">View all custom envelope orders across all tenants</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">GCU Envelope Orders (Admin)</h1>
        <p className="text-gray-600 mt-2">View all custom envelope orders across all tenants</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <div className="text-gray-400 text-6xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No orders yet</h3>
          <p className="text-gray-600">No custom envelope orders have been placed.</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tenant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{order.orderNumber}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{order.tenant.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-900">{order.orderId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-900">{order.quantity.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatPosition(order.position)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                            order.status
                          )}`}
                        >
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.createdByEmail}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(order.submittedAt || order.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 text-sm text-gray-500">
            Total orders: {orders.length}
          </div>
        </>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold">Order Details</h2>
                  <p className="text-gray-600 mt-1">{selectedOrder.orderNumber}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedOrder(null)
                    setRegenerateMessage(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="border-b pb-4">
                  <h3 className="font-semibold text-gray-700 mb-2">General Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Tenant:</span>
                      <p className="font-medium">{selectedOrder.tenant.name}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Reference ID:</span>
                      <p className="font-medium">{selectedOrder.orderId}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Quantity:</span>
                      <p className="font-medium">{selectedOrder.quantity.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Position:</span>
                      <p className="font-medium">
                        {formatPosition(selectedOrder.position)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <p>
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                            selectedOrder.status
                          )}`}
                        >
                          {selectedOrder.status.charAt(0).toUpperCase() +
                            selectedOrder.status.slice(1)}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Submitted By:</span>
                      <p className="font-medium">{selectedOrder.createdByEmail}</p>
                    </div>
                  </div>
                </div>

                <div className="border-b pb-4">
                  <h3 className="font-semibold text-gray-700 mb-2">Address</h3>
                  <p className="text-sm whitespace-pre-wrap">{selectedOrder.address}</p>
                </div>

                {selectedOrder.notes && (
                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-gray-700 mb-2">Notes</h3>
                    <p className="text-sm whitespace-pre-wrap">{selectedOrder.notes}</p>
                  </div>
                )}

                <div className="border-b pb-4">
                  <h3 className="font-semibold text-gray-700 mb-2">Files</h3>

                  {regenerateMessage && (
                    <div className={`mb-3 p-3 rounded-lg text-sm ${
                      regenerateMessage.type === 'success'
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      {regenerateMessage.text}
                    </div>
                  )}

                  <div className="flex gap-3 flex-wrap">
                    {selectedOrder.printPdfUrl && (
                      <a
                        href={selectedOrder.printPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Download Print PDF
                      </a>
                    )}
                    {selectedOrder.proofPdfUrl && (
                      <a
                        href={selectedOrder.proofPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Download Proof PDF
                      </a>
                    )}
                    <button
                      onClick={() => handleRegeneratePdfs(selectedOrder.id)}
                      disabled={isRegenerating}
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isRegenerating ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Regenerate PDFs
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Timestamps</h3>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-gray-600">Created:</span>{' '}
                      {formatDate(selectedOrder.createdAt)}
                    </p>
                    {selectedOrder.submittedAt && (
                      <p>
                        <span className="text-gray-600">Submitted:</span>{' '}
                        {formatDate(selectedOrder.submittedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedOrder(null)
                    setRegenerateMessage(null)
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
