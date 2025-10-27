import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Package, Truck } from 'lucide-react'
import Link from 'next/link'

export default async function PortalWelcomePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/portal-signin')
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome{session.user?.name ? `, ${session.user.name}` : ''}!
        </h1>
        <p className="text-gray-600 text-lg">
          Access your shipment information and track your orders in real-time.
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Shipments Card */}
        <Link
          href="/portal/shipments"
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
              <Truck className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                Shipments
              </h3>
              <p className="text-sm text-gray-600">View and track your shipments</p>
            </div>
          </div>
          <p className="text-gray-600">
            Access detailed information about your shipments organized by item and job. Track promise dates,
            ship dates, and delivery status.
          </p>
        </Link>

        {/* Info Card */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-sm border border-blue-200 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <Package className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Need Help?
              </h3>
              <p className="text-sm text-gray-600">We're here to assist you</p>
            </div>
          </div>
          <p className="text-gray-700">
            If you have any questions about your shipments or need assistance, please contact your
            account representative.
          </p>
        </div>
      </div>
    </div>
  )
}
