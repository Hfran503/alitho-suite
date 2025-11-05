import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

/**
 * Inspect a PDF to get its dimensions and form fields
 * This helps determine coordinates for the overlay method
 */
export async function GET(_request: NextRequest) {
  try {
    const templatePath = '/templates/Atlassian_Template.pdf'
    const filePath = join(process.cwd(), 'public', templatePath)
    const buffer = await readFile(filePath)

    const pdfDoc = await PDFDocument.load(buffer)
    const pages = pdfDoc.getPages()

    const pageInfo = pages.map((page, index) => {
      const { width, height } = page.getSize()
      return {
        page: index,
        width,
        height,
      }
    })

    // Try to get form fields
    let formFields: any[] = []
    try {
      const form = pdfDoc.getForm()
      const fields = form.getFields()
      formFields = fields.map(field => ({
        name: field.getName(),
        type: field.constructor.name,
      }))
    } catch (error) {
      formFields = []
    }

    return NextResponse.json({
      pages: pageInfo,
      formFields,
      hasFormFields: formFields.length > 0,
      recommendation: formFields.length > 0
        ? 'Use form field method'
        : 'Use overlay method with coordinates',
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to inspect PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
