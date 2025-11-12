import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db as prisma } from '@repo/database'
import { readdirSync, statSync } from 'fs'
import { join } from 'path'

interface DetectedPage {
  path: string
  label: string
  suggestedMenuKey: string
  isInMenu: boolean
  depth: number
}

// Scan the app directory for page.tsx files
function scanAppDirectory(baseDir: string, currentPath: string = '', depth: number = 0, urlPath: string = ''): DetectedPage[] {
  const pages: DetectedPage[] = []
  const appDir = join(baseDir, 'app', currentPath)

  try {
    // Check if directory exists before scanning
    try {
      statSync(appDir)
    } catch {
      console.error(`Directory does not exist: ${appDir}`)
      return pages
    }

    const entries = readdirSync(appDir)

    for (const entry of entries) {
      const fullPath = join(appDir, entry)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        // Skip special Next.js directories
        if (entry.startsWith('_') || entry === 'api') {
          continue
        }

        // Handle route groups (directories with parentheses) - they don't appear in URLs
        if (entry.startsWith('(')) {
          // Scan inside the route group but don't include it in the URL path
          const subPages = scanAppDirectory(baseDir, join(currentPath, entry), depth, urlPath)
          pages.push(...subPages)
          continue
        }

        // Check if this directory has a page.tsx
        const pageFilePath = join(fullPath, 'page.tsx')
        try {
          statSync(pageFilePath)

          // Found a page!
          // Use urlPath for the actual route (excludes route groups)
          const routePath = urlPath ? `${urlPath}/${entry}` : `/${entry}`
          const cleanPath = routePath.replace(/\\/g, '/')

          // Generate a nice label from the path
          const label = entry
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')

          // Generate menu key
          const menuKey = entry.toLowerCase().replace(/\s+/g, '-')

          pages.push({
            path: cleanPath,
            label,
            suggestedMenuKey: menuKey,
            isInMenu: false, // Will be updated later
            depth
          })
        } catch {
          // No page.tsx in this directory, continue scanning subdirectories
        }

        // Recursively scan subdirectories (but limit depth to avoid too deep nesting)
        if (depth < 3) {
          const newUrlPath = urlPath ? `${urlPath}/${entry}` : `/${entry}`
          const subPages = scanAppDirectory(baseDir, join(currentPath, entry), depth + 1, newUrlPath)
          pages.push(...subPages)
        }
      }
    }
  } catch (error) {
    console.error('Error scanning directory:', error)
  }

  return pages
}

// GET - Detect pages in the app directory
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user and membership
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        memberships: {
          include: { tenant: true }
        }
      }
    })

    if (!user || !user.memberships[0]) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const membership = user.memberships[0]
    const tenantId = membership.tenantId

    // Only full_admin and admin can detect pages
    if (membership.role !== 'full_admin' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get existing menu items to mark which pages are already in the menu
    const existingMenus = await prisma.menuConfiguration.findMany({
      where: { tenantId },
      select: { href: true, menuKey: true }
    })

    const existingPaths = new Set(existingMenus.map((m: typeof existingMenus[number]) => m.href))

    // Scan the app directory
    // In production standalone builds, the structure is different
    let baseDir = process.cwd()

    // Check if we're in a standalone build
    if (baseDir.includes('.next/standalone')) {
      // In standalone, the app code is not available for scanning
      // Return empty result since we can't scan the filesystem in production
      return NextResponse.json({
        newPages: [],
        existingPages: [],
        totalDetected: 0,
        totalNew: 0,
        note: 'Page detection is only available in development mode'
      })
    }

    const detectedPages = scanAppDirectory(baseDir)

    // Mark which pages are already in menu
    const pagesWithStatus = detectedPages.map(page => ({
      ...page,
      isInMenu: existingPaths.has(page.path)
    }))

    // Filter out pages that are already in the menu for the suggestion list
    const newPages = pagesWithStatus.filter(p => !p.isInMenu)
    const existingPages = pagesWithStatus.filter(p => p.isInMenu)

    return NextResponse.json({
      newPages,
      existingPages,
      totalDetected: detectedPages.length,
      totalNew: newPages.length
    })
  } catch (error) {
    console.error('Error detecting pages:', error)
    return NextResponse.json(
      { error: 'Failed to detect pages' },
      { status: 500 }
    )
  }
}

// POST - Add detected pages to menu
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user and membership
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        memberships: {
          include: { tenant: true }
        }
      }
    })

    if (!user || !user.memberships[0]) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const membership = user.memberships[0]
    const tenantId = membership.tenantId

    // Only full_admin and admin can add pages to menu
    if (membership.role !== 'full_admin' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { pages } = body

    if (!Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json(
        { error: 'No pages provided' },
        { status: 400 }
      )
    }

    // Get the current max order to append new items at the end
    const maxOrderItem = await prisma.menuConfiguration.findFirst({
      where: { tenantId, parentKey: null },
      orderBy: { order: 'desc' }
    })

    let nextOrder = (maxOrderItem?.order || 0) + 1

    // Create menu items for each page
    const createdItems = await prisma.$transaction(
      pages.map((page: any) =>
        prisma.menuConfiguration.create({
          data: {
            tenantId,
            menuKey: page.menuKey,
            label: page.label,
            href: page.path,
            icon: page.icon || 'document', // Default icon
            parentKey: page.parentKey || null,
            order: nextOrder++,
            visibleToRoles: page.visibleToRoles || ['full_admin', 'admin'],
            isActive: true,
            visibilityMode: page.visibilityMode || 'role',
            allowedUserIds: page.allowedUserIds || [],
            allowedUserEmails: page.allowedUserEmails || []
          }
        })
      )
    )

    return NextResponse.json({
      success: true,
      created: createdItems.length
    }, { status: 201 })
  } catch (error) {
    console.error('Error adding pages to menu:', error)
    return NextResponse.json(
      { error: 'Failed to add pages to menu' },
      { status: 500 }
    )
  }
}
