import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CRMLayoutClient } from '@/components/crm/CRMLayoutClient'

export default async function CRMLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <CRMLayoutClient>{children}</CRMLayoutClient>
    </div>
  )
}
