'use client';

import { useState, useEffect, useCallback } from 'react';
import { OrdersSidebar } from '@/components/atlassian-orders';
import { OrderCounts } from '@/components/atlassian-orders/types';

interface AtlassianOrdersLayoutProps {
  children: React.ReactNode;
}

export default function AtlassianOrdersLayout({ children }: AtlassianOrdersLayoutProps) {
  const [counts, setCounts] = useState<OrderCounts>({
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
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    try {
      const response = await fetch('/api/atlassian/orders?limit=1&offset=0');
      const data = await response.json();

      if (data.success && data.counts) {
        setCounts(data.counts);
      }
    } catch (error) {
      console.error('Failed to fetch order counts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();

    // Refresh counts every 30 seconds
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  return (
    <div className="flex min-h-[calc(100vh-8rem)]">
      <OrdersSidebar counts={counts} loading={loading} />
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
