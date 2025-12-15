'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface KitAssembly {
  id: string
  quantity: number
  status: 'COMPLETED' | 'CANCELLED'
  notes: string | null
  assembledAt: string
  kit: {
    id: string
    itemCode: string | null
    sku: string | null
    name: string
  }
  location: {
    id: string
    barcode: string
    name: string | null
    warehouse: {
      id: string
      name: string
    }
  }
  assembledBy: {
    id: string
    name: string | null
    email: string
  } | null
}

export default function KittingPage() {
  const [assemblies, setAssemblies] = useState<KitAssembly[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  useEffect(() => {
    fetchAssemblies()
  }, [pagination.page])

  async function fetchAssemblies() {
    try {
      const response = await fetch(
        `/api/warehouse/kitting?page=${pagination.page}&limit=${pagination.limit}`
      )
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setAssemblies(data.data || [])
      setPagination((prev) => ({
        ...prev,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      }))
    } catch (err) {
      console.error('Error fetching assemblies:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Kit Assembly</h1>
          <p className="text-gray-600">Build kits from components</p>
        </div>
        <Link href="/warehouse/kitting/new">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Build Kit
          </Button>
        </Link>
      </div>

      {/* Assembly History */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading...
            </div>
          </div>
        ) : assemblies.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No assemblies yet</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by building your first kit.</p>
            <div className="mt-6">
              <Link href="/warehouse/kitting/new">
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  Build Kit
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kit
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assembled By
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {assemblies.map((assembly) => (
                    <tr key={assembly.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(assembly.assembledAt).toLocaleDateString()}{' '}
                        <span className="text-gray-500">
                          {new Date(assembly.assembledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/warehouse/items/${assembly.kit.id}`}
                          className="hover:text-emerald-600"
                        >
                          <span className="font-mono text-sm text-emerald-600">
                            {assembly.kit.itemCode || assembly.kit.sku || '-'}
                          </span>
                          <span className="block text-sm text-gray-900">{assembly.kit.name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
                          +{assembly.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-mono text-xs text-gray-600">{assembly.location.barcode}</span>
                        {assembly.location.name && (
                          <span className="block text-gray-500">{assembly.location.name}</span>
                        )}
                        <span className="block text-xs text-gray-400">{assembly.location.warehouse.name}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {assembly.assembledBy?.name || assembly.assembledBy?.email || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            assembly.status === 'COMPLETED'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {assembly.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
