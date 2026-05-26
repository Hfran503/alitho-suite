import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { nanoid } from 'nanoid'

// In production (Dokploy), a named volume is mounted at /app/apps/web/public/product-images.
// Writes MUST land in that exact path so they persist across deploys. The Next.js process
// runs from inside .next/standalone/apps/web, so relative paths land in ephemeral build
// artifacts that get wiped on every redeploy — always resolve to the absolute mount.
function getUploadDir(): string {
  if (existsSync('/app/apps/web/public/product-images')) {
    return '/app/apps/web/public/product-images'
  }
  return path.join(process.cwd(), 'public', 'product-images')
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be less than 5MB' }, { status: 400 })
    }

    // Determine upload directory (standalone Docker vs development)
    const uploadDir = getUploadDir()

    // Ensure upload directory exists
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const uniqueId = nanoid(10)
    const timestamp = Date.now()
    const filename = `${timestamp}-${uniqueId}.${fileExtension}`
    const filepath = path.join(uploadDir, filename)

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Return API URL for serving images (works with Docker volumes in production)
    const publicUrl = `/api/images/product/${filename}`

    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        filename,
      },
    })
  } catch (error) {
    console.error('Product image upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    )
  }
}
