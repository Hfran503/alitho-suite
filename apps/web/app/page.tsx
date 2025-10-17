import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Get user's tenant
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  })

  if (!membership) {
    // Debug: Check what we have
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { memberships: true }
    })

    console.log('DEBUG - No membership found for user:')
    console.log('  Session user ID:', session.user.id)
    console.log('  Session user email:', session.user.email)
    console.log('  User from DB:', user ? 'Found' : 'Not found')
    console.log('  User memberships count:', user?.memberships?.length || 0)

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-4">No Tenant Found</h2>
          <p className="text-gray-600">Please contact your administrator.</p>
          {process.env.NODE_ENV === 'production' && (
            <div className="mt-4 text-xs text-gray-500">
              <p>User ID: {session.user.id?.substring(0, 8)}...</p>
              <p>Email: {session.user.email}</p>
              <p>Memberships: {user?.memberships?.length || 0}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Redirect to dashboard
  redirect('/dashboard')
}
