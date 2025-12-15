'use client'

import { useState } from 'react'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'

interface KitComponent {
  id: string
  component: {
    id: string
    itemCode: string | null
    sku: string | null
    name: string
  }
  quantity: number
}

interface KitBadgeProps {
  kitId: string
}

export function KitBadge({ kitId }: KitBadgeProps) {
  const [components, setComponents] = useState<KitComponent[]>([])
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  const fetchComponents = async () => {
    if (fetched) return

    setLoading(true)
    try {
      const response = await fetch(`/api/warehouse/items/${kitId}/components`)
      if (response.ok) {
        const data = await response.json()
        setComponents(data.data || [])
      }
    } catch (err) {
      console.error('Error fetching components:', err)
    } finally {
      setLoading(false)
      setFetched(true)
    }
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 cursor-help"
          onMouseEnter={fetchComponents}
        >
          <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Kit
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-64 p-0" align="start">
        <div className="px-3 py-2 bg-gray-50 border-b">
          <p className="text-xs font-medium text-gray-600">Kit Components</p>
        </div>
        <div className="p-2 max-h-48 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-3">
              <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : components.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-3">No components defined</p>
          ) : (
            <ul className="space-y-1">
              {components.map((comp) => (
                <li key={comp.id} className="flex items-center justify-between text-xs py-1 px-1 hover:bg-gray-50 rounded">
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-emerald-600 mr-1">
                      {comp.component.itemCode || comp.component.sku || '-'}
                    </span>
                    <span className="text-gray-700 truncate block">
                      {comp.component.name}
                    </span>
                  </div>
                  <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-medium flex-shrink-0">
                    ×{comp.quantity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
