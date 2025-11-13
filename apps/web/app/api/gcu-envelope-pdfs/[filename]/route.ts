import { NextRequest, NextResponse } from 'next/server'
import { readFile, access } from 'fs/promises'
import { join } from 'path'
import { constants } from 'fs'

export const dynamic = 'force-dynamic'

/**
 * Serve GCU Envelope Order PDFs dynamically
 * This ensures PDFs are accessible even in Docker/standalone builds
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    // In Next.js 15, params is async
    const { filename: rawFilename } = await params

    // Decode URL-encoded filename (e.g., %20 -> space)
    const filename = decodeURIComponent(rawFilename)

    // Validate filename (prevent directory traversal)
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      )
    }

    // Construct path to PDF
    const pdfPath = join(process.cwd(), 'public', 'gcu-envelope-pdfs', filename)

    // Check if file exists
    try {
      await access(pdfPath, constants.R_OK)
    } catch {
      return NextResponse.json(
        { error: 'PDF not found' },
        { status: 404 }
      )
    }

    // Read file
    const buffer = await readFile(pdfPath)

    // Return PDF with proper headers
    // Convert Buffer to Uint8Array for Next.js compatibility

    // Check if this is a regenerated PDF (has timestamp query param)
    const url = new URL(_request.url)
    const hasTimestamp = url.searchParams.has('t')

    // Use different cache strategy for regenerated PDFs vs original uploads
    const cacheControl = hasTimestamp
      ? 'no-cache, no-store, must-revalidate' // Force fresh fetch for regenerated PDFs
      : 'public, max-age=31536000, immutable'  // Long cache for original uploads

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': cacheControl,
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Error serving GCU Envelope PDF:', error)
    return NextResponse.json(
      {
        error: 'Failed to serve PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
