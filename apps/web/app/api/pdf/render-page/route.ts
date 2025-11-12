import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { pdfToPng } from 'pdf-to-png-converter'

export const dynamic = 'force-dynamic'

/**
 * API endpoint to render a PDF page as an image
 * GET /api/pdf/render-page?template=filename.pdf&page=1
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const templateName = searchParams.get('template')
    const pageNum = parseInt(searchParams.get('page') || '1', 10)

    if (!templateName) {
      return NextResponse.json({ error: 'Template name required' }, { status: 400 })
    }

    // Read the PDF file
    const templatePath = join(process.cwd(), 'public', 'templates', templateName)
    const pdfBuffer = await readFile(templatePath)

    // Convert PDF to PNG
    const pngPages = await pdfToPng(pdfBuffer as any, {
      outputType: 'buffer',
      pagesToProcess: [pageNum], // Only process the requested page
      viewportScale: 2.0, // 2x scale for better quality
      strictPagesToProcess: false,
    } as any)

    if (!pngPages || pngPages.length === 0) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    const imageBuffer = pngPages[0].content as Buffer

    // Return the image
    return new NextResponse(imageBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('PDF rendering error:', error)
    return NextResponse.json(
      {
        error: 'Failed to render PDF page',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
