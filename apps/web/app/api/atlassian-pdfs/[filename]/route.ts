import { NextRequest, NextResponse } from 'next/server'
import { readFile, access } from 'fs/promises'
import { join } from 'path'
import { constants } from 'fs'

export const dynamic = 'force-dynamic'

/**
 * Serve Atlassian PDFs dynamically
 * This ensures PDFs are accessible even in Docker/standalone builds
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    // In Next.js 15, params is async
    const { filename } = await params

    // Validate filename (prevent directory traversal)
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      )
    }

    // Construct path to PDF
    const pdfPath = join(process.cwd(), 'public', 'atlassian-pdfs', filename)

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
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving Atlassian PDF:', error)
    return NextResponse.json(
      {
        error: 'Failed to serve PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
