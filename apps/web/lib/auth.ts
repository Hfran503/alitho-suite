import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { db } from '@repo/database'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as any,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  events: {
    // Track sign in events to create session records
    async signIn({ user }) {
      // Create a session record for tracking (even though we use JWT)
      try {
        if (user?.id) {
          // Create session record that expires in 30 days
          const expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + 30)

          await db.session.create({
            data: {
              userId: user.id,
              expires: expiresAt,
              sessionToken: `jwt-${user.id}-${Date.now()}`, // Unique token for tracking
            },
          })
          console.log('Session record created for:', user.email)
        }
      } catch (error) {
        console.error('Error creating session record:', error)
      }
    },
    async signOut({ token }) {
      // Clean up session records when user signs out
      try {
        if (token?.id) {
          await db.session.deleteMany({
            where: { userId: token.id as string },
          })
          console.log('Session records deleted for user')
        }
      } catch (error) {
        console.error('Error deleting session records:', error)
      }
    },
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const user = await db.user.findUnique({
            where: { email: credentials.email },
          })

          if (!user || !user.password) {
            return null
          }

          const isValid = await compare(credentials.password, user.password)

          if (!isValid) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            passwordResetRequired: user.passwordResetRequired || false,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      },
    }),
    // Add more providers here (Google, GitHub, OIDC, SAML, etc.)
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.picture = user.image
        token.passwordResetRequired = (user as any).passwordResetRequired || false
      }

      // Refresh user data from database on each request
      if (token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordResetRequired: true,
          },
        })

        if (dbUser) {
          token.email = dbUser.email
          token.name = dbUser.name
          token.picture = dbUser.image
          token.passwordResetRequired = dbUser.passwordResetRequired
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string | null
        session.user.image = token.picture as string | null
        ;(session.user as any).passwordResetRequired = token.passwordResetRequired || false
      }
      return session
    },
  },
}
