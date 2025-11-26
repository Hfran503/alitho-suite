'use client';

import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import { AtlassianOrder, getStatusBadgeColor, getStatusDisplayText, formatDate } from './types';

interface OrdersTableProps {
  orders: AtlassianOrder[];
  selectedOrder?: AtlassianOrder | null;
  onSelectOrder: (order: AtlassianOrder) => void;
  isSelectMode?: boolean;
  selectedOrderIds?: Set<string>;
  onToggleOrderSelection?: (orderId: string) => void;
  onSelectAllOrders?: (orders: AtlassianOrder[]) => void;
  showPaceJobColumn?: boolean;
  emptyMessage?: string;
}

export function OrdersTable({
  orders,
  selectedOrder,
  onSelectOrder,
  isSelectMode = false,
  selectedOrderIds = new Set(),
  onToggleOrderSelection,
  onSelectAllOrders,
  showPaceJobColumn = true,
  emptyMessage = 'No orders found in this category.',
}: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  const allSelected = orders.length > 0 && orders.every(o => selectedOrderIds.has(o.id));

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
                  onChange={() => onSelectAllOrders?.(orders)}
                  className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                />
              </th>
            )}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Order #
            </th>
            {showPaceJobColumn && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                PACE Job #
              </th>
            )}
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
          {orders.map((order) => (
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
                    onChange={() => onToggleOrderSelection?.(order.id)}
                    className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                  />
                </td>
              )}
              <td
                className="px-4 py-3 whitespace-nowrap cursor-pointer"
                onClick={() => onSelectOrder(order)}
              >
                <div className="text-sm font-semibold text-blue-600">
                  {order.orderNumber || '-'}
                </div>
              </td>
              {showPaceJobColumn && (
                <td
                  className="px-4 py-3 whitespace-nowrap cursor-pointer"
                  onClick={() => onSelectOrder(order)}
                >
                  {order.paceJobNumber ? (
                    <div className="text-sm font-semibold text-green-600">
                      {order.paceJobNumber}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
              )}
              <td
                className="px-4 py-3 whitespace-nowrap cursor-pointer"
                onClick={() => onSelectOrder(order)}
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
                        Duplicate
                      </Badge>
                    </div>
                  )}
                </div>
              </td>
              <td
                className="px-4 py-3 whitespace-nowrap cursor-pointer"
                onClick={() => onSelectOrder(order)}
              >
                <div className="text-sm text-gray-900">{order.personalEmail || order.workEmail}</div>
                {order.phoneNumber && (
                  <div className="text-xs text-gray-500">{order.phoneNumber}</div>
                )}
              </td>
              <td
                className="px-4 py-3 cursor-pointer"
                onClick={() => onSelectOrder(order)}
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
                onClick={() => onSelectOrder(order)}
              >
                {order.country}
              </td>
              <td
                className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                onClick={() => onSelectOrder(order)}
              >
                {order.startDate || '-'}
              </td>
              <td
                className="px-4 py-3 whitespace-nowrap cursor-pointer"
                onClick={() => onSelectOrder(order)}
              >
                <Badge className={getStatusBadgeColor(order.status)}>
                  {getStatusDisplayText(order.status)}
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
                onClick={() => onSelectOrder(order)}
              >
                {formatDate(order.processedAt || order.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
