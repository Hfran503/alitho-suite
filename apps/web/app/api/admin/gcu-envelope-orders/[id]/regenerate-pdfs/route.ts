import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db as prisma } from '@repo/database'
import { isStaffRole } from '@/lib/roles'
import { generateGcuEnvelopePdf } from '@/lib/pdf-generator'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify staff role
    const userRole = (session.user as any).role
    if (!isStaffRole(userRole)) {
      return NextResponse.json({ error: 'Access denied. Staff role required.' }, { status: 403 })
    }

    // Get order ID from params
    const { id: orderId } = await params

    // Fetch the order from database
    const order = await prisma.gcuEnvelopeOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderId: true,
        quantity: true,
        position: true,
        address: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Generate both PDFs using shared utility
    const printPdf = await generateGcuEnvelopePdf(order.orderId, order.position, order.address, 'print')
    const proofPdf = await generateGcuEnvelopePdf(order.orderId, order.position, order.address, 'proof')

    // Ensure directory exists
    const uploadsDir = join(process.cwd(), 'public', 'gcu-envelope-pdfs')
    await mkdir(uploadsDir, { recursive: true })

    // Save PDFs to filesystem with same naming convention
    const printFilename = `${order.orderId} - ${order.quantity} - print.pdf`
    const proofFilename = `${order.orderId} - ${order.quantity} - proof.pdf`

    const printPath = join(uploadsDir, printFilename)
    const proofPath = join(uploadsDir, proofFilename)

    await writeFile(printPath, printPdf)
    await writeFile(proofPath, proofPdf)

    console.log(`✓ Regenerated PDFs for order ${order.id}:`)
    console.log(`  - Print: ${printPath} (${printPdf.length} bytes)`)
    console.log(`  - Proof: ${proofPath} (${proofPdf.length} bytes)`)

    // Update URLs in database
    const printPdfUrl = `/api/gcu-envelope-pdfs/${encodeURIComponent(printFilename)}`
    const proofPdfUrl = `/api/gcu-envelope-pdfs/${encodeURIComponent(proofFilename)}`

    await prisma.gcuEnvelopeOrder.update({
      where: { id: orderId },
      data: {
        printPdfUrl,
        proofPdfUrl,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'PDFs regenerated successfully',
      printPdfUrl,
      proofPdfUrl,
    })
  } catch (error) {
    console.error('Error regenerating PDFs:', error)
    return NextResponse.json(
      {
        error: 'Failed to regenerate PDFs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
