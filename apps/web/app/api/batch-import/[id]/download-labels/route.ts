import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { PDFDocument } from 'pdf-lib'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check query parameter for page mode (firstPageOnly=true to only include first page of each label)
    const { searchParams } = new URL(req.url)
    const firstPageOnly = searchParams.get('firstPageOnly') === 'true'

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

    // Deduplicate rows by rowNumber (in case of retries creating multiple successful records)
    // Keep the most recent successful attempt for each rowNumber
    const uniqueRows = new Map<number, typeof batch.rows[number]>()

    for (const row of batch.rows) {
      const existing = uniqueRows.get(row.rowNumber)
      // Keep the row with the most recent processedAt timestamp
      if (!existing || (row.processedAt && (!existing.processedAt || row.processedAt > existing.processedAt))) {
        uniqueRows.set(row.rowNumber, row)
      }
    }

    const deduplicatedRows = Array.from(uniqueRows.values()).sort((a, b) => a.rowNumber - b.rowNumber)

    // Further deduplicate by labelUrl - multiple boxes in the same shipment often share
    // the same combined PDF label from ShipStation. We only need to include each unique PDF once.
    const uniqueLabelUrls = new Map<string, typeof batch.rows[number]>()
    for (const row of deduplicatedRows) {
      if (row.labelUrl && !uniqueLabelUrls.has(row.labelUrl)) {
        uniqueLabelUrls.set(row.labelUrl, row)
      }
    }

    const finalRows = Array.from(uniqueLabelUrls.values()).sort((a, b) => a.rowNumber - b.rowNumber)

    if (finalRows.length < deduplicatedRows.length) {
      console.log(`[Download Labels] 📦 Multi-box shipment detected: ${deduplicatedRows.length} rows share ${finalRows.length} unique label PDFs`)
    }

    console.log(`[Download Labels] Total successful rows: ${batch.rows.length}, Unique by rowNumber: ${deduplicatedRows.length}, Unique by labelUrl: ${finalRows.length}`)

    if (deduplicatedRows.length < batch.rows.length) {
      console.warn(`[Download Labels] ⚠️ Found ${batch.rows.length - deduplicatedRows.length} duplicate row(s) from retries`)
    }

    // Create a new PDF document to merge all labels
    const mergedPdf = await PDFDocument.create()

    // Track statistics and detailed processing log
    let totalLabels = 0
    let totalPages = 0
    let multiPageCount = 0
    const processedRowNumbers = new Set<number>()
    const processingLog: Array<{rowNum: number, pages: number, tracking?: string}> = []

    console.log(`[Download Labels] 🚀 Starting to merge ${finalRows.length} unique label PDFs...`)

    // Fetch and merge each unique label PDF (deduplicated by labelUrl to avoid duplicates from multi-box shipments)
    for (const row of finalRows) {
      if (!row.labelUrl) {
        console.log(`[Download Labels] ⚠️ Row ${row.rowNumber}: Skipping (no labelUrl)`)
        continue
      }

      // Check for duplicates in the loop itself
      if (processedRowNumbers.has(row.rowNumber)) {
        console.error(`[Download Labels] ❌ DUPLICATE DETECTED: Row ${row.rowNumber} already processed!`)
        continue
      }
      processedRowNumbers.add(row.rowNumber)

      try {
        // Fetch the label PDF
        const response = await fetch(row.labelUrl)
        if (!response.ok) {
          console.error(`[Download Labels] ❌ Row ${row.rowNumber}: Failed to fetch (${response.statusText})`)
          continue
        }

        const pdfBytes = await response.arrayBuffer()
        const pdf = await PDFDocument.load(pdfBytes)

        const pageCount = pdf.getPageCount()
        totalLabels++

        if (pageCount > 1) {
          multiPageCount++
          console.log(`[Download Labels] 📄 Row ${row.rowNumber}: Multi-page label (${pageCount} pages) - Tracking: ${row.trackingNumber || 'N/A'}`)
        }

        // Copy pages from this label to the merged PDF
        if (firstPageOnly) {
          // Only copy the first page (shipping label)
          const [firstPage] = await mergedPdf.copyPages(pdf, [0])
          mergedPdf.addPage(firstPage)
          totalPages++
        } else {
          // Copy all pages (shipping label + packing slip/invoice)
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
          copiedPages.forEach((page) => {
            mergedPdf.addPage(page)
            totalPages++
          })
        }

        processingLog.push({
          rowNum: row.rowNumber,
          pages: pageCount,
          tracking: row.trackingNumber || undefined
        })

      } catch (error) {
        console.error(`[Download Labels] ❌ Row ${row.rowNumber}: Error merging -`, error)
        // Continue with other labels even if one fails
      }
    }

    console.log(
      `[Download Labels] ✅ Merged ${totalLabels} labels (${totalPages} total pages)` +
      `${multiPageCount > 0 ? `, ${multiPageCount} multi-page labels` : ''}` +
      `${firstPageOnly ? ' [First page only mode]' : ' [All pages mode]'}`
    )

    // Log any discrepancies
    if (totalLabels !== finalRows.length) {
      console.warn(`[Download Labels] ⚠️ Discrepancy: Expected ${finalRows.length} unique label PDFs, actually merged ${totalLabels}`)
    }

    // If there are multi-page labels, log the first few for inspection
    if (multiPageCount > 0) {
      const multiPageLogs = processingLog.filter(log => log.pages > 1)
      console.log(`[Download Labels] 📋 Multi-page labels breakdown (first 10):`)
      multiPageLogs.slice(0, 10).forEach(log => {
        console.log(`  - Row ${log.rowNum}: ${log.pages} pages (Tracking: ${log.tracking || 'N/A'})`)
      })
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
