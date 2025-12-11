import { db } from '@repo/database'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'
import { USER_ROLES } from '@/lib/roles'

export default async function WarehouseDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return null
  }

  // Get user's tenant
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  })

  if (!membership) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-4">No Tenant Found</h2>
        <p className="text-gray-600">Please contact your administrator.</p>
      </div>
    )
  }

  // Check if user has access to warehouse dashboard
  const allowedRoles = [
    USER_ROLES.WAREHOUSE,
    USER_ROLES.LOGISTICS,
    USER_ROLES.ADMIN,
    USER_ROLES.FULL_ADMIN,
  ]
  const hasWarehouseAccess = allowedRoles.includes(membership.role as any)

  if (!hasWarehouseAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-2xl px-6">
          <h1 className="text-4xl font-bold mb-4">Access Denied</h1>
          <p className="text-xl text-gray-600 mb-2">
            You don&apos;t have permission to access the warehouse dashboard.
          </p>
          <p className="text-gray-500">
            Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    )
  }

  // Placeholder stats - will be populated as modules are built
  const stats = {
    pendingAsns: 0,
    activeReceiving: 0,
    openTasks: 0,
    lowStockAlerts: 0,
    totalLocations: 0,
    totalSkus: 0,
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Warehouse Overview</h1>
        <p className="text-gray-600">
          Manage inventory, receiving, and fulfillment operations for {membership.tenant.name}.
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-emerald-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Pending ASNs</h3>
            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded">
              Inbound
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.pendingAsns}</p>
          <p className="text-sm text-gray-500 mt-2">Awaiting arrival</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Active Receiving</h3>
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
              In Progress
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.activeReceiving}</p>
          <p className="text-sm text-gray-500 mt-2">Sessions in progress</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-teal-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Open Tasks</h3>
            <span className="text-xs bg-teal-100 text-teal-800 px-2 py-1 rounded">
              Fulfillment
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.openTasks}</p>
          <p className="text-sm text-gray-500 mt-2">Pick/Pack/Ship tasks</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Low Stock Alerts</h3>
            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
              Attention
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.lowStockAlerts}</p>
          <p className="text-sm text-gray-500 mt-2">Items below threshold</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Warehouse Overview</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Locations</p>
              <p className="text-2xl font-bold text-emerald-700">{stats.totalLocations}</p>
            </div>
            <div className="p-4 bg-teal-50 rounded-lg">
              <p className="text-sm text-gray-600">Total SKUs</p>
              <p className="text-2xl font-bold text-teal-700">{stats.totalSkus}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Today&apos;s Activity</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Received Today</span>
              <span className="font-semibold">0 items</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Shipped Today</span>
              <span className="font-semibold">0 items</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Tasks Completed</span>
              <span className="font-semibold">0 tasks</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          href="/warehouse/locations"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border-2 border-transparent hover:border-emerald-500 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Manage Locations</h3>
              <p className="text-sm text-gray-600">Set up warehouse bins and zones</p>
            </div>
          </div>
        </Link>

        <Link
          href="/warehouse/items"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border-2 border-transparent hover:border-teal-500 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center group-hover:bg-teal-200 transition-colors">
              <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Item Master</h3>
              <p className="text-sm text-gray-600">Manage SKUs and product data</p>
            </div>
          </div>
        </Link>

        <Link
          href="/warehouse/inventory"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border-2 border-transparent hover:border-cyan-500 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center group-hover:bg-cyan-200 transition-colors">
              <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold">View Inventory</h3>
              <p className="text-sm text-gray-600">Check stock levels and locations</p>
            </div>
          </div>
        </Link>

        <Link
          href="/warehouse/asn"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border-2 border-transparent hover:border-orange-500 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold">ASN Management</h3>
              <p className="text-sm text-gray-600">Create and track inbound shipments</p>
            </div>
          </div>
        </Link>

        <Link
          href="/warehouse/receiving"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border-2 border-transparent hover:border-green-500 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Receiving</h3>
              <p className="text-sm text-gray-600">Process incoming shipments</p>
            </div>
          </div>
        </Link>

        <Link
          href="/warehouse/fulfillment"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border-2 border-transparent hover:border-indigo-500 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Fulfillment</h3>
              <p className="text-sm text-gray-600">Pick, pack, and ship orders</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
