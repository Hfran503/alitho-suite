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

  // Get stats
  const [orderCount, recentOrders] = await Promise.all([
    db.order.count({
      where: { tenantId: membership.tenantId },
    }),
    db.order.findMany({
      where: { tenantId: membership.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { items: true },
    }),
  ])

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Tenant</h3>
          <p className="text-2xl font-bold">{membership.tenant.name}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Orders</h3>
          <p className="text-2xl font-bold">{orderCount}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Your Role</h3>
          <p className="text-2xl font-bold capitalize">{membership.role}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Orders</h2>
          <Link
            href="/dashboard/orders"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            View All →
          </Link>
        </div>

        <div className="divide-y">
          {recentOrders.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No orders yet</div>
          ) : (
            recentOrders.map((order: any) => (
              <Link
                key={order.id}
                href={`/dashboard/orders/${order.id}`}
                className="block p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="text-sm text-gray-600">{order.customerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {order.currency} {Number(order.total).toFixed(2)}
                    </p>
                    <p className="text-sm">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          order.status === 'delivered'
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {order.status}
                      </span>
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/dashboard/orders/new"
          className="bg-blue-600 text-white p-6 rounded-lg shadow hover:bg-blue-700 transition-colors text-center"
        >
          <h3 className="text-lg font-semibold">Create New Order</h3>
          <p className="text-sm mt-2 opacity-90">Add a new order to the system</p>
        </Link>

        <Link
          href="/dashboard/orders"
          className="bg-gray-600 text-white p-6 rounded-lg shadow hover:bg-gray-700 transition-colors text-center"
        >
          <h3 className="text-lg font-semibold">View All Orders</h3>
          <p className="text-sm mt-2 opacity-90">Browse and manage orders</p>
        </Link>
      </div>
    </div>
  )
}
