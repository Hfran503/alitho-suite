'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Warehouse {
  id: string
  name: string
  companyName: string | null
  addressLine1: string
  addressLine2: string | null
  cityLocality: string
  stateProvince: string
  postalCode: string
  countryCode: string
  phone: string | null
  isDefault: boolean
  warehouseType: 'STORAGE_FACILITY' | 'BOTH'
  _count?: {
    locations: number
  }
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchWarehouses() {
      try {
        const response = await fetch('/api/warehouses?includeLocationCount=true')
        if (!response.ok) {
          throw new Error('Failed to fetch warehouses')
        }
        const data = await response.json()
        setWarehouses(data.warehouses || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchWarehouses()
  }, [])

  const handleSetDefault = async (warehouseId: string) => {
    try {
      const response = await fetch(`/api/warehouses/${warehouseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })

      if (response.ok) {
        setWarehouses(prev =>
          prev.map(wh => ({
            ...wh,
            isDefault: wh.id === warehouseId,
          }))
        )
      }
    } catch (err) {
      console.error('Error setting default warehouse:', err)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Storage Facilities</h1>
          <p className="text-gray-600">Manage warehouse facilities for inventory storage</p>
        </div>
        <Link href="/warehouse/warehouses/new">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Warehouse
          </Button>
        </Link>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Locations</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin h-6 w-6 text-emerald-600 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : warehouses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <p className="mb-2">No storage facilities found</p>
                    <p className="text-sm">Create your first warehouse to get started.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              warehouses.map((warehouse) => (
                <TableRow key={warehouse.id}>
                  <TableCell>
                    <div className="font-medium">{warehouse.name}</div>
                    {warehouse.companyName && (
                      <div className="text-sm text-gray-500">{warehouse.companyName}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{warehouse.addressLine1}</div>
                      {warehouse.addressLine2 && <div>{warehouse.addressLine2}</div>}
                      <div>
                        {warehouse.cityLocality}, {warehouse.stateProvince} {warehouse.postalCode}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{warehouse.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge className={warehouse.warehouseType === 'BOTH' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                      {warehouse.warehouseType === 'BOTH' ? 'Storage + Ship' : 'Storage'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{warehouse._count?.locations || 0}</span>
                    <span className="text-gray-500 text-sm ml-1">locations</span>
                  </TableCell>
                  <TableCell>
                    {warehouse.isDefault ? (
                      <Badge className="bg-emerald-100 text-emerald-800">Default</Badge>
                    ) : (
                      <Badge variant="secondary">-</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/warehouse/warehouses/${warehouse.id}`}>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </Link>
                      {!warehouse.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(warehouse.id)}
                          className="text-emerald-600 hover:text-emerald-700"
                        >
                          Set Default
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
