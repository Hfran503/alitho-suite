'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, Send, Copy, Archive, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrderCounts } from './types';

interface OrdersSidebarProps {
  counts: OrderCounts;
  loading?: boolean;
}

const navItems = [
  {
    href: '/atlassian-orders/ready-to-process',
    label: 'Ready to Process',
    icon: ClipboardList,
    countKey: 'readyToSend' as keyof OrderCounts,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-600',
  },
  {
    href: '/atlassian-orders/sent-to-pace',
    label: 'Sent to PACE',
    icon: Send,
    countKey: 'sentToPace' as keyof OrderCounts,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-600',
  },
  {
    href: '/atlassian-orders/duplicates',
    label: 'Duplicates',
    icon: Copy,
    countKey: 'duplicates' as keyof OrderCounts,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-600',
  },
  {
    href: '/atlassian-orders/missing-address',
    label: 'Missing Address',
    icon: AlertTriangle,
    countKey: 'missing' as keyof OrderCounts,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-600',
  },
  {
    href: '/atlassian-orders/archive',
    label: 'Archive',
    icon: Archive,
    countKey: 'archived' as keyof OrderCounts,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-500',
  },
];

export function OrdersSidebar({ counts, loading = false }: OrdersSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-8rem)]">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Atlassian Orders</h2>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            const count = counts[item.countKey];

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? `${item.bgColor} ${item.color} border-l-4 ${item.borderColor}`
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-4 h-4', isActive ? item.color : 'text-gray-500')} />
                  <span>{item.label}</span>
                </div>
                <span
                  className={cn(
                    'text-xs font-semibold px-2 py-0.5 rounded-full',
                    isActive
                      ? `${item.color} bg-white`
                      : 'text-gray-500 bg-gray-100'
                  )}
                >
                  {loading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    count
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Sub-counts for Ready to Process */}
        {(pathname.includes('/ready-to-process') || pathname === '/atlassian-orders') && (
          <div className="mt-4 pl-4 border-l-2 border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">By Region</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Philippines</span>
                <span className="font-medium">{loading ? '-' : counts.philippines}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Australia</span>
                <span className="font-medium">{loading ? '-' : counts.australia}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>India</span>
                <span className="font-medium">{loading ? '-' : counts.india}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>USA</span>
                <span className="font-medium">{loading ? '-' : counts.usa}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>International</span>
                <span className="font-medium">{loading ? '-' : counts.international}</span>
              </div>
            </div>
          </div>
        )}

        {/* Total count */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total Orders</span>
            <span className="font-semibold text-gray-900">
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : counts.all}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
