import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isCustomerRole } from '@/lib/roles'
import { PortalTopbar } from '@/components/portal/PortalTopbar'
import { PortalSidebar } from '@/components/portal/PortalSidebar'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/portal-signin')
  }

  // Only allow customer roles in portal
  if (!isCustomerRole((session.user as any).role)) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <PortalTopbar />
      <div className="flex">
        <PortalSidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
