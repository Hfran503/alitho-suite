import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db as prisma } from '@repo/database'
import { isCustomerRole } from '@/lib/roles'
import { generateGcuEnvelopePdf } from '@/lib/pdf-generator'

interface GeneratePdfRequest {
  orderId: string
  quantity: number
  position: 'center back flap' | 'front'
  address: string
  version: 'proof' | 'print'
}

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify customer role
    const userRole = (session.user as any).role
    if (!isCustomerRole(userRole)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if user has access to PDF generator feature
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        paceCustomerId: true,
        memberships: {
          include: { tenant: true },
        },
      },
    })

    if (!user || !user.memberships[0]) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const tenantId = user.memberships[0].tenantId

    // Check if GCU envelope order page is enabled and visible to this user
    const pdfGeneratorPage = await prisma.portalPageConfiguration.findFirst({
      where: {
        tenantId,
        pageKey: 'gcu-custom-envelope-new-order',
        isActive: true,
      },
    })

    if (!pdfGeneratorPage) {
      return NextResponse.json(
        { error: 'GCU Custom Envelope Orders feature is not enabled' },
        { status: 403 }
      )
    }

    // Check visibility permissions
    let hasAccess = false

    switch (pdfGeneratorPage.visibilityMode) {
      case 'all':
        hasAccess = true
        break
      case 'pace_ids':
        hasAccess =
          !!user.paceCustomerId &&
          pdfGeneratorPage.allowedPaceCustomerIds.includes(user.paceCustomerId)
        break
      case 'user_ids':
        hasAccess = pdfGeneratorPage.allowedUserIds.includes(user.id)
        break
      case 'user_emails':
        hasAccess = pdfGeneratorPage.allowedUserEmails.includes(user.email)
        break
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to the PDF Generator feature' },
        { status: 403 }
      )
    }

    // Parse request body
    const body: GeneratePdfRequest = await request.json()
    const { orderId, position, address, version } = body

    // Validate input
    if (!orderId || !position || !address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Generate PDF using shared utility function
    const pdfBuffer = await generateGcuEnvelopePdf(orderId, position, address, version)

    // Return PDF with appropriate headers
    // Convert Buffer to Uint8Array for Next.js compatibility
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Order_${orderId}_${version.toUpperCase()}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
