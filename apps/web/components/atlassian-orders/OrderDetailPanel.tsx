'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download } from 'lucide-react';
import { AtlassianOrder, getStatusBadgeColor, getStatusDisplayText } from './types';

interface OrderDetailPanelProps {
  order: AtlassianOrder;
  onClose: () => void;
  onOrderUpdated: () => void;
  showDuplicateActions?: boolean;
}

export function OrderDetailPanel({
  order,
  onClose,
  onOrderUpdated,
  showDuplicateActions = true,
}: OrderDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedOrder, setEditedOrder] = useState<AtlassianOrder | null>(null);
  const [sendingToPace, setSendingToPace] = useState(false);
  const [regeneratingPdf, setRegeneratingPdf] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleEditOrder = () => {
    setEditedOrder({ ...order });
    setIsEditing(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedOrder(null);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleFieldChange = (field: keyof AtlassianOrder, value: string) => {
    if (editedOrder) {
      setEditedOrder({
        ...editedOrder,
        [field]: value,
      });
    }
  };

  const handleSaveOrder = async () => {
    if (!editedOrder) return;

    try {
      // Check if we should update status from missing_address to completed
      const hasRequiredAddress = editedOrder.address1?.trim() &&
                                  editedOrder.city?.trim() &&
                                  editedOrder.country?.trim();
      const shouldUpdateStatus = order.status === 'missing_address' && hasRequiredAddress;

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
          ...(shouldUpdateStatus && { status: 'completed' }),
        }),
      });

      const data = await response.json();

      if (data.success) {
        const message = shouldUpdateStatus
          ? 'Order updated and moved to Ready to Process!'
          : 'Order updated successfully!';
        setSuccessMessage(message);
        setIsEditing(false);
        setTimeout(() => {
          onOrderUpdated();
          setSuccessMessage(null);
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to update order');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleSendToPace = async () => {
    setSendingToPace(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/atlassian/orders/${order.id}/send-to-pace`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(`Order sent to PACE successfully! PACE Job #${data.data.paceJobNumber}`);
        setTimeout(() => {
          onOrderUpdated();
          setSuccessMessage(null);
        }, 3000);
      } else {
        throw new Error(data.error || 'Failed to send order to PACE');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSendingToPace(false);
    }
  };

  const handleRegeneratePdf = async () => {
    setRegeneratingPdf(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/atlassian/orders/${order.id}/regenerate-pdf`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage('PDF regenerated successfully!');
        setTimeout(() => {
          onOrderUpdated();
          setSuccessMessage(null);
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to regenerate PDF');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setRegeneratingPdf(false);
    }
  };

  const handleQuickStatusChange = async (newStatus: string, clearDuplicate: boolean = false) => {
    setChangingStatus(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const updateData: any = { status: newStatus };

      if (clearDuplicate) {
        updateData.duplicateOfOrderId = null;
      }

      const response = await fetch(`/api/atlassian/orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (data.success) {
        const statusText = newStatus === 'completed' ? 'Ready To Process' : 'Archived';
        setSuccessMessage(`Order marked as ${statusText}!`);
        setTimeout(() => {
          onOrderUpdated();
          setSuccessMessage(null);
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to update order status');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setChangingStatus(false);
    }
  };

  const handleDownloadXML = () => {
    const fullName = order.fullName || `${order.firstName} ${order.lastName}`;
    const pdfUrl = order.sftpUrl || (order.pdfPath ? `${window.location.origin}${order.pdfPath}` : '');

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

    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `order-${order.orderNumber || order.id}.xml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const currentOrder = isEditing && editedOrder ? editedOrder : order;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-2/3 lg:w-1/2 bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
              <Badge className={getStatusBadgeColor(order.status)}>
                {getStatusDisplayText(order.status)}
              </Badge>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              &times;
            </button>
          </div>

          {/* Duplicate Warning */}
          {showDuplicateActions && order.status === 'potential_duplicate' && order.duplicateOfOrder && (
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
                        {order.duplicateOfOrder.orderNumber}
                      </span>{' '}
                      for{' '}
                      <span className="font-semibold">
                        {order.duplicateOfOrder.fullName}
                      </span>
                      , created on{' '}
                      {new Date(order.duplicateOfOrder.createdAt).toLocaleDateString()}.
                    </p>
                    <p className="mt-1 text-xs">
                      Review both orders to verify if this is a legitimate duplicate or a different person with the same name.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleQuickStatusChange('completed', true)}
                        disabled={changingStatus}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {changingStatus ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : null}
                        Mark as Ready To Process
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickStatusChange('archived', false)}
                        disabled={changingStatus}
                        className="text-gray-600 hover:bg-gray-100"
                      >
                        {changingStatus ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : null}
                        Archive (Don't Fulfill)
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-800 mb-4">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800 mb-4">
              {errorMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mb-6 space-y-3">
            {isEditing ? (
              <>
                <Button onClick={handleSaveOrder} className="w-full" variant="default">
                  Save Changes
                </Button>
                <Button onClick={handleCancelEdit} className="w-full" variant="outline">
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button onClick={handleEditOrder} className="w-full" variant="secondary">
                  Edit Order
                </Button>
                <Button
                  onClick={handleRegeneratePdf}
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
                  onClick={handleSendToPace}
                  disabled={sendingToPace || order.status === 'sent_to_pace'}
                  className="w-full"
                  variant="default"
                >
                  {sendingToPace ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending to PACE...
                    </>
                  ) : order.status === 'sent_to_pace' ? (
                    'Already Sent to PACE'
                  ) : (
                    'Send to PACE'
                  )}
                </Button>
                <Button onClick={handleDownloadXML} className="w-full" variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Download XML
                </Button>
              </>
            )}
          </div>

          {/* Order Information Sections */}
          <div className="space-y-6">
            {/* Employee Info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Employee Information</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Order #:</label>
                      <div className="font-bold text-blue-600 text-base">{currentOrder.orderNumber || '-'}</div>
                    </div>
                    {currentOrder.paceJobNumber && (
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">PACE Job #:</label>
                        <div className="font-bold text-green-600 text-base">{currentOrder.paceJobNumber}</div>
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Full Name:</label>
                      <Input
                        value={currentOrder.fullName || ''}
                        onChange={(e) => handleFieldChange('fullName', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">First Name:</label>
                      <Input
                        value={currentOrder.firstName || ''}
                        onChange={(e) => handleFieldChange('firstName', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Last Name:</label>
                      <Input
                        value={currentOrder.lastName || ''}
                        onChange={(e) => handleFieldChange('lastName', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Print Name:</label>
                      <Input
                        value={currentOrder.printName || ''}
                        onChange={(e) => handleFieldChange('printName', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-600">Order #:</div>
                    <div className="font-bold text-blue-600 text-base">{order.orderNumber || '-'}</div>
                    {order.paceJobNumber && (
                      <>
                        <div className="text-gray-600">PACE Job #:</div>
                        <div className="font-bold text-green-600 text-base">{order.paceJobNumber}</div>
                      </>
                    )}
                    <div className="text-gray-600">Full Name:</div>
                    <div className="font-medium">{order.fullName}</div>
                    <div className="text-gray-600">First Name:</div>
                    <div className="font-medium">{order.firstName}</div>
                    <div className="text-gray-600">Last Name:</div>
                    <div className="font-medium">{order.lastName}</div>
                    <div className="text-gray-600">Print Name:</div>
                    <div className="font-medium">{order.printName || order.firstName}</div>
                    {order.pdfPath && (
                      <>
                        <div className="text-gray-600">PDF:</div>
                        <div>
                          <a
                            href={order.pdfPath}
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
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Personal Email:</label>
                      <Input
                        value={currentOrder.personalEmail || ''}
                        onChange={(e) => handleFieldChange('personalEmail', e.target.value)}
                        className="text-sm"
                        type="email"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Work Email:</label>
                      <Input
                        value={currentOrder.workEmail || ''}
                        onChange={(e) => handleFieldChange('workEmail', e.target.value)}
                        className="text-sm"
                        type="email"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Phone:</label>
                      <Input
                        value={currentOrder.phoneNumber || ''}
                        onChange={(e) => handleFieldChange('phoneNumber', e.target.value)}
                        className="text-sm"
                        type="tel"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-600">Personal Email:</div>
                    <div className="font-medium">{order.personalEmail || 'N/A'}</div>
                    <div className="text-gray-600">Work Email:</div>
                    <div className="font-medium">{order.workEmail || 'N/A'}</div>
                    <div className="text-gray-600">Phone:</div>
                    <div className="font-medium">{order.phoneNumber || 'N/A'}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Address</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Address 1:</label>
                      <Input
                        value={currentOrder.address1 || ''}
                        onChange={(e) => handleFieldChange('address1', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Address 2:</label>
                      <Input
                        value={currentOrder.address2 || ''}
                        onChange={(e) => handleFieldChange('address2', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Address 3:</label>
                      <Input
                        value={currentOrder.address3 || ''}
                        onChange={(e) => handleFieldChange('address3', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">City:</label>
                      <Input
                        value={currentOrder.city || ''}
                        onChange={(e) => handleFieldChange('city', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">State:</label>
                      <Input
                        value={currentOrder.state || ''}
                        onChange={(e) => handleFieldChange('state', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Zip Code:</label>
                      <Input
                        value={currentOrder.zipCode || ''}
                        onChange={(e) => handleFieldChange('zipCode', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Country:</label>
                      <Input
                        value={currentOrder.country || ''}
                        onChange={(e) => handleFieldChange('country', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-sm">
                    <div>{order.address1}</div>
                    {order.address2 && <div>{order.address2}</div>}
                    {order.address3 && <div>{order.address3}</div>}
                    <div>
                      {order.city}, {order.state} {order.zipCode}
                    </div>
                    <div className="font-medium">{order.country}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Employment */}
            {(order.startDate || order.manager || order.department || isEditing) && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Employment Details</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Start Date:</label>
                        <Input
                          value={currentOrder.startDate || ''}
                          onChange={(e) => handleFieldChange('startDate', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Manager:</label>
                        <Input
                          value={currentOrder.manager || ''}
                          onChange={(e) => handleFieldChange('manager', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Department:</label>
                        <Input
                          value={currentOrder.department || ''}
                          onChange={(e) => handleFieldChange('department', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Location:</label>
                        <Input
                          value={currentOrder.location || ''}
                          onChange={(e) => handleFieldChange('location', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {order.startDate && (
                        <>
                          <div className="text-gray-600">Start Date:</div>
                          <div className="font-medium">{order.startDate}</div>
                        </>
                      )}
                      {order.manager && (
                        <>
                          <div className="text-gray-600">Manager:</div>
                          <div className="font-medium">{order.manager}</div>
                        </>
                      )}
                      {order.department && (
                        <>
                          <div className="text-gray-600">Department:</div>
                          <div className="font-medium">{order.department}</div>
                        </>
                      )}
                      {order.location && (
                        <>
                          <div className="text-gray-600">Location:</div>
                          <div className="font-medium">{order.location}</div>
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
                    <span className="font-medium text-right">{order.emailSubject}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">From:</span>
                    <span className="font-medium">{order.emailFrom}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email Date:</span>
                    <span className="font-medium">
                      {new Date(order.emailDate).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Processed:</span>
                    <span className="font-medium">
                      {new Date(order.processedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Raw JSON */}
            <div>
              <details>
                <summary className="text-sm font-semibold text-gray-700 uppercase mb-3 cursor-pointer hover:text-gray-900">
                  Raw Order Data (JSON)
                </summary>
                <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto mt-3">
                  {JSON.stringify(order, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
