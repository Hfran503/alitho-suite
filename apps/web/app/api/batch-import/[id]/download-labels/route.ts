import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { PDFDocument } from 'pdf-lib'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      select: { tenantId: true },
    })

    if (!membership?.tenantId) {
      return NextResponse.json({ error: 'User has no tenant' }, { status: 400 })
    }

    // Verify batch belongs to user's tenant and get successful rows with labels
    const batch = await db.batchImport.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
      },
      include: {
        rows: {
          where: {
            status: 'SUCCESS',
            labelUrl: { not: null },
          },
          orderBy: { rowNumber: 'asc' },
        },
      },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    if (batch.rows.length === 0) {
      return NextResponse.json({ error: 'No labels available to download' }, { status: 404 })
    }

    // Create a new PDF document to merge all labels
    const mergedPdf = await PDFDocument.create()

    // Fetch and merge each label PDF in row order
    for (const row of batch.rows) {
      if (!row.labelUrl) continue

      try {
        // Fetch the label PDF
        const response = await fetch(row.labelUrl)
        if (!response.ok) {
          console.error(`Failed to fetch label for row ${row.rowNumber}: ${response.statusText}`)
          continue
        }

        const pdfBytes = await response.arrayBuffer()
        const pdf = await PDFDocument.load(pdfBytes)

        // Copy all pages from this label to the merged PDF
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
        copiedPages.forEach((page) => {
          mergedPdf.addPage(page)
        })
      } catch (error) {
        console.error(`Error merging label for row ${row.rowNumber}:`, error)
        // Continue with other labels even if one fails
      }
    }

    // Generate the merged PDF bytes
    const mergedPdfBytes = await mergedPdf.save()

    // Return the merged PDF as a download
    return new NextResponse(Buffer.from(mergedPdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="batch-${id}-labels.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('[API] Batch download labels error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to download labels' },
      { status: 500 }
    )
  }
}
