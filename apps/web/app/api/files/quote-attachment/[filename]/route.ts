import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// Match the upload route: prefer the absolute Dokploy volume mount; fall back to a
// cwd-relative path for local dev.
const PROD_DIR = '/app/apps/web/public/quote-attachments'
const DEV_DIR = path.join(process.cwd(), 'public', 'quote-attachments')

// Map file extensions to MIME types
const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Read the file
    const fileBuffer = await readFile(filepath)

    // Get MIME type from extension
    const extension = sanitizedFilename.split('.').pop()?.toLowerCase() || ''
    const mimeType = MIME_TYPES[extension] || 'application/octet-stream'

    // Return the file with appropriate headers
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving quote attachment:', error)
    return NextResponse.json({ error: 'Failed to load file' }, { status: 500 })
  }
}
