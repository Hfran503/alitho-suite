'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { OrdersTable, OrderDetailPanel, AtlassianOrder } from '@/components/atlassian-orders';

export default function MissingAddressPage() {
  const [orders, setOrders] = useState<AtlassianOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AtlassianOrder | null>(null);

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
      const response = await fetch(`/api/atlassian/orders?status=missing_address&limit=${pageSize}&offset=${offset}${searchParam}`);

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

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold text-gray-900">Missing Address</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Orders with incomplete or placeholder addresses that need to be updated before processing
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-orange-800">
              These orders cannot be sent to PACE until the address is updated.
            </p>
            <p className="text-sm text-orange-700 mt-1">
              Click on an order to view details and edit the address. Once the address is complete,
              change the status to "Ready" to move it to the Ready to Process queue.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search orders..."
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

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Orders Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <OrdersTable
              orders={orders}
              selectedOrder={selectedOrder}
              onSelectOrder={setSelectedOrder}
              showPaceJobColumn={false}
              emptyMessage="No orders with missing addresses."
            />
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
