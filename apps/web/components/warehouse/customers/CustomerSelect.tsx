'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Loader2, Search, Users } from 'lucide-react'

interface WarehouseCustomer {
  id: string
  paceCustomerId: string
  name: string
  company: string | null
  isActive: boolean
}

interface CustomerSelectProps {
  value?: string | null
  onValueChange: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  showNoneOption?: boolean
}

export function CustomerSelect({
  value,
  onValueChange,
  placeholder = 'Select customer...',
  disabled = false,
  required = false,
  className = '',
  showNoneOption = true,
}: CustomerSelectProps) {
  const [customers, setCustomers] = useState<WarehouseCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/warehouse/customers?activeOnly=true&limit=200')
      const data = await response.json()
      if (data.success) {
        setCustomers(data.data)
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const filteredCustomers = customers.filter((customer) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      customer.name.toLowerCase().includes(searchLower) ||
      (customer.company && customer.company.toLowerCase().includes(searchLower)) ||
      customer.paceCustomerId.toLowerCase().includes(searchLower)
    )
  })

  const selectedCustomer = customers.find((c) => c.id === value)

  const handleValueChange = (newValue: string) => {
    if (newValue === '__none__') {
      onValueChange(null)
    } else {
      onValueChange(newValue)
    }
    setOpen(false)
  }

  return (
    <Select
      value={value || '__none__'}
      onValueChange={handleValueChange}
      disabled={disabled}
      open={open}
      onOpenChange={setOpen}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {selectedCustomer ? (
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              {selectedCustomer.name}
              {selectedCustomer.company && (
                <span className="text-gray-400 text-sm">
                  ({selectedCustomer.company})
                </span>
              )}
            </span>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* Search input */}
        <div className="px-2 py-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        <div className="max-h-60 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* None option */}
              {showNoneOption && !required && (
                <SelectItem value="__none__" className="text-gray-500">
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4" />
                    No customer (company-owned)
                  </span>
                </SelectItem>
              )}

              {/* Customer options */}
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  {search ? 'No customers found' : 'No customers available'}
                </div>
              ) : (
                filteredCustomers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <span>{customer.name}</span>
                      {customer.company && (
                        <span className="text-gray-400 text-sm">
                          ({customer.company})
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))
              )}
            </>
          )}
        </div>
      </SelectContent>
    </Select>
  )
}
