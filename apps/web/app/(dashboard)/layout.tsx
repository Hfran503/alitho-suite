import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Topbar } from '@/components/Topbar'
import { DashboardLayout as DashboardLayoutClient } from '@/components/DashboardLayout'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Topbar />
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </div>
  )
}
