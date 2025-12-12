'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Search,
  Plus,
  Users,
  Building2,
  Package,
  FileBox,
  RefreshCw,
  Loader2,
  Check,
} from 'lucide-react'

interface WarehouseCustomer {
  id: string
  paceCustomerId: string
  name: string
  company: string | null
  isActive: boolean
  lastSyncedAt: string
  createdAt: string
  _count: {
    inventoryItems: number
    asns: number
  }
}

interface PaceCustomer {
  paceCustomerId: string
  name: string
  company: string | null
  salesPerson: string | null
  isAlreadyAdded: boolean
  isActive: boolean | null
}

export default function WarehouseCustomersPage() {
  const [customers, setCustomers] = useState<WarehouseCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Add customer dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [paceSearch, setPaceSearch] = useState('')
  const [paceResults, setPaceResults] = useState<PaceCustomer[]>([])
  const [searchingPace, setSearchingPace] = useState(false)
  const [addingCustomer, setAddingCustomer] = useState<string | null>(null)

  // Clear message after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        search,
        activeOnly: (!showInactive).toString(),
      })
      const response = await fetch(`/api/warehouse/customers?${params}`)
      const data = await response.json()
      if (data.success) {
        setCustomers(data.data)
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
      setMessage({ type: 'error', text: 'Failed to fetch customers' })
    } finally {
      setLoading(false)
    }
  }, [search, showInactive])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const searchPaceCustomers = async () => {
    if (paceSearch.length < 2) {
      setMessage({ type: 'error', text: 'Please enter at least 2 characters to search' })
      return
    }

    try {
      setSearchingPace(true)
      const response = await fetch(
        `/api/warehouse/customers/search-pace?search=${encodeURIComponent(paceSearch)}`
      )
      const data = await response.json()
      if (data.success) {
        setPaceResults(data.data)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to search PACE' })
      }
    } catch (error) {
      console.error('Error searching PACE:', error)
      setMessage({ type: 'error', text: 'Failed to search PACE customers' })
    } finally {
      setSearchingPace(false)
    }
  }

  const addCustomer = async (customer: PaceCustomer) => {
    try {
      setAddingCustomer(customer.paceCustomerId)
      const response = await fetch('/api/warehouse/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paceCustomerId: customer.paceCustomerId,
          name: customer.name,
          company: customer.company,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: `${customer.name} added to warehouse` })
        // Update the pace results to show it's added
        setPaceResults((prev) =>
          prev.map((c) =>
            c.paceCustomerId === customer.paceCustomerId
              ? { ...c, isAlreadyAdded: true, isActive: true }
              : c
          )
        )
        // Refresh the main list
        fetchCustomers()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to add customer' })
      }
    } catch (error) {
      console.error('Error adding customer:', error)
      setMessage({ type: 'error', text: 'Failed to add customer' })
    } finally {
      setAddingCustomer(null)
    }
  }

  const toggleCustomerStatus = async (customer: WarehouseCustomer) => {
    try {
      const response = await fetch(`/api/warehouse/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !customer.isActive }),
      })

      const data = await response.json()
      if (data.success) {
        setMessage({
          type: 'success',
          text: `${customer.name} ${!customer.isActive ? 'activated' : 'deactivated'}`,
        })
        fetchCustomers()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update customer' })
      }
    } catch (error) {
      console.error('Error updating customer:', error)
      setMessage({ type: 'error', text: 'Failed to update customer' })
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Message Banner */}
      {message && (
        <div
          className={`p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-600" />
            Warehouse Customers
          </h1>
          <p className="text-gray-500 mt-1">
            Manage PACE customers enabled for warehouse operations
          </p>
        </div>
        <Button
          onClick={() => {
            setAddDialogOpen(true)
            setPaceSearch('')
            setPaceResults([])
          }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={showInactive}
            onClick={() => setShowInactive(!showInactive)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              showInactive ? 'bg-emerald-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                showInactive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <Label htmlFor="show-inactive" className="text-sm text-gray-600">
            Show inactive
          </Label>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCustomers}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Customers Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>PACE ID</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead className="text-center">ASNs</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No customers found.{' '}
                  <button
                    onClick={() => setAddDialogOpen(true)}
                    className="text-emerald-600 hover:underline"
                  >
                    Add your first customer
                  </button>
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-gray-500 font-mono text-sm">
                    {customer.paceCustomerId}
                  </TableCell>
                  <TableCell>
                    {customer.company ? (
                      <span className="flex items-center gap-1 text-gray-600">
                        <Building2 className="h-3 w-3" />
                        {customer.company}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="flex items-center justify-center gap-1 text-gray-600">
                      <Package className="h-3 w-3" />
                      {customer._count.inventoryItems}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="flex items-center justify-center gap-1 text-gray-600">
                      <FileBox className="h-3 w-3" />
                      {customer._count.asns}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={customer.isActive ? 'default' : 'secondary'}
                      className={
                        customer.isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : ''
                      }
                    >
                      {customer.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCustomerStatus(customer)}
                    >
                      {customer.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Customer Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Customer from PACE</DialogTitle>
            <DialogDescription>
              Search for a customer in PACE to add them to warehouse operations
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by customer name or company..."
                  value={paceSearch}
                  onChange={(e) => setPaceSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchPaceCustomers()}
                  className="pl-10"
                />
              </div>
              <Button
                onClick={searchPaceCustomers}
                disabled={searchingPace || paceSearch.length < 2}
              >
                {searchingPace ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Search'
                )}
              </Button>
            </div>

            {/* Results */}
            <div className="border rounded-lg max-h-80 overflow-y-auto">
              {paceResults.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {paceSearch.length >= 2
                    ? 'No results. Try a different search term.'
                    : 'Enter at least 2 characters to search PACE'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>PACE ID</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paceResults.map((customer) => (
                      <TableRow key={customer.paceCustomerId}>
                        <TableCell className="font-medium">
                          {customer.name}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {customer.company || '-'}
                        </TableCell>
                        <TableCell className="text-gray-500 font-mono text-sm">
                          {customer.paceCustomerId}
                        </TableCell>
                        <TableCell className="text-right">
                          {customer.isAlreadyAdded ? (
                            <Badge
                              variant="secondary"
                              className={
                                customer.isActive
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : ''
                              }
                            >
                              <Check className="h-3 w-3 mr-1" />
                              {customer.isActive ? 'Added' : 'Inactive'}
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addCustomer(customer)}
                              disabled={addingCustomer === customer.paceCustomerId}
                            >
                              {addingCustomer === customer.paceCustomerId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add
                                </>
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
