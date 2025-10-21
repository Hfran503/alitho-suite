import { db } from '@repo/database'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'

export default async function DashboardPage() {
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

  // Get date ranges for statistics
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Get real data stats (shipping labels and activity)
  const [
    labelCount,
    recentLabels,
    todayLabels,
    labelCosts,
    activeLabels,
    labelsByCarrier,
    activityLogs,
  ] = await Promise.all([
    // Total labels
    db.shippingLabel.count({
      where: { tenantId: membership.tenantId },
    }),
    // Recent labels
    db.shippingLabel.findMany({
      where: { tenantId: membership.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    // Today's labels
    db.shippingLabel.count({
      where: {
        tenantId: membership.tenantId,
        createdAt: { gte: todayStart },
      },
    }),
    // Label costs this month
    db.shippingLabel.aggregate({
      where: {
        tenantId: membership.tenantId,
        createdAt: { gte: monthStart },
      },
      _sum: { cost: true },
      _count: true,
    }),
    // Active labels
    db.shippingLabel.count({
      where: {
        tenantId: membership.tenantId,
        status: 'active',
      },
    }),
    // Labels by carrier
    db.shippingLabel.groupBy({
      by: ['carrier'],
      where: { tenantId: membership.tenantId },
      _count: true,
    }),
    // Recent activity
    db.auditLog.findMany({
      where: { tenantId: membership.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: true },
    }),
  ])

  // Format currency
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(amount))
  }

  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(date))
  }

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {session.user.name || session.user.email}!
        </h1>
        <p className="text-gray-600">
          Here&apos;s what&apos;s happening with {membership.tenant.name} today.
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Labels Created</h3>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              All Time
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{labelCount}</p>
          <p className="text-sm text-gray-500 mt-2">{todayLabels} created today</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Active Labels</h3>
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              In Use
            </span>
          </div>
          <p className="text-3xl font-bold text-green-600">{activeLabels}</p>
          <p className="text-sm text-gray-500 mt-2">Currently active</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Shipping Costs</h3>
            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
              This Month
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {formatCurrency(labelCosts._sum.cost ? Number(labelCosts._sum.cost) : null)}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {labelCosts._count || 0} labels
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Carriers Used</h3>
            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
              Services
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{labelsByCarrier.length}</p>
          <p className="text-sm text-gray-500 mt-2">
            {labelsByCarrier.map((p: any) => p.carrier).join(', ') || 'None'}
          </p>
        </div>
      </div>

      {/* Labels by Carrier/Provider */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Label Breakdown by Carrier */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Labels by Carrier</h2>
          </div>

          <div className="p-6">
            {labelsByCarrier.length === 0 ? (
              <div className="text-center text-gray-500">No labels created yet</div>
            ) : (
              <div className="space-y-4">
                {labelsByCarrier.map((carrier: any) => (
                  <div key={carrier.carrier} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">
                          {carrier.carrier?.substring(0, 2).toUpperCase() || '??'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {carrier.carrier || 'Unknown'}
                        </p>
                        <p className="text-sm text-gray-500">Shipping Carrier</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">{carrier._count}</p>
                      <p className="text-xs text-gray-500">labels</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Shipping Labels */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent Shipping Labels</h2>
            <Link
              href="/shipments"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View Shipments →
            </Link>
          </div>

          <div className="divide-y max-h-96 overflow-y-auto">
            {recentLabels.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No labels created yet</div>
            ) : (
              recentLabels.slice(0, 6).map((label: any) => (
                <div
                  key={label.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {label.carrier || 'Unknown Carrier'}
                      </p>
                      <p className="text-xs text-gray-600 font-mono">
                        {label.trackingNumber || 'No tracking'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(label.createdAt)}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-medium text-sm">
                        {formatCurrency(label.cost)}
                      </p>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${
                          label.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : label.status === 'voided'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {label.status || 'unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Recent Activity</h2>
        </div>

        <div className="divide-y max-h-96 overflow-y-auto">
          {activityLogs.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No recent activity</div>
          ) : (
            activityLogs.map((log: any) => (
              <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-xs font-medium">
                      {log.user?.name?.charAt(0) || log.user?.email?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium text-gray-900">
                        {log.user?.name || log.user?.email || 'System'}
                      </span>{' '}
                      <span className="text-gray-600">{log.action}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(log.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/shipments"
          className="bg-blue-600 text-white p-6 rounded-lg shadow hover:bg-blue-700 transition-colors text-center"
        >
          <h3 className="text-lg font-semibold">View Shipments</h3>
          <p className="text-sm mt-2 opacity-90">Browse PACE shipments and create labels</p>
        </Link>

        <Link
          href="/rates/estimate"
          className="bg-purple-600 text-white p-6 rounded-lg shadow hover:bg-purple-700 transition-colors text-center"
        >
          <h3 className="text-lg font-semibold">Rate Estimates</h3>
          <p className="text-sm mt-2 opacity-90">Get shipping rate quotes</p>
        </Link>

        <Link
          href="/shipment-track"
          className="bg-green-600 text-white p-6 rounded-lg shadow hover:bg-green-700 transition-colors text-center"
        >
          <h3 className="text-lg font-semibold">Track Shipment</h3>
          <p className="text-sm mt-2 opacity-90">Track packages by tracking number</p>
        </Link>
      </div>
    </div>
  )
}
