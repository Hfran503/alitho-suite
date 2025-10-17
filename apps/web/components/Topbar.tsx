import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TopbarClient } from './TopbarClient'

export async function Topbar() {
  const session = await getServerSession(authOptions)

  return <TopbarClient user={session?.user || null} />
}
