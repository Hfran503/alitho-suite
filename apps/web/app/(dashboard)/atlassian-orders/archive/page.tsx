'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { OrderDetailPanel, AtlassianOrder } from '@/components/atlassian-orders';

export default function ArchivePage() {
  const [orders, setOrders] = useState<AtlassianOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AtlassianOrder | null>(null);
  const [restoringOrder, setRestoringOrder] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const offset = (currentPage - 1) * pageSize;
      const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}&searchField=all` : '';
      const response = await fetch(`/api/atlassian/orders?status=archived&limit=${pageSize}&offset=${offset}${searchParam}`);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setOrders(data.data);
        setTotalCount(data.totalCount || 0);
      } else {
        throw new Error('API returned unsuccessful response');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleRestoreOrder = async (orderId: string) => {
    setRestoringOrder(orderId);
    setSuccessMessage(null);

    try {
      // Find the order to check if it was a duplicate
      const order = orders.find(o => o.id === orderId);
      const isDuplicate = order?.duplicateOfOrderId != null;
      const newStatus = isDuplicate ? 'potential_duplicate' : 'completed';

      const response = await fetch(`/api/atlassian/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        const destination = isDuplicate ? 'Duplicates' : 'Ready to Process';
        setSuccessMessage(`Order restored to ${destination}!`);
        setTimeout(() => {
          fetchOrders();
          setSuccessMessage(null);
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to restore order');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setRestoringOrder(null);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Archive</h1>
        <p className="text-sm text-gray-500">Archived orders that won't be processed</p>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-800">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search archived orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pagination - Always show to display total count */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {totalCount === 0
                ? 'No orders found'
                : totalPages > 1
                  ? `Showing ${((currentPage - 1) * pageSize) + 1} - ${Math.min(currentPage * pageSize, totalCount)} of ${totalCount} orders`
                  : `Total: ${totalCount} orders`
              }
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No archived orders found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Archived Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className={`hover:bg-gray-50 ${selectedOrder?.id === order.id ? 'bg-blue-50' : ''}`}
                    >
                      <td
                        className="px-4 py-3 whitespace-nowrap cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <div className="text-sm font-semibold text-blue-600">
                          {order.orderNumber || '-'}
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {order.fullName || `${order.firstName} ${order.lastName}`}
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <div className="text-sm text-gray-500">
                          {order.personalEmail || order.workEmail || '-'}
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <div className="text-sm text-gray-500">{order.country}</div>
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <div className="text-sm text-gray-500">
                          {new Date(order.processedAt || order.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestoreOrder(order.id)}
                          disabled={restoringOrder === order.id}
                        >
                          {restoringOrder === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <RotateCcw className="h-4 w-4 mr-1" />
                          )}
                          Restore
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Panel */}
      {selectedOrder && (
        <OrderDetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOrderUpdated={() => {
            fetchOrders();
            setSelectedOrder(null);
          }}
          showDuplicateActions={false}
        />
      )}
    </div>
  );
}
