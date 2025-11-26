'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, ChevronDown, ChevronRight, ChevronLeft, Download, FileSpreadsheet, FileDown } from 'lucide-react';
import { OrderDetailPanel, AtlassianOrder, OrderCounts, formatDate } from '@/components/atlassian-orders';

interface CategoryCounts {
  philippines: number;
  australia: number;
  india: number;
  usa: number;
  international: number;
}

interface PaceJobGroup {
  paceJobNumber: string;
  orders: AtlassianOrder[];
  totalOrders: number;
  latestDate: string;
  categoryCounts: CategoryCounts;
}

export default function SentToPacePage() {
  const [orders, setOrders] = useState<AtlassianOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AtlassianOrder | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [exportingXlsx, setExportingXlsx] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

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
      const response = await fetch(`/api/atlassian/orders?status=sent_to_pace&limit=${pageSize}&offset=${offset}${searchParam}`);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setOrders(data.data);
        setTotalCount(data.totalCount || 0);
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
  }, [currentPage, pageSize, debouncedSearch]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Group orders by PACE Job Number
  const groupedByJob = useMemo(() => {
    const groups: Record<string, PaceJobGroup> = {};

    orders.forEach((order) => {
      const jobNum = order.paceJobNumber || 'No Job Number';
      if (!groups[jobNum]) {
        groups[jobNum] = {
          paceJobNumber: jobNum,
          orders: [],
          totalOrders: 0,
          latestDate: order.processedAt || order.createdAt,
          categoryCounts: {
            philippines: 0,
            australia: 0,
            india: 0,
            usa: 0,
            international: 0,
          },
        };
      }
      groups[jobNum].orders.push(order);
      groups[jobNum].totalOrders++;

      // Update category counts
      if (order.countryCategory === 'Philippines') groups[jobNum].categoryCounts.philippines++;
      else if (order.countryCategory === 'Australia') groups[jobNum].categoryCounts.australia++;
      else if (order.countryCategory === 'India') groups[jobNum].categoryCounts.india++;
      else if (order.countryCategory === 'United States of America') groups[jobNum].categoryCounts.usa++;
      else if (order.countryCategory === 'International US') groups[jobNum].categoryCounts.international++;

      const orderDate = order.processedAt || order.createdAt;
      if (orderDate > groups[jobNum].latestDate) {
        groups[jobNum].latestDate = orderDate;
      }
    });

    // Sort by latest date descending
    return Object.values(groups).sort(
      (a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
    );
  }, [orders]);

  // Filter by country
  const getOrdersByCountry = (countryCategory: string | null) => {
    if (!countryCategory) return orders;
    return orders.filter((o) => o.countryCategory === countryCategory);
  };

  const getGroupsByCountry = (countryCategory: string | null): PaceJobGroup[] => {
    const filteredOrders = getOrdersByCountry(countryCategory);
    const groups: Record<string, PaceJobGroup> = {};

    filteredOrders.forEach((order) => {
      const jobNum = order.paceJobNumber || 'No Job Number';
      if (!groups[jobNum]) {
        groups[jobNum] = {
          paceJobNumber: jobNum,
          orders: [],
          totalOrders: 0,
          latestDate: order.processedAt || order.createdAt,
          categoryCounts: {
            philippines: 0,
            australia: 0,
            india: 0,
            usa: 0,
            international: 0,
          },
        };
      }
      groups[jobNum].orders.push(order);
      groups[jobNum].totalOrders++;

      // Update category counts
      if (order.countryCategory === 'Philippines') groups[jobNum].categoryCounts.philippines++;
      else if (order.countryCategory === 'Australia') groups[jobNum].categoryCounts.australia++;
      else if (order.countryCategory === 'India') groups[jobNum].categoryCounts.india++;
      else if (order.countryCategory === 'United States of America') groups[jobNum].categoryCounts.usa++;
      else if (order.countryCategory === 'International US') groups[jobNum].categoryCounts.international++;

      const orderDate = order.processedAt || order.createdAt;
      if (orderDate > groups[jobNum].latestDate) {
        groups[jobNum].latestDate = orderDate;
      }
    });

    return Object.values(groups).sort(
      (a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
    );
  };

  const toggleJobExpanded = (jobNumber: string) => {
    setExpandedJobs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(jobNumber)) {
        newSet.delete(jobNumber);
      } else {
        newSet.add(jobNumber);
      }
      return newSet;
    });
  };

  const expandAll = (groups: PaceJobGroup[]) => {
    setExpandedJobs(new Set(groups.map((g) => g.paceJobNumber)));
  };

  const collapseAll = () => {
    setExpandedJobs(new Set());
  };

  const handleDownloadPdf = async (paceJobNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingPdf(paceJobNumber);
    try {
      const response = await fetch(`/api/atlassian/orders/export/pdf?paceJobNumber=${encodeURIComponent(paceJobNumber)}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to download PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PACE_Job_${paceJobNumber}_Orders.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download PDF');
    } finally {
      setDownloadingPdf(null);
    }
  };

  const handleExportXlsx = async (paceJobNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExportingXlsx(paceJobNumber);
    try {
      const response = await fetch(`/api/atlassian/orders/export/xlsx?paceJobNumber=${encodeURIComponent(paceJobNumber)}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to export XLSX');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PACE_Job_${paceJobNumber}_Orders.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export XLSX');
    } finally {
      setExportingXlsx(null);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Helper to format category breakdown
  const formatCategoryBreakdown = (counts: CategoryCounts): string => {
    const parts: string[] = [];
    if (counts.philippines > 0) parts.push(`PH: ${counts.philippines}`);
    if (counts.australia > 0) parts.push(`AU: ${counts.australia}`);
    if (counts.india > 0) parts.push(`IN: ${counts.india}`);
    if (counts.usa > 0) parts.push(`US: ${counts.usa}`);
    if (counts.international > 0) parts.push(`Intl: ${counts.international}`);
    return parts.join(', ');
  };

  const renderJobGroups = (groups: PaceJobGroup[], showCategoryBreakdown = false) => {
    if (groups.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No orders sent to PACE in this category.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex justify-end gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={() => expandAll(groups)}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>

        {groups.map((group) => {
          const isExpanded = expandedJobs.has(group.paceJobNumber);

          return (
            <div key={group.paceJobNumber} className="border rounded-lg overflow-hidden">
              {/* Job Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                <button
                  className="flex items-center gap-3 hover:bg-gray-100 -ml-2 pl-2 pr-4 py-1 rounded transition-colors"
                  onClick={() => toggleJobExpanded(group.paceJobNumber)}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                  <span className="font-semibold text-green-700">
                    PACE Job #{group.paceJobNumber}
                  </span>
                  {showCategoryBreakdown ? (
                    <span className="text-xs text-gray-500">
                      {formatCategoryBreakdown(group.categoryCounts)}
                    </span>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      {group.totalOrders} order{group.totalOrders !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleDownloadPdf(group.paceJobNumber, e)}
                    disabled={downloadingPdf === group.paceJobNumber}
                    title="Download all PDFs as one file"
                  >
                    {downloadingPdf === group.paceJobNumber ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4" />
                    )}
                    <span className="ml-1 hidden sm:inline">PDF</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleExportXlsx(group.paceJobNumber, e)}
                    disabled={exportingXlsx === group.paceJobNumber}
                    title="Export order details to Excel"
                  >
                    {exportingXlsx === group.paceJobNumber ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                    <span className="ml-1 hidden sm:inline">XLSX</span>
                  </Button>
                  <span className="text-sm text-gray-500 ml-2">
                    {formatDate(group.latestDate)}
                  </span>
                </div>
              </div>

              {/* Orders in Group */}
              {isExpanded && (
                <div className="divide-y divide-gray-100">
                  {group.orders.map((order) => (
                    <div
                      key={order.id}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors flex items-center justify-between"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8" /> {/* Spacer for alignment */}
                        <div>
                          <div className="font-medium text-gray-900">
                            {order.fullName || `${order.firstName} ${order.lastName}`}
                          </div>
                          <div className="text-sm text-gray-500">
                            Order #{order.orderNumber} &middot; {order.country}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-gray-500">
                          {order.personalEmail || order.workEmail}
                        </div>
                        {order.pdfPath && (
                          <a
                            href={order.pdfPath}
                            download
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sent to PACE</h1>
        <p className="text-sm text-gray-500">Orders grouped by PACE Job Number</p>
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

      {/* Tabs with Job Groups */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({apiCounts.sentToPace})</TabsTrigger>
              <TabsTrigger value="philippines">Philippines ({apiCounts.sentPhilippines})</TabsTrigger>
              <TabsTrigger value="australia">Australia ({apiCounts.sentAustralia})</TabsTrigger>
              <TabsTrigger value="india">India ({apiCounts.sentIndia})</TabsTrigger>
              <TabsTrigger value="usa">USA ({apiCounts.sentUsa})</TabsTrigger>
              <TabsTrigger value="international">International ({apiCounts.sentInternational})</TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                <TabsContent value="all">
                  {renderJobGroups(groupedByJob, true)}
                </TabsContent>
                <TabsContent value="philippines">
                  {renderJobGroups(getGroupsByCountry('Philippines'))}
                </TabsContent>
                <TabsContent value="australia">
                  {renderJobGroups(getGroupsByCountry('Australia'))}
                </TabsContent>
                <TabsContent value="india">
                  {renderJobGroups(getGroupsByCountry('India'))}
                </TabsContent>
                <TabsContent value="usa">
                  {renderJobGroups(getGroupsByCountry('United States of America'))}
                </TabsContent>
                <TabsContent value="international">
                  {renderJobGroups(getGroupsByCountry('International US'))}
                </TabsContent>
              </>
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
          showDuplicateActions={false}
        />
      )}
    </div>
  );
}
