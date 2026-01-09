import { NextResponse } from 'next/server'
import { db } from '@repo/database'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { firstName, lastName, email, phone, company, title, projectDetails, estimatedBudget } = body

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

    // Create opportunity
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
      },
    })

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
