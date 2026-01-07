'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Check, Archive, ExternalLink, ArrowRightLeft } from 'lucide-react';
import { AtlassianOrder, AtlassianOrderFull, formatDate, getStatusBadgeColor, getStatusDisplayText } from '@/components/atlassian-orders';

export default function DuplicatesPage() {
  const [orders, setOrders] = useState<AtlassianOrderFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDuplicate, setSelectedDuplicate] = useState<AtlassianOrderFull | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchDuplicates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch potential_duplicate status orders with a high limit
      const response = await fetch('/api/atlassian/orders?status=potential_duplicate&limit=1000');

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setOrders(data.data);
      } else {
        throw new Error('API returned unsuccessful response');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDuplicates();
  }, [fetchDuplicates]);

  const handleMarkAsReady = async (orderId: string) => {
    setActionLoading(true);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/atlassian/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          duplicateOfOrderId: null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage('Order marked as Ready to Process!');
        setTimeout(() => {
          fetchDuplicates();
          setSelectedDuplicate(null);
          setSuccessMessage(null);
        }, 1500);
      } else {
        throw new Error(data.error || 'Failed to update order');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async (orderId: string) => {
    setActionLoading(true);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/atlassian/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage('Order archived!');
        setTimeout(() => {
          fetchDuplicates();
          setSelectedDuplicate(null);
          setSuccessMessage(null);
        }, 1500);
      } else {
        throw new Error(data.error || 'Failed to archive order');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUseNewOrder = async (duplicateId: string, originalId: string) => {
    setActionLoading(true);
    setSuccessMessage(null);

    try {
      // Archive the original order
      const archiveResponse = await fetch(`/api/atlassian/orders/${originalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });

      if (!archiveResponse.ok) {
        throw new Error('Failed to archive original order');
      }

      // Mark the duplicate as ready to process
      const readyResponse = await fetch(`/api/atlassian/orders/${duplicateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          duplicateOfOrderId: null,
        }),
      });

      const data = await readyResponse.json();

      if (data.success) {
        setSuccessMessage('Original archived, new order moved to Ready to Process!');
        setTimeout(() => {
          fetchDuplicates();
          setSelectedDuplicate(null);
          setSuccessMessage(null);
        }, 1500);
      } else {
        throw new Error(data.error || 'Failed to update new order');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const renderComparisonField = (label: string, duplicateValue: string | null | undefined, originalValue: string | null | undefined) => {
    const isDifferent = duplicateValue !== originalValue;

    return (
      <div className="grid grid-cols-3 gap-4 py-2 border-b border-gray-100">
        <div className="text-sm font-medium text-gray-500">{label}</div>
        <div className={`text-sm ${isDifferent ? 'text-orange-600 font-medium' : 'text-gray-900'}`}>
          {duplicateValue || '-'}
        </div>
        <div className="text-sm text-gray-900">
          {originalValue || '-'}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Duplicates</h1>
        <p className="text-sm text-gray-500">Review potential duplicate orders side by side</p>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-800 mb-4">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-gray-500">
              <Check className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">No duplicate orders</p>
              <p className="text-sm">All orders have been reviewed.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-6 flex-1 min-h-0">
          {/* Left Panel - Duplicates List */}
          <div className="w-80 flex-shrink-0 overflow-auto">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-500 uppercase">
                  Duplicates ({orders.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {orders.map((order) => (
                    <button
                      key={order.id}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                        selectedDuplicate?.id === order.id ? 'bg-purple-50 border-l-4 border-purple-600' : ''
                      }`}
                      onClick={() => setSelectedDuplicate(order)}
                    >
                      <div className="font-medium text-gray-900">
                        {order.fullName || `${order.firstName} ${order.lastName}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        Order #{order.orderNumber}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {formatDate(order.createdAt)}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Comparison View */}
          <div className="flex-1 flex flex-col min-h-0">
            {selectedDuplicate ? (
              <Card className="h-full flex flex-col">
                <CardHeader className="border-b flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Order Comparison</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleMarkAsReady(selectedDuplicate.id)}
                        disabled={actionLoading}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {actionLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        Mark as Ready to Process
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleArchive(selectedDuplicate.id)}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Archive className="h-4 w-4 mr-2" />
                        )}
                        Archive
                      </Button>
                      {/* Show "Use New Order" only when original is missing address */}
                      {selectedDuplicate.duplicateOfOrder &&
                       (selectedDuplicate.duplicateOfOrder as AtlassianOrder).status === 'missing_address' && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleUseNewOrder(
                            selectedDuplicate.id,
                            (selectedDuplicate.duplicateOfOrder as AtlassianOrder).id
                          )}
                          disabled={actionLoading}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {actionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                          )}
                          Use New Order
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 flex-1 overflow-auto">
                  {/* Column Headers */}
                  <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-gray-200 mb-2">
                    <div className="text-sm font-semibold text-gray-700">Field</div>
                    <div className="text-sm font-semibold text-purple-700">
                      Duplicate
                      <Badge className="ml-2 bg-purple-100 text-purple-800 text-xs">New</Badge>
                    </div>
                    <div className="text-sm font-semibold text-blue-700">
                      Original
                      {selectedDuplicate.duplicateOfOrder && (
                        <>
                          <span className="ml-2 text-xs font-normal text-gray-500">
                            #{selectedDuplicate.duplicateOfOrder.orderNumber}
                          </span>
                          <Badge className={`ml-2 text-xs ${getStatusBadgeColor((selectedDuplicate.duplicateOfOrder as AtlassianOrder).status)}`}>
                            {getStatusDisplayText((selectedDuplicate.duplicateOfOrder as AtlassianOrder).status)}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Comparison Fields */}
                  <div className="space-y-0">
                    {renderComparisonField(
                      'Order #',
                      selectedDuplicate.orderNumber,
                      (selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.orderNumber
                    )}
                    {renderComparisonField(
                      'Full Name',
                      selectedDuplicate.fullName,
                      (selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.fullName
                    )}
                    {renderComparisonField(
                      'First Name',
                      selectedDuplicate.firstName,
                      (selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.firstName
                    )}
                    {renderComparisonField(
                      'Last Name',
                      selectedDuplicate.lastName,
                      (selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.lastName
                    )}
                    {renderComparisonField(
                      'Personal Email',
                      selectedDuplicate.personalEmail,
                      (selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.personalEmail
                    )}
                    {renderComparisonField(
                      'Work Email',
                      selectedDuplicate.workEmail,
                      (selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.workEmail
                    )}
                    {renderComparisonField(
                      'Phone',
                      selectedDuplicate.phoneNumber,
                      (selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.phoneNumber
                    )}
                    {renderComparisonField(
                      'Address 1',
                      selectedDuplicate.address1,
                      (selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.address1
                    )}
                    {renderComparisonField(
                      'City',
                      selectedDuplicate.city,
                      (selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.city
                    )}
                    {renderComparisonField(
                      'State',
                      selectedDuplicate.state,
                      (selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.state
                    )}
                    {renderComparisonField(
                      'Zip Code',
                      selectedDuplicate.zipCode,
                      (selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.zipCode
                    )}
                    {renderComparisonField(
                      'Country',
                      selectedDuplicate.country,
                      (selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.country
                    )}
                    {renderComparisonField(
                      'Start Date',
                      selectedDuplicate.startDate,
                      (selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.startDate
                    )}
                    {renderComparisonField(
                      'Manager',
                      selectedDuplicate.manager,
                      (selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.manager
                    )}
                    {renderComparisonField(
                      'Department',
                      selectedDuplicate.department,
                      (selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.department
                    )}
                    {renderComparisonField(
                      'Created',
                      formatDate(selectedDuplicate.createdAt),
                      formatDate((selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.createdAt)
                    )}
                  </div>

                  {/* PDF Downloads */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Duplicate PDF</p>
                        {selectedDuplicate.pdfPath ? (
                          <a
                            href={selectedDuplicate.pdfPath}
                            download
                            className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded transition-colors"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">No PDF</span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Original PDF</p>
                        {(selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.pdfPath ? (
                          <a
                            href={(selectedDuplicate.duplicateOfOrder as AtlassianOrder).pdfPath}
                            download
                            className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">No PDF</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Info */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Duplicate Status</p>
                        <Badge className={getStatusBadgeColor(selectedDuplicate.status)}>
                          {getStatusDisplayText(selectedDuplicate.status)}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Original Status</p>
                        {(selectedDuplicate.duplicateOfOrder as AtlassianOrder)?.status ? (
                          <Badge className={getStatusBadgeColor((selectedDuplicate.duplicateOfOrder as AtlassianOrder).status)}>
                            {getStatusDisplayText((selectedDuplicate.duplicateOfOrder as AtlassianOrder).status)}
                          </Badge>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center py-12">
                  <div className="text-gray-400">
                    <ExternalLink className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-lg font-medium">Select a duplicate order</p>
                    <p className="text-sm">Click on an order from the list to compare</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
