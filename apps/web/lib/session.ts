import { cookies } from 'next/headers'
import { db } from '@repo/database'
import { nanoid } from 'nanoid'

const SESSION_COOKIE_NAME = 'session_token'
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds

export interface SessionUser {
  id: string
  email: string
  name: string | null
  image: string | null
}

/**
 * Create a new session for a user
 */
export async function createSession(userId: string): Promise<string> {
  const sessionToken = nanoid(32)
  const expires = new Date(Date.now() + SESSION_DURATION)

  await db.session.create({
    data: {
      sessionToken,
      userId,
      expires,
    },
  })

  return sessionToken
}

/**
 * Get the current session from cookies
 */
export async function getSession(): Promise<{ user: SessionUser } | null> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!sessionToken) {
    return null
  }

  const session = await db.session.findUnique({
    where: { sessionToken },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
        },
      },
    },
  })

  if (!session) {
    return null
  }

  // Check if session is expired
  if (session.expires < new Date()) {
    await db.session.delete({ where: { sessionToken } })
    return null
  }

  // Update session expiry on each request (sliding expiration)
  const newExpiry = new Date(Date.now() + SESSION_DURATION)
  await db.session.update({
    where: { sessionToken },
    data: { expires: newExpiry },
  })

  return {
    user: session.user,
  }
}

/**
 * Set session cookie
 */
export async function setSessionCookie(sessionToken: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000, // convert to seconds
    path: '/',
  })
}

/**
 * Delete session and clear cookie
 */
export async function deleteSession() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (sessionToken) {
    await db.session.deleteMany({ where: { sessionToken } })
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Delete all sessions for a user (sign out from all devices)
 */
export async function deleteAllUserSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } })
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string) {
  return await db.session.findMany({
    where: {
      userId,
      expires: { gt: new Date() },
    },
    orderBy: { expires: 'desc' },
  })
}

/**
 * Delete a specific session by token (force logout)
 */
export async function deleteSessionByToken(sessionToken: string) {
  await db.session.delete({ where: { sessionToken } })
}
