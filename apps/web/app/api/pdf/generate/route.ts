import { NextRequest, NextResponse } from 'next/server'
import {
  fillPdfFormFields,
  addTextOverlays,
} from '@/lib/pdf-template'
// import { getServerSession } from 'next-auth'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

/**
 * API endpoint to generate PDFs from templates
 *
 * POST /api/pdf/generate
 *
 * Request body:
 * {
 *   templateUrl?: string,        // Local path (/templates/file.pdf) or external URL
 *   templateFile?: string,        // Base64 encoded PDF template
 *   method: 'form' | 'overlay',  // Method to fill the PDF
 *   data: {                       // Data to fill in the template
 *     name: string,
 *     [key: string]: any
 *   },
 *   overlays?: [{                 // If method is 'overlay'
 *     text: string,
 *     x: number,
 *     y: number,
 *     page?: number
 *   }]
 * }
 *
 * Response: PDF file (application/pdf)
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Check authentication
    // const session = await getServerSession()
    // if (!session) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const body = await request.json()
    const { templateUrl, templateFile, method = 'form', data, overlays } = body

    if (!templateUrl && !templateFile) {
      return NextResponse.json(
        { error: 'Either templateUrl or templateFile is required' },
        { status: 400 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Data object is required' },
        { status: 400 }
      )
    }

    // Load the template
    let templateBuffer: ArrayBuffer

    if (templateFile) {
      // If template is provided as base64
      const base64Data = templateFile.split(',')[1] || templateFile
      const binaryString = Buffer.from(base64Data, 'base64')
      templateBuffer = binaryString.buffer.slice(
        binaryString.byteOffset,
        binaryString.byteOffset + binaryString.byteLength
      ) as ArrayBuffer
    } else if (templateUrl) {
      // Check if it's a local file path (starts with /)
      if (templateUrl.startsWith('/')) {
        // Read from filesystem (public folder)
        try {
          const filePath = join(process.cwd(), 'public', templateUrl)
          const buffer = await readFile(filePath)
          templateBuffer = buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength
          ) as ArrayBuffer
        } catch (fsError) {
          return NextResponse.json(
            {
              error: 'Failed to read template file',
              details: fsError instanceof Error ? fsError.message : 'File not found'
            },
            { status: 400 }
          )
        }
      } else {
        // Fetch from external URL
        const response = await fetch(templateUrl)
        if (!response.ok) {
          return NextResponse.json(
            { error: 'Failed to fetch template' },
            { status: 400 }
          )
        }
        templateBuffer = await response.arrayBuffer()
      }
    } else {
      return NextResponse.json(
        { error: 'No template provided' },
        { status: 400 }
      )
    }

    // Generate the PDF based on method
    let pdfBytes: Uint8Array

    if (method === 'overlay' && overlays) {
      // Use overlay method with specific coordinates
      pdfBytes = await addTextOverlays(templateBuffer, overlays)
    } else {
      // Use form field method (default)
      pdfBytes = await fillPdfFormFields(templateBuffer, data)
    }

    // Return the PDF
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="generated-${Date.now()}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
