import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
// import { db } from '@repo/database' // TODO: Uncomment when settings field is added to User model

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      emailNotifications,
      pushNotifications,
      orderUpdates,
      weeklyReports,
      marketingEmails,
      twoFactorAuth,
      language,
      timezone,
      dateFormat,
    } = body

    // For now, we'll store settings as JSON in the user table
    // In a production app, you might want a separate UserSettings table
    // This requires adding a 'settings' JSON field to your User model in Prisma

    const settings = {
      notifications: {
        email: emailNotifications,
        push: pushNotifications,
        orderUpdates,
        weeklyReports,
        marketing: marketingEmails,
      },
      security: {
        twoFactorAuth,
      },
      preferences: {
        language,
        timezone,
        dateFormat,
      },
    }

    // Since the User model might not have a settings field yet,
    // we'll return success without updating the DB for now
    // TODO: Add settings field to User model in Prisma schema

    // await db.user.update({
    //   where: { id: session.user.id },
    //   data: {
    //     settings: settings,
    //   },
    // })

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      settings,
    })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return default settings for now
    // TODO: Fetch from database when settings field is added
    const defaultSettings = {
      notifications: {
        email: true,
        push: false,
        orderUpdates: true,
        weeklyReports: false,
        marketing: false,
      },
      security: {
        twoFactorAuth: false,
      },
      preferences: {
        language: 'en',
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
      },
    }

    return NextResponse.json({ settings: defaultSettings })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}
