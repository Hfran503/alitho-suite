import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WarehouseLayoutClient } from '@/components/warehouse/WarehouseLayoutClient'

export default async function WarehouseLayout({
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
      <WarehouseLayoutClient>{children}</WarehouseLayoutClient>
    </div>
  )
}
