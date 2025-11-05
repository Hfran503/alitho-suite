import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

/**
 * Specialized endpoint for Atlassian template
 * Replaces {name} text directly in the PDF content stream
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Load the Atlassian template
    const templatePath = join(process.cwd(), 'public', 'templates', 'Atlassian_Template.pdf')
    const buffer = await readFile(templatePath)

    // Read as string to do text replacement
    let pdfString = buffer.toString('binary')

    // Replace {name} with the actual name in the PDF content stream
    // The {name} text is encoded in the PDF, we need to replace it
    pdfString = pdfString.replace(/\{name\}/g, name)

    // Also try common PDF text encodings
    pdfString = pdfString.replace(/\{nam/g, name.substring(0, 3) || name)

    // Convert back to buffer
    const modifiedBuffer = Buffer.from(pdfString, 'binary')

    return new NextResponse(modifiedBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="welcome-${name.toLowerCase().replace(/\s+/g, '-')}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Atlassian PDF generation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
