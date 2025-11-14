'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, RefreshCw, Download, Plus, Upload, User, Mail, MapPin, FileText, X } from 'lucide-react';

interface AtlassianOrder {
  id: string;
  orderNumber: string;
  emailSubject: string;
  emailFrom: string;
  emailDate: string;
  status: string;
  duplicateOfOrderId?: string;
  duplicateOfOrder?: {
    id: string;
    orderNumber: string;
    fullName: string;
    createdAt: string;
  };
  firstName: string;
  lastName: string;
  printName: string;
  pdfPath: string;
  sftpUrl?: string;
  fullName: string;
  personalEmail: string;
  workEmail: string;
  phoneNumber: string;
  address1: string;
  address2: string;
  address3: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  countryCategory: string;
  startDate: string;
  manager: string;
  department: string;
  location: string;
  paceJobNumber: string;
  createdAt: string;
  processedAt: string;
}

export default function AtlassianOrdersPage() {
  const [orders, setOrders] = useState<AtlassianOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggeringCheck, setTriggeringCheck] = useState(false);
  const [checkSuccess, setCheckSuccess] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AtlassianOrder | null>(null);
  const [sendingToPace, setSendingToPace] = useState(false);
  const [paceSuccess, setPaceSuccess] = useState<string | null>(null);
  const [paceError, setPaceError] = useState<string | null>(null);
  const [sendingAllToPace, setSendingAllToPace] = useState(false);
  const [batchPaceSuccess, setBatchPaceSuccess] = useState<string | null>(null);
  const [batchPaceError, setBatchPaceError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedOrder, setEditedOrder] = useState<AtlassianOrder | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [regeneratingPdf, setRegeneratingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [batchRegeneratingPdfs, setBatchRegeneratingPdfs] = useState(false);
  const [batchPdfSuccess, setBatchPdfSuccess] = useState<string | null>(null);
  const [batchPdfError, setBatchPdfError] = useState<string | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [downloadingBulk, setDownloadingBulk] = useState(false);
  const [bulkDownloadError, setBulkDownloadError] = useState<string | null>(null);

  // Manual add order state
  const [showManualAddDialog, setShowManualAddDialog] = useState(false);
  const [manualOrderData, setManualOrderData] = useState<any>({});
  const [addingManualOrder, setAddingManualOrder] = useState(false);
  const [manualAddSuccess, setManualAddSuccess] = useState<string | null>(null);
  const [manualAddError, setManualAddError] = useState<string | null>(null);

  // File upload state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/atlassian/orders');

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
      console.error('Fetch orders error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleTriggerCheck = async () => {
    setTriggeringCheck(true);
    setCheckSuccess(null);
    setError(null);

    try {
      const response = await fetch('/api/atlassian/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folderPath: 'AtlassianOrders',
          deleteAfterProcessing: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCheckSuccess('Email check queued successfully! Refreshing in 5 seconds...');
        setTimeout(() => {
          fetchOrders();
          setCheckSuccess(null);
        }, 5000);
      } else {
        throw new Error(data.error || 'Failed to queue check');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setTriggeringCheck(false);
    }
  };

  const handleManualAddOrder = async () => {
    setAddingManualOrder(true);
    setManualAddSuccess(null);
    setManualAddError(null);

    try {
      const response = await fetch('/api/atlassian/orders/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...manualOrderData,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setManualAddSuccess(`Order created successfully! Order number: ${data.order.orderNumber}`);
        setManualOrderData({});
        setTimeout(() => {
          fetchOrders();
          setShowManualAddDialog(false);
          setManualAddSuccess(null);
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to create order');
      }
    } catch (err) {
      setManualAddError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setAddingManualOrder(false);
    }
  };

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) {
      setUploadError('Please select at least one file');
      return;
    }

    setUploadingFiles(true);
    setUploadSuccess(null);
    setUploadError(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file, index) => {
        formData.append(`file${index}`, file);
      });

      const response = await fetch('/api/atlassian/orders/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        const summary = data.summary;
        setUploadSuccess(
          `Successfully processed ${summary.successful}/${summary.total} files. ${summary.duplicates > 0 ? `${summary.duplicates} duplicates detected.` : ''}`
        );
        setSelectedFiles([]);
        setTimeout(() => {
          fetchOrders();
          setShowUploadDialog(false);
          setUploadSuccess(null);
        }, 3000);
      } else {
        throw new Error(data.error || 'Failed to upload files');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (file) => file.name.endsWith('.html') || file.name.endsWith('.htm')
    );
    if (files.length > 0) {
      setSelectedFiles(files);
      setUploadError(null);
    } else {
      setUploadError('Please drop only HTML files');
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'sent_to_pace':
        return 'bg-blue-100 text-blue-800';
      case 'missing_address':
        return 'bg-orange-100 text-orange-800';
      case 'potential_duplicate':
        return 'bg-purple-100 text-purple-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Group orders by country category
  const groupedOrders = {
    all: orders,
    readyToSend: orders.filter((o) =>
      o.status === 'completed' || o.status === 'pending'
    ),
    sentToPace: orders.filter((o) => o.status === 'sent_to_pace'),
    philippines: orders.filter((o) => o.countryCategory === 'Philippines'),
    australia: orders.filter((o) => o.countryCategory === 'Australia'),
    india: orders.filter((o) => o.countryCategory === 'India'),
    usa: orders.filter((o) => o.countryCategory === 'United States of America'),
    international: orders.filter((o) => o.countryCategory === 'International US'),
    missing: orders.filter((o) => o.status === 'missing_address'),
  };

  // Get count for each tab
  const getCounts = () => {
    return {
      all: orders.length,
      readyToSend: groupedOrders.readyToSend.length,
      sentToPace: groupedOrders.sentToPace.length,
      philippines: groupedOrders.philippines.length,
      australia: groupedOrders.australia.length,
      india: groupedOrders.india.length,
      usa: groupedOrders.usa.length,
      international: groupedOrders.international.length,
      missing: groupedOrders.missing.length,
    };
  };

  const counts = getCounts();

  const renderOrdersTable = (ordersList: AtlassianOrder[]) => {
    if (ordersList.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No orders found in this category.
        </div>
      );
    }

    const allSelected = ordersList.length > 0 && ordersList.every(o => selectedOrderIds.has(o.id));

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {isSelectMode && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => handleSelectAllOrders(ordersList)}
                    className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                PACE Job #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Address
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Country
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Start Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                PDF
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Processed
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {ordersList.map((order) => (
              <tr
                key={order.id}
                className={`hover:bg-gray-50 transition-colors ${
                  selectedOrder?.id === order.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                } ${isSelectMode && selectedOrderIds.has(order.id) ? 'bg-purple-50' : ''}`}
              >
                {isSelectMode && (
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.has(order.id)}
                      onChange={() => handleToggleOrderSelection(order.id)}
                      className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                    />
                  </td>
                )}
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
                  {order.paceJobNumber ? (
                    <div className="text-sm font-semibold text-green-600">
                      {order.paceJobNumber}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
                <td
                  className="px-4 py-3 whitespace-nowrap cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {order.fullName || `${order.firstName} ${order.lastName}`}
                      </div>
                      {order.printName && (
                        <div className="text-xs text-gray-500">Print: {order.printName}</div>
                      )}
                    </div>
                    {order.status === 'potential_duplicate' && order.duplicateOfOrder && (
                      <div className="flex-shrink-0">
                        <Badge className="bg-purple-100 text-purple-800 text-xs">
                          ⚠️ Duplicate
                        </Badge>
                      </div>
                    )}
                  </div>
                </td>
                <td
                  className="px-4 py-3 whitespace-nowrap cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="text-sm text-gray-900">{order.personalEmail || order.workEmail}</div>
                  {order.phoneNumber && (
                    <div className="text-xs text-gray-500">{order.phoneNumber}</div>
                  )}
                </td>
                <td
                  className="px-4 py-3 cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="text-sm text-gray-900">
                    {order.address1 || <span className="text-red-500 font-semibold">Missing</span>}
                  </div>
                  {order.address2 && <div className="text-xs text-gray-500">{order.address2}</div>}
                  {order.city && order.state && (
                    <div className="text-xs text-gray-500">
                      {order.city}, {order.state} {order.zipCode}
                    </div>
                  )}
                </td>
                <td
                  className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  {order.country}
                </td>
                <td
                  className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  {order.startDate || '-'}
                </td>
                <td
                  className="px-4 py-3 whitespace-nowrap cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <Badge className={getStatusBadgeColor(order.status)}>
                    {order.status.replace('_', ' ')}
                  </Badge>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {order.pdfPath ? (
                    <a
                      href={order.pdfPath}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
                <td
                  className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  {formatDate(order.processedAt || order.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(groupedOrders, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `atlassian-orders-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSendToPace = async (orderId: string) => {
    setSendingToPace(true);
    setPaceSuccess(null);
    setPaceError(null);

    try {
      const response = await fetch(`/api/atlassian/orders/${orderId}/send-to-pace`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setPaceSuccess(`Order sent to PACE successfully! PACE Job #${data.data.paceJobNumber}`);
        // Refresh orders to update status
        setTimeout(() => {
          fetchOrders();
          setPaceSuccess(null);
        }, 3000);
      } else {
        throw new Error(data.error || 'Failed to send order to PACE');
      }
    } catch (err) {
      setPaceError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSendingToPace(false);
    }
  };

  const handleSendAllToPace = async () => {
    setSendingAllToPace(true);
    setBatchPaceSuccess(null);
    setBatchPaceError(null);

    try {
      const response = await fetch('/api/atlassian/orders/send-all-to-pace', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        const { totalOrdersProcessed, jobsCreated } = data.data;
        setBatchPaceSuccess(
          `Successfully sent ${totalOrdersProcessed} orders to PACE in ${jobsCreated} job(s)!`
        );
        // Refresh orders to update status
        setTimeout(() => {
          fetchOrders();
          setBatchPaceSuccess(null);
        }, 5000);
      } else {
        throw new Error(data.error || 'Failed to send orders to PACE');
      }
    } catch (err) {
      setBatchPaceError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSendingAllToPace(false);
    }
  };

  const handleDownloadXML = (order: AtlassianOrder) => {
    const fullName = order.fullName || `${order.firstName} ${order.lastName}`;
    // Use SFTP URL if available, otherwise fallback to local API URL
    const pdfUrl = order.sftpUrl || (order.pdfPath ? `${window.location.origin}${order.pdfPath}` : '');

    // Create XML content
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<order>
  <orderNumber>${order.orderNumber || 'N/A'}</orderNumber>
  <name>${fullName}</name>
  <printName>${order.printName || order.firstName || 'N/A'}</printName>
  <pdfUrl>${pdfUrl}</pdfUrl>
  <personalEmail>${order.personalEmail || 'N/A'}</personalEmail>
  <workEmail>${order.workEmail || 'N/A'}</workEmail>
  <phoneNumber>${order.phoneNumber || 'N/A'}</phoneNumber>
  <address>
    <address1>${order.address1 || 'N/A'}</address1>
    <address2>${order.address2 || ''}</address2>
    <address3>${order.address3 || ''}</address3>
    <city>${order.city || 'N/A'}</city>
    <state>${order.state || 'N/A'}</state>
    <zipCode>${order.zipCode || 'N/A'}</zipCode>
    <country>${order.country || 'N/A'}</country>
  </address>
  <startDate>${order.startDate || 'N/A'}</startDate>
  <manager>${order.manager || 'N/A'}</manager>
  <department>${order.department || 'N/A'}</department>
  <location>${order.location || 'N/A'}</location>
  <paceJobNumber>${order.paceJobNumber || 'N/A'}</paceJobNumber>
  <status>${order.status}</status>
</order>`;

    // Create blob and download
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `order-${order.orderNumber || order.id}.xml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleEditOrder = () => {
    if (selectedOrder) {
      setEditedOrder({ ...selectedOrder });
      setIsEditing(true);
      setUpdateSuccess(null);
      setUpdateError(null);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedOrder(null);
    setUpdateSuccess(null);
    setUpdateError(null);
  };

  const handleSaveOrder = async () => {
    if (!editedOrder) return;

    try {
      const response = await fetch(`/api/atlassian/orders/${editedOrder.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: editedOrder.firstName,
          lastName: editedOrder.lastName,
          fullName: editedOrder.fullName,
          printName: editedOrder.printName,
          personalEmail: editedOrder.personalEmail,
          workEmail: editedOrder.workEmail,
          phoneNumber: editedOrder.phoneNumber,
          address1: editedOrder.address1,
          address2: editedOrder.address2,
          address3: editedOrder.address3,
          city: editedOrder.city,
          state: editedOrder.state,
          zipCode: editedOrder.zipCode,
          country: editedOrder.country,
          countryCategory: editedOrder.countryCategory,
          startDate: editedOrder.startDate,
          manager: editedOrder.manager,
          department: editedOrder.department,
          location: editedOrder.location,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setUpdateSuccess('Order updated successfully!');
        setIsEditing(false);
        // Update the selected order with new data
        setSelectedOrder(data.data);
        // Refresh the orders list
        setTimeout(() => {
          fetchOrders();
          setUpdateSuccess(null);
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to update order');
      }
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleFieldChange = (field: keyof AtlassianOrder, value: string) => {
    if (editedOrder) {
      setEditedOrder({
        ...editedOrder,
        [field]: value,
      });
    }
  };

  const handleRegeneratePdf = async (orderId: string) => {
    setRegeneratingPdf(true);
    setPdfSuccess(null);
    setPdfError(null);

    try {
      const response = await fetch(`/api/atlassian/orders/${orderId}/regenerate-pdf`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setPdfSuccess('PDF regenerated successfully!');
        // Update the selected order with new PDF path
        if (selectedOrder) {
          setSelectedOrder({
            ...selectedOrder,
            pdfPath: data.data.pdfPath,
            sftpUrl: undefined,
          });
        }
        // Refresh orders to update the list
        setTimeout(() => {
          fetchOrders();
          setPdfSuccess(null);
        }, 3000);
      } else {
        throw new Error(data.error || 'Failed to regenerate PDF');
      }
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setRegeneratingPdf(false);
    }
  };

  const handleBatchRegeneratePdfs = async () => {
    if (selectedOrderIds.size === 0) return;

    setBatchRegeneratingPdfs(true);
    setBatchPdfSuccess(null);
    setBatchPdfError(null);

    try {
      const orderIds = Array.from(selectedOrderIds);
      let successCount = 0;
      let failCount = 0;

      for (const orderId of orderIds) {
        try {
          const response = await fetch(`/api/atlassian/orders/${orderId}/regenerate-pdf`, {
            method: 'POST',
          });

          const data = await response.json();

          if (data.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
          console.error(`Failed to regenerate PDF for order ${orderId}:`, err);
        }
      }

      if (failCount === 0) {
        setBatchPdfSuccess(`Successfully regenerated ${successCount} PDF(s)!`);
      } else if (successCount > 0) {
        setBatchPdfSuccess(`Regenerated ${successCount} PDF(s). ${failCount} failed.`);
      } else {
        throw new Error(`Failed to regenerate all ${failCount} PDF(s)`);
      }

      // Clear selection, exit select mode, and refresh
      setSelectedOrderIds(new Set());
      setIsSelectMode(false);
      setTimeout(() => {
        fetchOrders();
        setBatchPdfSuccess(null);
      }, 3000);
    } catch (err) {
      setBatchPdfError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setBatchRegeneratingPdfs(false);
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
    if (selectedOrderIds.size === ordersList.length) {
      // Deselect all
      setSelectedOrderIds(new Set());
    } else {
      // Select all
      setSelectedOrderIds(new Set(ordersList.map(o => o.id)));
    }
  };

  const handleToggleSelectMode = () => {
    if (!isSelectMode) {
      // Enter select mode
      setIsSelectMode(true);
    }
  };

  const handleCancelSelection = () => {
    // Exit select mode and clear selections
    setSelectedOrderIds(new Set());
    setIsSelectMode(false);
  };

  const handleBulkDownload = async () => {
    if (selectedOrderIds.size === 0) return;

    setDownloadingBulk(true);
    setBulkDownloadError(null);

    try {
      const orderIds = Array.from(selectedOrderIds);

      const response = await fetch('/api/atlassian/orders/bulk-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderIds }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download orders');
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `atlassian_orders_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Clear selection and exit select mode
      setSelectedOrderIds(new Set());
      setIsSelectMode(false);
    } catch (err) {
      setBulkDownloadError(err instanceof Error ? err.message : 'An error occurred');
      // Clear error after 5 seconds
      setTimeout(() => setBulkDownloadError(null), 5000);
    } finally {
      setDownloadingBulk(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Atlassian Orders</h1>
          <p className="text-gray-600 mt-1">
            Manage and view Atlassian welcome packet orders from email
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowManualAddDialog(true)} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Add Order
          </Button>
          <Button onClick={() => setShowUploadDialog(true)} variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Upload HTML
          </Button>
          <Button onClick={handleExportJSON} variant="outline" disabled={orders.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
          {!isSelectMode ? (
            <Button onClick={handleToggleSelectMode} variant="secondary" disabled={orders.length === 0}>
              Select Orders
            </Button>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-md">
                <span className="text-sm font-medium text-purple-900">
                  {selectedOrderIds.size} order{selectedOrderIds.size !== 1 ? 's' : ''} selected
                </span>
              </div>
              <Button
                onClick={handleBulkRegeneratePdfs}
                disabled={batchRegeneratingPdfs || selectedOrderIds.size === 0}
                variant="outline"
              >
                {batchRegeneratingPdfs ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate PDFs'
                )}
              </Button>
              <Button
                onClick={handleBulkDownload}
                disabled={downloadingBulk || selectedOrderIds.size === 0}
                variant="default"
              >
                {downloadingBulk ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download ZIP
                  </>
                )}
              </Button>
              <Button onClick={handleCancelSelection} variant="outline">
                Cancel
              </Button>
            </>
          )}
          <Button
            onClick={handleSendAllToPace}
            disabled={sendingAllToPace || counts.readyToSend === 0}
            variant="default"
          >
            {sendingAllToPace ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending to PACE...
              </>
            ) : (
              `Send All to PACE (${counts.readyToSend})`
            )}
          </Button>
          <Button onClick={handleTriggerCheck} disabled={triggeringCheck}>
            {triggeringCheck ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Check Emails
              </>
            )}
          </Button>
        </div>
      </div>

      {checkSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-800">
          {checkSuccess}
        </div>
      )}

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

      {bulkDownloadError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
          {bulkDownloadError}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">{error}</div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.all}</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Ready to Send</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{counts.readyToSend}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Sent to PACE</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{counts.sentToPace}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Philippines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.philippines}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Missing Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{counts.missing}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
              <TabsTrigger value="readyToSend" className="text-blue-600">Ready to Send ({counts.readyToSend})</TabsTrigger>
              <TabsTrigger value="sentToPace" className="text-green-600">Sent to PACE ({counts.sentToPace})</TabsTrigger>
              <TabsTrigger value="philippines">Philippines ({counts.philippines})</TabsTrigger>
              <TabsTrigger value="australia">Australia ({counts.australia})</TabsTrigger>
              <TabsTrigger value="india">India ({counts.india})</TabsTrigger>
              <TabsTrigger value="usa">USA ({counts.usa})</TabsTrigger>
              <TabsTrigger value="international">International ({counts.international})</TabsTrigger>
              <TabsTrigger value="missing">Missing Address ({counts.missing})</TabsTrigger>
            </TabsList>

            <TabsContent value="all">{loading ? <Loader2 className="animate-spin" /> : renderOrdersTable(groupedOrders.all)}</TabsContent>
            <TabsContent value="readyToSend">{renderOrdersTable(groupedOrders.readyToSend)}</TabsContent>
            <TabsContent value="sentToPace">{renderOrdersTable(groupedOrders.sentToPace)}</TabsContent>
            <TabsContent value="philippines">{renderOrdersTable(groupedOrders.philippines)}</TabsContent>
            <TabsContent value="australia">{renderOrdersTable(groupedOrders.australia)}</TabsContent>
            <TabsContent value="india">{renderOrdersTable(groupedOrders.india)}</TabsContent>
            <TabsContent value="usa">{renderOrdersTable(groupedOrders.usa)}</TabsContent>
            <TabsContent value="international">{renderOrdersTable(groupedOrders.international)}</TabsContent>
            <TabsContent value="missing">{renderOrdersTable(groupedOrders.missing)}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Order Details Modal */}
      {selectedOrder && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => {
              setSelectedOrder(null);
              setIsEditing(false);
              setEditedOrder(null);
              setUpdateSuccess(null);
              setUpdateError(null);
              setPdfSuccess(null);
              setPdfError(null);
            }}
          />

          {/* Modal Panel */}
          <div className="fixed inset-y-0 right-0 w-full sm:w-2/3 lg:w-1/2 bg-white shadow-2xl z-50 overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setIsEditing(false);
                  setEditedOrder(null);
                  setUpdateSuccess(null);
                  setUpdateError(null);
                  setPdfSuccess(null);
                  setPdfError(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Duplicate Warning */}
            {selectedOrder.status === 'potential_duplicate' && selectedOrder.duplicateOfOrder && (
              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-purple-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-purple-800">
                      Potential Duplicate Detected
                    </h3>
                    <div className="mt-2 text-sm text-purple-700">
                      <p>
                        This order appears to be a duplicate of order{' '}
                        <span className="font-semibold">
                          {selectedOrder.duplicateOfOrder.orderNumber}
                        </span>{' '}
                        for{' '}
                        <span className="font-semibold">
                          {selectedOrder.duplicateOfOrder.fullName}
                        </span>
                        , created on{' '}
                        {new Date(selectedOrder.duplicateOfOrder.createdAt).toLocaleDateString()}.
                      </p>
                      <p className="mt-1 text-xs">
                        Review both orders to verify if this is a legitimate duplicate or a different person with the same name.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PACE Success Message */}
            {paceSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-800 mb-4">
                {paceSuccess}
              </div>
            )}

            {/* PACE Error Message */}
            {paceError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800 mb-4">
                {paceError}
              </div>
            )}

            {/* Update Success Message */}
            {updateSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-800 mb-4">
                {updateSuccess}
              </div>
            )}

            {/* Update Error Message */}
            {updateError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800 mb-4">
                {updateError}
              </div>
            )}

            {/* PDF Success Message */}
            {pdfSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-800 mb-4">
                {pdfSuccess}
              </div>
            )}

            {/* PDF Error Message */}
            {pdfError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800 mb-4">
                {pdfError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="mb-6 space-y-3">
              {isEditing ? (
                <>
                  <Button
                    onClick={handleSaveOrder}
                    className="w-full"
                    variant="default"
                  >
                    Save Changes
                  </Button>
                  <Button
                    onClick={handleCancelEdit}
                    className="w-full"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleEditOrder}
                    className="w-full"
                    variant="secondary"
                  >
                    Edit Order
                  </Button>
                  <Button
                    onClick={() => handleRegeneratePdf(selectedOrder.id)}
                    disabled={regeneratingPdf}
                    className="w-full"
                    variant="secondary"
                  >
                    {regeneratingPdf ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Regenerating PDF...
                      </>
                    ) : (
                      'Regenerate PDF'
                    )}
                  </Button>
                  <Button
                    onClick={() => handleSendToPace(selectedOrder.id)}
                    disabled={sendingToPace}
                    className="w-full"
                    variant="default"
                  >
                    {sendingToPace ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending to PACE...
                      </>
                    ) : (
                      'Send to PACE'
                    )}
                  </Button>
                  <Button
                    onClick={() => handleDownloadXML(selectedOrder)}
                    className="w-full"
                    variant="outline"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download XML
                  </Button>
                </>
              )}
            </div>

            {/* Order Information */}
            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Employee Information</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  {isEditing && editedOrder ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Order #:</label>
                        <div className="font-bold text-blue-600 text-base">{editedOrder.orderNumber || '-'}</div>
                      </div>
                      {editedOrder.paceJobNumber && (
                        <div>
                          <label className="text-xs text-gray-600 mb-1 block">PACE Job #:</label>
                          <div className="font-bold text-green-600 text-base">{editedOrder.paceJobNumber}</div>
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Full Name:</label>
                        <Input
                          value={editedOrder.fullName || ''}
                          onChange={(e) => handleFieldChange('fullName', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">First Name:</label>
                        <Input
                          value={editedOrder.firstName || ''}
                          onChange={(e) => handleFieldChange('firstName', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Last Name:</label>
                        <Input
                          value={editedOrder.lastName || ''}
                          onChange={(e) => handleFieldChange('lastName', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Print Name:</label>
                        <Input
                          value={editedOrder.printName || ''}
                          onChange={(e) => handleFieldChange('printName', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-600">Order #:</div>
                      <div className="font-bold text-blue-600 text-base">{selectedOrder.orderNumber || '-'}</div>
                      {selectedOrder.paceJobNumber && (
                        <>
                          <div className="text-gray-600">PACE Job #:</div>
                          <div className="font-bold text-green-600 text-base">{selectedOrder.paceJobNumber}</div>
                        </>
                      )}
                      <div className="text-gray-600">Full Name:</div>
                      <div className="font-medium">{selectedOrder.fullName}</div>
                      <div className="text-gray-600">First Name:</div>
                      <div className="font-medium">{selectedOrder.firstName}</div>
                      <div className="text-gray-600">Last Name:</div>
                      <div className="font-medium">{selectedOrder.lastName}</div>
                      <div className="text-gray-600">Print Name:</div>
                      <div className="font-medium">{selectedOrder.printName || selectedOrder.firstName}</div>
                      {selectedOrder.pdfPath && (
                        <>
                          <div className="text-gray-600">PDF:</div>
                          <div>
                            <a
                              href={selectedOrder.pdfPath}
                              download
                              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                            >
                              <Download className="w-4 h-4 mr-1.5" />
                              Download Welcome PDF
                            </a>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Contact Information</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  {isEditing && editedOrder ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Personal Email:</label>
                        <Input
                          value={editedOrder.personalEmail || ''}
                          onChange={(e) => handleFieldChange('personalEmail', e.target.value)}
                          className="text-sm"
                          type="email"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Work Email:</label>
                        <Input
                          value={editedOrder.workEmail || ''}
                          onChange={(e) => handleFieldChange('workEmail', e.target.value)}
                          className="text-sm"
                          type="email"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Phone:</label>
                        <Input
                          value={editedOrder.phoneNumber || ''}
                          onChange={(e) => handleFieldChange('phoneNumber', e.target.value)}
                          className="text-sm"
                          type="tel"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-600">Personal Email:</div>
                      <div className="font-medium">{selectedOrder.personalEmail || 'N/A'}</div>
                      <div className="text-gray-600">Work Email:</div>
                      <div className="font-medium">{selectedOrder.workEmail || 'N/A'}</div>
                      <div className="text-gray-600">Phone:</div>
                      <div className="font-medium">{selectedOrder.phoneNumber || 'N/A'}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Address</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  {isEditing && editedOrder ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Address 1:</label>
                        <Input
                          value={editedOrder.address1 || ''}
                          onChange={(e) => handleFieldChange('address1', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Address 2:</label>
                        <Input
                          value={editedOrder.address2 || ''}
                          onChange={(e) => handleFieldChange('address2', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Address 3:</label>
                        <Input
                          value={editedOrder.address3 || ''}
                          onChange={(e) => handleFieldChange('address3', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">City:</label>
                        <Input
                          value={editedOrder.city || ''}
                          onChange={(e) => handleFieldChange('city', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">State:</label>
                        <Input
                          value={editedOrder.state || ''}
                          onChange={(e) => handleFieldChange('state', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Zip Code:</label>
                        <Input
                          value={editedOrder.zipCode || ''}
                          onChange={(e) => handleFieldChange('zipCode', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Country:</label>
                        <Input
                          value={editedOrder.country || ''}
                          onChange={(e) => handleFieldChange('country', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm">
                      <div>{selectedOrder.address1}</div>
                      {selectedOrder.address2 && <div>{selectedOrder.address2}</div>}
                      {selectedOrder.address3 && <div>{selectedOrder.address3}</div>}
                      <div>
                        {selectedOrder.city}, {selectedOrder.state} {selectedOrder.zipCode}
                      </div>
                      <div className="font-medium">{selectedOrder.country}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Employment */}
              {(selectedOrder.startDate || selectedOrder.manager || selectedOrder.department || isEditing) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Employment Details</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {isEditing && editedOrder ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-600 mb-1 block">Start Date:</label>
                          <Input
                            value={editedOrder.startDate || ''}
                            onChange={(e) => handleFieldChange('startDate', e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 mb-1 block">Manager:</label>
                          <Input
                            value={editedOrder.manager || ''}
                            onChange={(e) => handleFieldChange('manager', e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 mb-1 block">Department:</label>
                          <Input
                            value={editedOrder.department || ''}
                            onChange={(e) => handleFieldChange('department', e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 mb-1 block">Location:</label>
                          <Input
                            value={editedOrder.location || ''}
                            onChange={(e) => handleFieldChange('location', e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {selectedOrder.startDate && (
                          <>
                            <div className="text-gray-600">Start Date:</div>
                            <div className="font-medium">{selectedOrder.startDate}</div>
                          </>
                        )}
                        {selectedOrder.manager && (
                          <>
                            <div className="text-gray-600">Manager:</div>
                            <div className="font-medium">{selectedOrder.manager}</div>
                          </>
                        )}
                        {selectedOrder.department && (
                          <>
                            <div className="text-gray-600">Department:</div>
                            <div className="font-medium">{selectedOrder.department}</div>
                          </>
                        )}
                        {selectedOrder.location && (
                          <>
                            <div className="text-gray-600">Location:</div>
                            <div className="font-medium">{selectedOrder.location}</div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Email Metadata */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Email Metadata</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subject:</span>
                      <span className="font-medium text-right">{selectedOrder.emailSubject}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">From:</span>
                      <span className="font-medium">{selectedOrder.emailFrom}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email Date:</span>
                      <span className="font-medium">
                        {new Date(selectedOrder.emailDate).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Processed:</span>
                      <span className="font-medium">
                        {new Date(selectedOrder.processedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw JSON (Collapsed by default) */}
              <div>
                <details>
                  <summary className="text-sm font-semibold text-gray-700 uppercase mb-3 cursor-pointer hover:text-gray-900">
                    Raw Order Data (JSON)
                  </summary>
                  <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto mt-3">
                    {JSON.stringify(selectedOrder, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      {/* Manual Add Order Dialog */}
      <Dialog open={showManualAddDialog} onOpenChange={setShowManualAddDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <User className="h-6 w-6 text-blue-600" />
              Add New Order Manually
            </DialogTitle>
            <DialogDescription className="text-base">
              Enter employee details below. The system will automatically check for duplicates and generate a PDF welcome packet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Personal Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <User className="h-4 w-4 text-gray-600" />
                <h3 className="font-semibold text-sm text-gray-700 uppercase">Personal Information</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="text-sm font-medium">First Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="firstName"
                    value={manualOrderData.firstName || ''}
                    onChange={(e) => setManualOrderData({ ...manualOrderData, firstName: e.target.value })}
                    placeholder="John"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-sm font-medium">Last Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="lastName"
                    value={manualOrderData.lastName || ''}
                    onChange={(e) => setManualOrderData({ ...manualOrderData, lastName: e.target.value })}
                    placeholder="Doe"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="printName" className="text-sm font-medium">Print Name</Label>
                  <Input
                    id="printName"
                    value={manualOrderData.printName || ''}
                    onChange={(e) => setManualOrderData({ ...manualOrderData, printName: e.target.value })}
                    placeholder="Name for PDF label"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Used on PDF welcome packet</p>
                </div>
                <div>
                  <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                  <Input
                    id="fullName"
                    value={manualOrderData.fullName || ''}
                    onChange={(e) => setManualOrderData({ ...manualOrderData, fullName: e.target.value })}
                    placeholder="Auto-filled from first + last"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <Mail className="h-4 w-4 text-gray-600" />
                <h3 className="font-semibold text-sm text-gray-700 uppercase">Contact Information</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="personalEmail" className="text-sm font-medium">Personal Email</Label>
                  <Input
                    id="personalEmail"
                    type="email"
                    value={manualOrderData.personalEmail || ''}
                    onChange={(e) => setManualOrderData({ ...manualOrderData, personalEmail: e.target.value })}
                    placeholder="john.doe@example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="phoneNumber" className="text-sm font-medium">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    value={manualOrderData.phoneNumber || ''}
                    onChange={(e) => setManualOrderData({ ...manualOrderData, phoneNumber: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <MapPin className="h-4 w-4 text-gray-600" />
                <h3 className="font-semibold text-sm text-gray-700 uppercase">Shipping Address</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="address1" className="text-sm font-medium">Address Line 1 <span className="text-red-500">*</span></Label>
                  <Input
                    id="address1"
                    value={manualOrderData.address1 || ''}
                    onChange={(e) => setManualOrderData({ ...manualOrderData, address1: e.target.value })}
                    placeholder="123 Main Street"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="city" className="text-sm font-medium">City</Label>
                  <Input
                    id="city"
                    value={manualOrderData.city || ''}
                    onChange={(e) => setManualOrderData({ ...manualOrderData, city: e.target.value })}
                    placeholder="San Francisco"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="state" className="text-sm font-medium">State/Province</Label>
                  <Input
                    id="state"
                    value={manualOrderData.state || ''}
                    onChange={(e) => setManualOrderData({ ...manualOrderData, state: e.target.value })}
                    placeholder="California"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="zipCode" className="text-sm font-medium">Zip/Postal Code</Label>
                  <Input
                    id="zipCode"
                    value={manualOrderData.zipCode || ''}
                    onChange={(e) => setManualOrderData({ ...manualOrderData, zipCode: e.target.value })}
                    placeholder="94102"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="country" className="text-sm font-medium">Country</Label>
                  <Input
                    id="country"
                    value={manualOrderData.country || ''}
                    onChange={(e) => setManualOrderData({ ...manualOrderData, country: e.target.value })}
                    placeholder="United States of America"
                    className="mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="countryCategory" className="text-sm font-medium">Country Category <span className="text-red-500">*</span></Label>
                  <select
                    id="countryCategory"
                    value={manualOrderData.countryCategory || ''}
                    onChange={(e) => setManualOrderData({ ...manualOrderData, countryCategory: e.target.value })}
                    className="w-full mt-1 border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select region...</option>
                    <option value="Philippines">🇵🇭 Philippines</option>
                    <option value="Australia">🇦🇺 Australia</option>
                    <option value="India">🇮🇳 India</option>
                    <option value="United States of America">🇺🇸 United States of America</option>
                    <option value="International US">🌍 International US</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Determines shipping method and PDF upload destination</p>
                </div>
              </div>
            </div>
          </div>

          {manualAddSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-800 flex items-start gap-2">
              <svg className="h-5 w-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="font-medium">Success!</p>
                <p className="text-sm">{manualAddSuccess}</p>
              </div>
            </div>
          )}

          {manualAddError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800 flex items-start gap-2">
              <svg className="h-5 w-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="font-medium">Error</p>
                <p className="text-sm">{manualAddError}</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setShowManualAddDialog(false);
              setManualOrderData({});
              setManualAddError(null);
              setManualAddSuccess(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleManualAddOrder}
              disabled={addingManualOrder || !manualOrderData.firstName || !manualOrderData.lastName}
              className="min-w-[120px]"
            >
              {addingManualOrder ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Upload className="h-6 w-6 text-blue-600" />
              Upload HTML Files
            </DialogTitle>
            <DialogDescription className="text-base">
              Upload HTML files from Atlassian welcome packet emails. The system will automatically parse employee data and create orders.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Drag and Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer
                ${isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
                }
              `}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <div className="flex flex-col items-center gap-3">
                <div className={`p-3 rounded-full ${isDragging ? 'bg-blue-100' : 'bg-gray-200'}`}>
                  <FileText className={`h-8 w-8 ${isDragging ? 'text-blue-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <p className="text-lg font-medium text-gray-700">
                    {isDragging ? 'Drop files here' : 'Drag & drop HTML files here'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    or click to browse from your computer
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  Accepts .html and .htm files only
                </p>
              </div>
              <Input
                id="file-input"
                type="file"
                accept=".html,.htm"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setSelectedFiles(files);
                  setUploadError(null);
                }}
                className="hidden"
              />
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">
                    {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFiles([])}
                    className="h-7 text-xs"
                  >
                    Clear all
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3 bg-white">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 p-2 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <span className="text-sm truncate">{file.name}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                        title="Remove file"
                      >
                        <X className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
              <p className="font-medium mb-1">📋 What happens next:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Each HTML file will be parsed to extract employee information</li>
                <li>System automatically checks for duplicate orders</li>
                <li>PDF welcome packets are generated for valid orders</li>
                <li>Orders are ready for PACE integration immediately</li>
              </ul>
            </div>
          </div>

          {uploadSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-800 flex items-start gap-2">
              <svg className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="font-medium">Upload Complete!</p>
                <p className="text-sm mt-1">{uploadSuccess}</p>
              </div>
            </div>
          )}

          {uploadError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800 flex items-start gap-2">
              <svg className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="font-medium">Error</p>
                <p className="text-sm mt-1">{uploadError}</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setShowUploadDialog(false);
              setSelectedFiles([]);
              setUploadError(null);
              setUploadSuccess(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleFileUpload}
              disabled={uploadingFiles || selectedFiles.length === 0}
              className="min-w-[140px]"
            >
              {uploadingFiles ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {selectedFiles.length > 0 && `${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}`}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
