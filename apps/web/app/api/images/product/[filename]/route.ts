import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// Match the upload route: prefer the absolute Dokploy volume mount; fall back to a
// cwd-relative path for local dev.
const PROD_DIR = '/app/apps/web/public/product-images'
const DEV_DIR = path.join(process.cwd(), 'public', 'product-images')

// Map file extensions to MIME types
const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename)

    // Check the production mount first, then fall back to the dev path.
    let filepath = path.join(PROD_DIR, sanitizedFilename)
    if (!existsSync(filepath)) {
      filepath = path.join(DEV_DIR, sanitizedFilename)
    }

    // Check if file exists in either location
    if (!existsSync(filepath)) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Read the file
    const fileBuffer = await readFile(filepath)

    // Get MIME type from extension
    const extension = sanitizedFilename.split('.').pop()?.toLowerCase() || 'jpg'
    const mimeType = MIME_TYPES[extension] || 'image/jpeg'

    // Return the image with appropriate headers
    // Convert Buffer to Uint8Array for NextResponse compatibility
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving product image:', error)
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 })
  }
}
