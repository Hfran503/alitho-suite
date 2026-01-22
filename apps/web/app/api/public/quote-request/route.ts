import { NextResponse } from 'next/server'
import { db } from '@repo/database'
import { enqueueEmail } from '@/lib/queue'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { firstName, lastName, email, phone, company, title, projectDetails, estimatedBudget, attachments } = body

    // Type for attachments
    interface Attachment {
      filename: string
      originalName: string
      url: string
      size: number
    }
    const typedAttachments: Attachment[] = attachments || []

    // Validate required fields
    if (!firstName || !lastName || !email || !projectDetails) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // For now, we'll use a default tenant (the first tenant)
    // In production, you might want to handle this differently based on subdomain, etc.
    const defaultTenant = await db.tenant.findFirst()

    if (!defaultTenant) {
      return NextResponse.json(
        { error: 'System configuration error' },
        { status: 500 }
      )
    }

    // Check if contact already exists by email
    let contact = await db.contact.findFirst({
      where: {
        email: email.toLowerCase(),
        tenantId: defaultTenant.id,
      },
    })

    // Create contact if doesn't exist
    if (!contact) {
      contact = await db.contact.create({
        data: {
          tenantId: defaultTenant.id,
          firstName,
          lastName,
          email: email.toLowerCase(),
          phone: phone || null,
          company: company || null,
          title: title || null,
          status: 'active',
        },
      })
    }

    // Generate opportunity number
    const year = new Date().getFullYear()
    const lastOpp = await db.opportunity.findFirst({
      where: {
        tenantId: defaultTenant.id,
        opportunityNumber: {
          startsWith: `OPP-${year}-`,
        },
      },
      orderBy: {
        opportunityNumber: 'desc',
      },
    })

    let nextNumber = 1
    if (lastOpp) {
      const lastNumber = parseInt(lastOpp.opportunityNumber.split('-')[2])
      nextNumber = lastNumber + 1
    }

    const opportunityNumber = `OPP-${year}-${nextNumber.toString().padStart(4, '0')}`

    // Create opportunity with attachments in metadata
    const opportunity = await db.opportunity.create({
      data: {
        tenantId: defaultTenant.id,
        opportunityNumber,
        contactId: contact.id,
        title: `Quote Request - ${company || `${firstName} ${lastName}`}`,
        description: projectDetails,
        amount: estimatedBudget ? parseFloat(estimatedBudget) : 0,
        stage: 'prospect',
        status: 'open',
        notes: `Submitted via public quote request form\nEstimated Budget: ${estimatedBudget || 'Not provided'}`,
        metadata: typedAttachments.length > 0 ? ({ attachments: typedAttachments } as any) : undefined,
      },
    })

    // Send email notifications
    try {
      // Fetch CRM settings to check if emails are enabled
      const crmSettings = await db.crmSettings.findUnique({
        where: { tenantId: defaultTenant.id }
      })

      const enableCustomerEmail = crmSettings?.enableCustomerEmail ?? true
      const enableInternalEmail = crmSettings?.enableInternalEmail ?? true
      const notificationEmail = crmSettings?.quoteRequestNotificationEmail

      // Send customer acknowledgment email
      if (enableCustomerEmail) {
        const customerEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #2563eb; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Quote Request Received</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin-top: 0;">Hi ${firstName},</p>
    <p>Thank you for your quote request! We've received your inquiry and our team will review it shortly.</p>
    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Request Number:</strong> ${opportunityNumber}</p>
      <p style="margin: 0;"><strong>Company:</strong> ${company || 'Not provided'}</p>
    </div>
    <p>We typically respond within 1-2 business days. If you have any urgent questions, please don't hesitate to contact us.</p>
    <p style="margin-bottom: 0;">Best regards,<br>The Team</p>
  </div>
  <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
    <p style="margin: 0;">This is an automated message. Please do not reply directly to this email.</p>
  </div>
</body>
</html>`

        await enqueueEmail({
          to: email.toLowerCase(),
          subject: `Quote Request Received - ${opportunityNumber}`,
          html: customerEmailHtml,
          tenantId: defaultTenant.id,
        })
      }

      // Send internal notification email (supports multiple comma-separated emails)
      const notificationEmails = notificationEmail
        ? notificationEmail.split(',').map((e: string) => e.trim()).filter(Boolean)
        : []

      if (enableInternalEmail && notificationEmails.length > 0) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://calithosuite.com'
        const opportunityUrl = `${baseUrl}/opportunities/${opportunity.id}`

        const internalEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #7c3aed; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">New Quote Request</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin-top: 0;">A new quote request has been submitted through the website.</p>

    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin: 0 0 15px 0; color: #374151;">Contact Information</h3>
      <p style="margin: 5px 0;"><strong>Name:</strong> ${firstName} ${lastName}</p>
      <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
      <p style="margin: 5px 0;"><strong>Phone:</strong> ${phone || 'Not provided'}</p>
      <p style="margin: 5px 0;"><strong>Company:</strong> ${company || 'Not provided'}</p>
      <p style="margin: 5px 0;"><strong>Title:</strong> ${title || 'Not provided'}</p>
    </div>

    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <h3 style="margin: 0 0 10px 0; color: #92400e;">Request Details</h3>
      <p style="margin: 5px 0;"><strong>Request Number:</strong> ${opportunityNumber}</p>
      <p style="margin: 5px 0;"><strong>Estimated Budget:</strong> ${estimatedBudget || 'Not provided'}</p>
      <p style="margin: 10px 0 0 0; white-space: pre-wrap;">${projectDetails}</p>
    </div>

    ${typedAttachments.length > 0 ? `
    <div style="background: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
      <h3 style="margin: 0 0 15px 0; color: #0369a1;">Attachments (${typedAttachments.length})</h3>
      ${typedAttachments.map((att: Attachment) => `
        <div style="margin: 8px 0; padding: 10px 12px; background: #ffffff; border-radius: 6px; display: flex; align-items: center;">
          <a href="${baseUrl}${att.url}" style="color: #0369a1; text-decoration: none; font-weight: 500; display: flex; align-items: center; gap: 8px;" target="_blank">
            <span style="display: inline-block; width: 20px; height: 20px; background: #0284c7; border-radius: 4px; text-align: center; line-height: 20px; color: white; font-size: 12px;">&#8595;</span>
            ${att.originalName}
          </a>
        </div>
      `).join('')}
      <p style="margin: 15px 0 0 0; font-size: 12px; color: #0369a1;">Click any file above to download directly</p>
    </div>
    ` : ''}

    <div style="text-align: center; margin-top: 25px;">
      <a href="${opportunityUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600;">View in CRM</a>
    </div>
  </div>
  <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
    <p style="margin: 0;">This is an automated notification from Calitho Suite.</p>
  </div>
</body>
</html>`

        await enqueueEmail({
          to: notificationEmails,
          subject: `New Quote Request: ${company || `${firstName} ${lastName}`} - ${opportunityNumber}`,
          html: internalEmailHtml,
          tenantId: defaultTenant.id,
        })
      }
    } catch (emailError) {
      // Log email error but don't fail the request
      console.error('Failed to send quote request notification emails:', emailError)
    }

    return NextResponse.json({
      success: true,
      message: 'Quote request submitted successfully',
      data: {
        opportunityId: opportunity.id,
        opportunityNumber: opportunity.opportunityNumber,
      },
    })
  } catch (error) {
    console.error('Error creating quote request:', error)
    return NextResponse.json(
      { error: 'Failed to submit quote request' },
      { status: 500 }
    )
  }
}
