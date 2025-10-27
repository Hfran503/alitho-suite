import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PortalTopbarClient } from './PortalTopbarClient'

export async function PortalTopbar() {
  const session = await getServerSession(authOptions)

  return <PortalTopbarClient user={session?.user || null} />
}
