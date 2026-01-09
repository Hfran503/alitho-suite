import { db } from '@repo/database'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { USER_ROLES } from '@/lib/roles'
import Link from 'next/link'

export default async function CRMDashboardPage() {
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

  // Check if user has access to CRM dashboard
  const allowedRoles = [
    USER_ROLES.CUSTOMER_SERVICE,
    USER_ROLES.ADMIN,
    USER_ROLES.FULL_ADMIN,
  ]
  const hasCRMAccess = allowedRoles.includes(membership.role as any)

  if (!hasCRMAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-2xl px-6">
          <h1 className="text-4xl font-bold mb-4">Access Denied</h1>
          <p className="text-xl text-gray-600 mb-2">
            You don&apos;t have permission to access the CRM dashboard.
          </p>
          <p className="text-gray-500">
            Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    )
  }

  // Fetch CRM statistics
  const [totalContacts, openOpportunities, activeQuotes, recentActivity] = await Promise.all([
    db.contact.count({
      where: { tenantId: membership.tenantId },
    }),
    db.opportunity.count({
      where: {
        tenantId: membership.tenantId,
        status: 'open',
      },
    }),
    db.quote.count({
      where: {
        tenantId: membership.tenantId,
        status: 'sent',
      },
    }),
    db.opportunity.findMany({
      where: { tenantId: membership.tenantId },
      include: { contact: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">CRM Dashboard</h1>
        <p className="text-gray-600">
          Customer Relationship Management for {membership.tenant.name}
        </p>
      </div>

      {/* Welcome Card */}
      <div className="bg-white p-8 rounded-lg shadow-md border-l-4 border-blue-600 max-w-3xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Welcome to the CRM Module
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Manage your customer relationships, track interactions, and drive business growth
              with our comprehensive Customer Relationship Management system.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Getting Started:</strong> The CRM module is ready for your team.
                Contact your administrator to set up additional features and workflows.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/crm/contacts" className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border-l-4 border-teal-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Contacts</p>
              <p className="text-3xl font-bold text-teal-600">{totalContacts}</p>
            </div>
            <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </Link>

        <Link href="/crm/opportunities?status=open" className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border-l-4 border-purple-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Open Opportunities</p>
              <p className="text-3xl font-bold text-purple-600">{openOpportunities}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </Link>

        <Link href="/crm/quotes?status=sent" className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border-l-4 border-blue-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Quotes</p>
              <p className="text-3xl font-bold text-blue-600">{activeQuotes}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
              </svg>
            </div>
          </div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/crm/contacts"
            className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 hover:border-teal-500"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">New Contact</h3>
                <p className="text-sm text-gray-500">Add a new customer or prospect</p>
              </div>
            </div>
          </Link>

          <Link
            href="/crm/opportunities/new"
            className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 hover:border-teal-500"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">New Opportunity</h3>
                <p className="text-sm text-gray-500">Track a new sales deal</p>
              </div>
            </div>
          </Link>

          <Link
            href="/crm/quotes/new"
            className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 hover:border-teal-500"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">New Quote</h3>
                <p className="text-sm text-gray-500">Create a pricing proposal</p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Recent Opportunities</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="divide-y">
              {recentActivity.map((opp: any) => (
                <Link
                  key={opp.id}
                  href={`/crm/opportunities/${opp.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-medium text-gray-900">{opp.title}</p>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          opp.stage === 'won' ? 'bg-green-100 text-green-800' :
                          opp.stage === 'lost' ? 'bg-red-100 text-red-800' :
                          opp.stage === 'quoted' ? 'bg-purple-100 text-purple-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {opp.stage}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {opp.contact.firstName} {opp.contact.lastName} • {new Date(opp.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-teal-600">
                        ${new Intl.NumberFormat('en-US').format(Number(opp.amount))}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
