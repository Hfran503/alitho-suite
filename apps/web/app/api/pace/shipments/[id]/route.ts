import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import type { JobShipment } from '@repo/types'
import { getPaceApiCredentials } from '@/lib/secrets'

// GET /api/pace/shipments/[id] - Get a single job shipment by primary key
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    // Await params before accessing properties
    const { id: shipmentId } = await params

    if (!shipmentId) {
      return NextResponse.json(
        { error: 'Shipment ID is required' },
        { status: 400 }
      )
    }

    // Get PACE API credentials from AWS Secrets Manager or environment
    let paceApiUrl: string
    let paceUsername: string
    let pacePassword: string

    try {
      const credentials = await getPaceApiCredentials()
      paceApiUrl = credentials.url
      paceUsername = credentials.username
      pacePassword = credentials.password
    } catch (error) {
      console.error('Failed to get PACE API credentials:', error)
      return NextResponse.json(
        {
          error: 'PACE API not configured',
          message: error instanceof Error ? error.message : 'Failed to get PACE API credentials'
        },
        { status: 500 }
      )
    }

    // Prepare Basic Auth header
    const authHeader = `Basic ${Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')}`

    // Call PACE API to get shipment details
    // Expand shipBillToContact to get the full Contact object with zip code
    let paceUrl = `${paceApiUrl}/ReadObject/readJobShipment?primaryKey=${shipmentId}&expand=shipBillToContact`

    console.log('Fetching shipment from PACE:', {
      url: paceUrl,
      shipmentId,
    })

    let response = await fetch(paceUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
      body: '',
    })

    // If we get a 500 error with ClassCastException, retry without expand parameter
    // This can happen if PACE has data type issues with certain fields
    let cachedErrorText: string | null = null
    if (!response.ok && response.status === 500) {
      cachedErrorText = await response.text()
      if (cachedErrorText.includes('ClassCastException') || cachedErrorText.includes('cannot be cast')) {
        console.warn('PACE API ClassCastException with expand parameter, retrying without expand...')

        // Retry without expand
        paceUrl = `${paceApiUrl}/ReadObject/readJobShipment?primaryKey=${shipmentId}`
        response = await fetch(paceUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
          },
          body: '',
        })
        // Clear cached error text since we have a new response
        cachedErrorText = null
      }
    }

    if (!response.ok) {
      const errorText = cachedErrorText || await response.text()
      console.error('PACE API error:', {
        status: response.status,
        statusText: response.statusText,
        url: paceUrl,
        response: errorText,
      })

      // Try to parse error message
      let errorMessage = `Failed to fetch shipment from PACE API (${response.status} ${response.statusText})`
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message === 'System License Expired') {
          errorMessage = 'PACE System License Expired. Please contact your PACE administrator to renew the license.'
        }
      } catch (e) {
        // Error text is not JSON, use default message
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details: errorText,
          status: response.status,
        },
        { status: response.status }
      )
    }

    const shipment: JobShipment = await response.json()

    // Fetch shipment settings to check if PO validation is enforced
    const shipmentSettings = await db.shipmentSettings.findUnique({
      where: { tenantId: membership.tenantId },
    })
    ;(shipment as any).enforcePoValidation = shipmentSettings?.enforcePoValidation ?? true

    // Fetch customer PO requirement and job PO numbers if job exists
    if (shipment.job) {
      try {
        // Fetch Job details to get customer and poNum
        const jobUrl = `${paceApiUrl}/ReadObject/readJob?primaryKey=${encodeURIComponent(shipment.job)}`
        const jobResponse = await fetch(jobUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
          },
          body: '',
        })

        if (jobResponse.ok) {
          const jobData = await jobResponse.json()
          ;(shipment as any).jobPoNum = jobData.poNum || null

          // Fetch customer's enterInvoicePORequired setting
          if (jobData.customer) {
            const customerUrl = `${paceApiUrl}/ReadObject/readCustomer?primaryKey=${encodeURIComponent(jobData.customer)}`
            const customerResponse = await fetch(customerUrl, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Authorization': authHeader,
              },
              body: '',
            })

            if (customerResponse.ok) {
              const customerData = await customerResponse.json()
              ;(shipment as any).customerPORequired = customerData.enterInvoicePORequired || null
            }
          }

          // Fetch Proposal PO if proposal number exists
          if (jobData.u_proposal_number) {
            const proposalUrl = `${paceApiUrl}/ReadObject/readUDO_proposal?primaryKey=${encodeURIComponent(jobData.u_proposal_number)}`
            const proposalResponse = await fetch(proposalUrl, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Authorization': authHeader,
              },
              body: '',
            })

            if (proposalResponse.ok) {
              const proposalData = await proposalResponse.json()
              ;(shipment as any).proposalPO = proposalData.po || null
            }
          }
        }
      } catch (err) {
        console.error('Error fetching job PO data:', err)
        // Continue without PO data if fetch fails
      }
    }

    // Normalize the date/time field and fix timezone issue
    const rawDate = shipment.dateTime ?? (shipment as any).date ?? (shipment as any).shipDate

    if (rawDate) {
      // PACE returns dates in UTC format but WITHOUT the 'Z' suffix
      // e.g., "2025-10-22T01:05:00" is actually UTC, which displays as Oct 21 in PT
      const dateStr = String(rawDate)
      if (dateStr && !dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.match(/-\d{2}:\d{2}$/)) {
        // No timezone info - treat as UTC by adding 'Z'
        const dateTimeStr = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`
        shipment.dateTime = dateTimeStr + 'Z'
      } else {
        shipment.dateTime = rawDate
      }
    }

    // If shipBillToContact is a number (Contact ID), fetch the Contact details
    if (shipment.shipBillToContact && typeof shipment.shipBillToContact === 'number') {
      try {
        const contactUrl = `${paceApiUrl}/ReadObject/readContact?primaryKey=${shipment.shipBillToContact}`
        console.log('Fetching shipBillToContact from PACE:', {
          url: contactUrl,
          contactId: shipment.shipBillToContact,
        })

        const contactResponse = await fetch(contactUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
          },
          body: '',
        })

        if (contactResponse.ok) {
          const contact = await contactResponse.json()
          console.log('Fetched contact:', contact)

          // If contact.country is a number (Country ID), fetch the Country details to get isoCountry
          if (contact.country && typeof contact.country === 'number') {
            try {
              const countryUrl = `${paceApiUrl}/ReadObject/readCountry?primaryKey=${contact.country}`
              console.log('Fetching country from PACE:', {
                url: countryUrl,
                countryId: contact.country,
              })

              const countryResponse = await fetch(countryUrl, {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Authorization': authHeader,
                },
                body: '',
              })

              if (countryResponse.ok) {
                const countryData = await countryResponse.json()
                console.log('Fetched country:', countryData)
                // Add the ISO country code to the contact object
                contact.countryCode = countryData.isoCountry || countryData.iso || 'US'
              } else {
                console.error('Failed to fetch country:', countryResponse.status, countryResponse.statusText)
                contact.countryCode = 'US' // Default to US if fetch fails
              }
            } catch (err) {
              console.error('Error fetching country:', err)
              contact.countryCode = 'US' // Default to US if error
            }
          }

          // Replace the ID with the full Contact object
          shipment.shipBillToContact = contact as any
        } else {
          console.error('Failed to fetch contact:', contactResponse.status, contactResponse.statusText)
        }
      } catch (err) {
        console.error('Error fetching shipBillToContact:', err)
        // Keep the contact ID if fetching fails
      }
    }

    return NextResponse.json({
      success: true,
      data: shipment,
    })
  } catch (error) {
    console.error('Get job shipment error:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/pace/shipments/[id] - Update shipment address
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const { id: shipmentId } = await params
    const body = await req.json()
    const { address } = body

    if (!address) {
      return NextResponse.json({ error: 'Address data is required' }, { status: 400 })
    }

    const credentials = await getPaceApiCredentials()
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    // Update the shipment in PACE
    const updateData: any = {}
    if (address.city) updateData.shipCity = address.city
    if (address.state) updateData.shipState = address.state
    if (address.zip) updateData.shipZip = address.zip
    if (address.street1) updateData.shipStreet = address.street1
    if (address.street2) updateData.shipStreet2 = address.street2

    const paceUrl = `${credentials.url}/UpdateObject/updateJobShipment`
    const response = await fetch(paceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        id: parseInt(shipmentId),
        ...updateData,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PACE update shipment error:', errorText)
      return NextResponse.json(
        { error: 'Failed to update shipment in PACE', details: errorText },
        { status: response.status }
      )
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('Update shipment error:', error)
    return NextResponse.json(
      { error: 'Failed to update shipment', message: error.message },
      { status: 500 }
    )
  }
}
