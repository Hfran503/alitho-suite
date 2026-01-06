'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, Search, Send, ChevronLeft, ChevronRight, FileText, Plus } from 'lucide-react';
import { OrdersTable, OrderDetailPanel, AtlassianOrder, OrderCounts, AddManualOrderDialog } from '@/components/atlassian-orders';

export default function ReadyToProcessPage() {
  const [orders, setOrders] = useState<AtlassianOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AtlassianOrder | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [sendingSelectedToPace, setSendingSelectedToPace] = useState(false);
  const [batchPaceSuccess, setBatchPaceSuccess] = useState<string | null>(null);
  const [batchPaceError, setBatchPaceError] = useState<string | null>(null);
  const [triggeringCheck, setTriggeringCheck] = useState(false);
  const [regeneratingPdfs, setRegeneratingPdfs] = useState(false);
  const [batchPdfSuccess, setBatchPdfSuccess] = useState<string | null>(null);
  const [batchPdfError, setBatchPdfError] = useState<string | null>(null);
  const [showAddOrderDialog, setShowAddOrderDialog] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(500);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchField, setSearchField] = useState('all');

  // Country tab state - used to filter API requests
  const [activeCountryTab, setActiveCountryTab] = useState('all');

  // API counts
  const [apiCounts, setApiCounts] = useState<OrderCounts>({
    all: 0,
    readyToSend: 0,
    sentToPace: 0,
    duplicates: 0,
    archived: 0,
    philippines: 0,
    australia: 0,
    india: 0,
    usa: 0,
    international: 0,
    missing: 0,
    sentPhilippines: 0,
    sentAustralia: 0,
    sentIndia: 0,
    sentUsa: 0,
    sentInternational: 0,
  });

  // Debounce search input
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
      const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}&searchField=${searchField}` : '';

      // Map tab value to countryCategory value
      const countryMap: Record<string, string> = {
        philippines: 'Philippines',
        australia: 'Australia',
        india: 'India',
        usa: 'United States of America',
        international: 'International US',
      };
      const countryParam = activeCountryTab !== 'all' ? `&countryCategory=${encodeURIComponent(countryMap[activeCountryTab] || '')}` : '';

      // Filter for ready-to-process orders (completed or pending, not duplicates)
      const statusParam = '&statusFilter=ready';

      const response = await fetch(`/api/atlassian/orders?limit=${pageSize}&offset=${offset}${searchParam}${countryParam}${statusParam}`);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setOrders(data.data);
        if (data.counts) {
          setApiCounts(data.counts);
        }
      } else {
        throw new Error('API returned unsuccessful response');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch, searchField, activeCountryTab]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleTriggerEmailCheck = async () => {
    setTriggeringCheck(true);
    try {
      const response = await fetch('/api/atlassian/orders', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setTimeout(() => {
          fetchOrders();
        }, 2000);
      }
    } catch (err) {
      console.error('Error triggering email check:', err);
    } finally {
      setTriggeringCheck(false);
    }
  };

  const handleToggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const handleSelectAllOrders = (ordersList: AtlassianOrder[]) => {
    const allSelected = ordersList.every((o) => selectedOrderIds.has(o.id));
    if (allSelected) {
      setSelectedOrderIds((prev) => {
        const newSet = new Set(prev);
        ordersList.forEach((o) => newSet.delete(o.id));
        return newSet;
      });
    } else {
      setSelectedOrderIds((prev) => {
        const newSet = new Set(prev);
        ordersList.forEach((o) => newSet.add(o.id));
        return newSet;
      });
    }
  };

  const handleSendSelectedToPace = async () => {
    if (selectedOrderIds.size === 0) return;

    setSendingSelectedToPace(true);
    setBatchPaceSuccess(null);
    setBatchPaceError(null);

    try {
      // Send all selected order IDs to the batch endpoint
      // The endpoint will group them by country and create one job per country
      const response = await fetch('/api/atlassian/orders/send-selected-to-pace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: Array.from(selectedOrderIds) }),
      });

      const data = await response.json();

      if (data.success) {
        const { totalOrdersProcessed, jobsCreated, ordersByCountry } = data.data;
        const countryBreakdown = Object.entries(ordersByCountry as Record<string, number>)
          .map(([country, count]) => `${country}: ${count}`)
          .join(', ');

        setBatchPaceSuccess(
          `Successfully sent ${totalOrdersProcessed} order(s) to PACE in ${jobsCreated} job(s)! (${countryBreakdown})`
        );
        setTimeout(() => {
          fetchOrders();
          setBatchPaceSuccess(null);
          setSelectedOrderIds(new Set());
          setIsSelectMode(false);
        }, 3000);
      } else {
        setBatchPaceError(data.error || 'Failed to send orders to PACE');
      }
    } catch (err) {
      setBatchPaceError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSendingSelectedToPace(false);
    }
  };

  const handleRegenerateSelectedPdfs = async () => {
    if (selectedOrderIds.size === 0) return;

    setRegeneratingPdfs(true);
    setBatchPdfSuccess(null);
    setBatchPdfError(null);

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      const ordersToRegenerate = orders.filter((o) => selectedOrderIds.has(o.id));

      if (ordersToRegenerate.length === 0) {
        setBatchPdfError('No orders selected for PDF regeneration.');
        return;
      }

      for (const order of ordersToRegenerate) {
        try {
          const response = await fetch(`/api/atlassian/orders/${order.id}/regenerate-pdf`, {
            method: 'POST',
          });
          const data = await response.json();

          if (data.success) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`${order.orderNumber}: ${data.error}`);
          }
        } catch {
          errorCount++;
          errors.push(`${order.orderNumber}: Network error`);
        }
      }

      if (successCount > 0) {
        setBatchPdfSuccess(
          `Successfully regenerated ${successCount} PDF(s)!${errorCount > 0 ? ` (${errorCount} failed)` : ''}`
        );
        setTimeout(() => {
          fetchOrders();
          setBatchPdfSuccess(null);
          setSelectedOrderIds(new Set());
          setIsSelectMode(false);
        }, 3000);
      }

      if (errorCount > 0 && successCount === 0) {
        setBatchPdfError(`Failed to regenerate PDFs: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
      }
    } catch (err) {
      setBatchPdfError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setRegeneratingPdfs(false);
    }
  };

  // Get the count for the current tab for pagination
  const getCountForTab = () => {
    switch (activeCountryTab) {
      case 'philippines': return apiCounts.philippines;
      case 'australia': return apiCounts.australia;
      case 'india': return apiCounts.india;
      case 'usa': return apiCounts.usa;
      case 'international': return apiCounts.international;
      default: return apiCounts.readyToSend;
    }
  };
  const readyTotalCount = getCountForTab();
  const totalPages = Math.ceil(readyTotalCount / pageSize);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ready to Process</h1>
          <p className="text-sm text-gray-500">Orders ready to be sent to PACE</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowAddOrderDialog(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Manual Order
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerEmailCheck}
            disabled={triggeringCheck}
          >
            {triggeringCheck ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Check for New Orders
          </Button>
          <Button
            variant={isSelectMode ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) {
                setSelectedOrderIds(new Set());
              }
            }}
          >
            {isSelectMode ? 'Cancel Selection' : 'Select Orders'}
          </Button>
          {isSelectMode && selectedOrderIds.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerateSelectedPdfs}
                disabled={regeneratingPdfs}
              >
                {regeneratingPdfs ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Regenerate {selectedOrderIds.size} PDF{selectedOrderIds.size > 1 ? 's' : ''}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSendSelectedToPace}
                disabled={sendingSelectedToPace}
              >
                {sendingSelectedToPace ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send {selectedOrderIds.size} to PACE
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      {batchPaceSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-800">
          {batchPaceSuccess}
        </div>
      )}
      {batchPaceError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
          {batchPaceError}
        </div>
      )}
      {batchPdfSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-800">
          {batchPdfSuccess}
        </div>
      )}
      {batchPdfError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
          {batchPdfError}
        </div>
      )}

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={searchField} onValueChange={setSearchField}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Search field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Fields</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="orderNumber">Order Number</SelectItem>
                <SelectItem value="paceJob">PACE Job #</SelectItem>
                <SelectItem value="address">Address</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pagination - Always show to display total count */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {readyTotalCount === 0
                ? 'No orders found'
                : totalPages > 1
                  ? `Showing ${((currentPage - 1) * pageSize) + 1} - ${Math.min(currentPage * pageSize, readyTotalCount)} of ${readyTotalCount} orders`
                  : `Total: ${readyTotalCount} orders`
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

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeCountryTab} onValueChange={(value) => {
            setActiveCountryTab(value);
            setCurrentPage(1); // Reset pagination when changing tabs
          }}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({apiCounts.readyToSend})</TabsTrigger>
              <TabsTrigger value="philippines">Philippines ({apiCounts.philippines})</TabsTrigger>
              <TabsTrigger value="australia">Australia ({apiCounts.australia})</TabsTrigger>
              <TabsTrigger value="india">India ({apiCounts.india})</TabsTrigger>
              <TabsTrigger value="usa">USA ({apiCounts.usa})</TabsTrigger>
              <TabsTrigger value="international">International ({apiCounts.international})</TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="mt-4">
                <OrdersTable
                  orders={orders}
                  selectedOrder={selectedOrder}
                  onSelectOrder={setSelectedOrder}
                  isSelectMode={isSelectMode}
                  selectedOrderIds={selectedOrderIds}
                  onToggleOrderSelection={handleToggleOrderSelection}
                  onSelectAllOrders={handleSelectAllOrders}
                  showPaceJobColumn={false}
                  emptyMessage="No orders found in this category."
                />
              </div>
            )}
          </Tabs>
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
        />
      )}

      {/* Add Manual Order Dialog */}
      <AddManualOrderDialog
        open={showAddOrderDialog}
        onOpenChange={setShowAddOrderDialog}
        onOrderCreated={fetchOrders}
      />
    </div>
  );
}
