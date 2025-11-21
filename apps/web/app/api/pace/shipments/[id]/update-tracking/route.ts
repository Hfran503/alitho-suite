import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'
import { logPaceTransactionWithId, generatePaceTransactionId } from '@/lib/paceAudit'

/**
 * POST /api/pace/shipments/[id]/update-tracking
 * Update shipment with aggregated tracking info and total cost from all cartons
 */
export async function POST(
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

    // Get request body (may contain address to update)
    const body = await req.json().catch(() => ({}))
    const { address } = body

    // Get PACE credentials
    const credentials = await getPaceApiCredentials()
    const paceApiUrl = credentials.url
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    // Step 1: Find all cartons for this shipment
    const xpath = `@shipment=${shipmentId}`
    const queryParams = new URLSearchParams({
      type: 'Carton',
      xpath: xpath,
      offset: '0',
      limit: '1000',
    })

    const findCartonsUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${queryParams.toString()}`

    const findResponse = await fetch(findCartonsUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([]),
    })

    if (!findResponse.ok) {
      const errorText = await findResponse.text()
      console.error('PACE API error (find cartons):', errorText)
      return NextResponse.json(
        { error: 'Failed to find cartons', details: errorText },
        { status: findResponse.status }
      )
    }

    const cartonIds: string[] = await findResponse.json()

    if (!cartonIds || cartonIds.length === 0) {
      // No cartons, clear shipment data
      await fetch(`${paceApiUrl}/UpdateObject/updateJobShipment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          id: parseInt(shipmentId),
          trackingNumber: null,
          trackingLink: null,
          cost: null,
          u_tracking_notes: null,
        }),
      })

      return NextResponse.json({
        success: true,
        message: 'Cleared shipment tracking data',
      })
    }

    // Step 2: Fetch each carton's details
    const cartonPromises = cartonIds.map(async (cartonId) => {
      const readCartonUrl = `${paceApiUrl}/ReadObject/readCarton?primaryKey=${cartonId}`

      const cartonResponse = await fetch(readCartonUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: authHeader,
        },
        body: '',
      })

      if (!cartonResponse.ok) {
        console.error('Failed to read carton:', cartonId)
        return null
      }

      return await cartonResponse.json()
    })

    const cartons = (await Promise.all(cartonPromises)).filter((c) => c !== null)

    // Step 3: Aggregate data from cartons
    let totalCost = 0
    const trackingNumbers: string[] = []
    let primaryTrackingNumber = ''
    let primaryTrackingLink = ''

    cartons.forEach((carton, index) => {
      // Get cost from carton's cost field
      if (carton.cost) {
        totalCost += parseFloat(carton.cost)
      }

      // Collect tracking numbers
      if (carton.trackingNumber) {
        trackingNumbers.push(carton.trackingNumber)

        // Use first carton's tracking as primary
        if (index === 0) {
          primaryTrackingNumber = carton.trackingNumber
          primaryTrackingLink = carton.trackingLink || ''
        }
      }
    })

    // Step 3.5: Add return label costs from ShippingLabel table
    try {
      const returnLabels = await db.shippingLabel.findMany({
        where: {
          tenantId: membership.tenantId,
          paceShipmentId: parseInt(shipmentId),
          isReturnLabel: true,
          status: 'active', // Only count active return labels
        },
      })

      console.log(`Found ${returnLabels.length} return label(s) for shipment ${shipmentId}`)

      returnLabels.forEach((label: typeof returnLabels[number]) => {
        if (label.cost) {
          const labelCost = typeof label.cost === 'string'
            ? parseFloat(label.cost)
            : typeof label.cost === 'number'
            ? label.cost
            : parseFloat(label.cost.toString())
          totalCost += labelCost
          console.log(`Adding return label cost: $${labelCost.toFixed(2)}`)
        }
      })
    } catch (error) {
      console.error('Error fetching return label costs:', error)
      // Don't fail if we can't get return label costs
    }

    // Step 4: Fetch shipment data ONCE (for both type update and address update)
    // This combines 2 separate reads into 1
    let currentShipment: any = null
    if (primaryTrackingNumber || address) {
      try {
        const shipmentReadResponse = await fetch(
          `${paceApiUrl}/ReadObject/readJobShipment?primaryKey=${shipmentId}`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              Authorization: authHeader,
            },
            body: '',
          }
        )

        if (shipmentReadResponse.ok) {
          currentShipment = await shipmentReadResponse.json()
          console.log('Fetched shipment data for updates')
        }
      } catch (error) {
        console.error('Error fetching shipment:', error)
      }
    }

    // Step 5: Prepare shipment update data
    const shipmentUpdateData: any = {
      id: parseInt(shipmentId),
    }

    if (primaryTrackingNumber) {
      shipmentUpdateData.trackingNumber = primaryTrackingNumber
    }

    if (primaryTrackingLink) {
      shipmentUpdateData.trackingLink = primaryTrackingLink
    }

    if (totalCost > 0) {
      shipmentUpdateData.cost = totalCost
    }

    // Add all tracking numbers to notes
    if (trackingNumbers.length > 0) {
      const trackingNotes = trackingNumbers
        .map((tn, i) => `Box ${i + 1}: ${tn}`)
        .join('\n')
      shipmentUpdateData.u_tracking_notes = trackingNotes
    }

    // Mark shipment as shipped and update shipment type from planned → completed
    if (primaryTrackingNumber) {
      shipmentUpdateData.shipped = true
      console.log('✅ Marking shipment as shipped (labels created)')

      // Change shipment type from planned to completed using already-fetched data
      if (currentShipment?.shipmentType) {
        try {
          console.log(`🔍 Looking up shipment type mapping for tenantId=${membership.tenantId}, plannedTypeId=${currentShipment.shipmentType}`)

          const mapping = await db.shipmentTypeMapping.findFirst({
            where: {
              tenantId: membership.tenantId,
              plannedTypeId: currentShipment.shipmentType,
            },
          })

          if (mapping) {
            shipmentUpdateData.shipmentType = mapping.completedTypeId
            console.log(`✅ Changing shipment type: ${mapping.plannedTypeName} (${currentShipment.shipmentType}) → ${mapping.completedTypeName} (${mapping.completedTypeId})`)
          } else {
            console.warn(`⚠️ No shipment type mapping found for tenantId=${membership.tenantId}, plannedTypeId=${currentShipment.shipmentType}`)
            console.warn('⚠️ ShipmentType will NOT be updated. Please configure ShipmentTypeMapping in database.')
          }
        } catch (error) {
          console.error('❌ Error looking up shipment type mapping:', error)
        }
      } else {
        console.warn('⚠️ Current shipment has no shipmentType field, cannot update shipmentType')
      }
    }

    // Step 6: Update address if provided (runs in parallel with shipment update)
    // JobShipment address fields are bound from Contact, so we need to update the Contact record
    let contactUpdatePromise: Promise<void> | null = null
    if (address && currentShipment) {
      contactUpdatePromise = (async () => {
        try {
          const jobContactId = currentShipment.jobContact

          if (jobContactId) {
            console.log('Found jobContact ID:', jobContactId)

            // Read JobContact to get contact ID
            const jobContactResponse = await fetch(
              `${paceApiUrl}/ReadObject/readJobContact?primaryKey=${jobContactId}`,
              {
                method: 'POST',
                headers: {
                  Accept: 'application/json',
                  Authorization: authHeader,
                },
                body: '',
              }
            )

            if (jobContactResponse.ok) {
              const jobContactData = await jobContactResponse.json()
              const contactId = jobContactData.contact

              if (contactId) {
                console.log('Found contact ID:', contactId, '- Updating address...')

                // Update the Contact with corrected address
                const contactUpdateData: any = {
                  id: contactId,
                }

                if (address.street1) contactUpdateData.address1 = address.street1
                if (address.street2) contactUpdateData.address2 = address.street2
                if (address.city) contactUpdateData.city = address.city
                if (address.state) contactUpdateData.state = address.state
                if (address.zip) contactUpdateData.zip = address.zip

                const contactUpdateResponse = await fetch(
                  `${paceApiUrl}/UpdateObject/updateContact`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: authHeader,
                      Accept: 'application/json',
                    },
                    body: JSON.stringify(contactUpdateData),
                  }
                )

                if (contactUpdateResponse.ok) {
                  console.log('Successfully updated Contact address to match labels:', {
                    contactId,
                    address1: address.street1,
                    address2: address.street2,
                    city: address.city,
                    state: address.state,
                    zip: address.zip,
                  })
                } else {
                  const errorText = await contactUpdateResponse.text()
                  console.error('Failed to update Contact address:', errorText)
                }
              } else {
                console.warn('No contact ID found in JobContact')
              }
            } else {
              console.error('Failed to read JobContact')
            }
          } else {
            console.warn('No jobContact ID found in JobShipment')
          }
        } catch (error) {
          console.error('Error updating contact address:', error)
          // Don't fail the whole request if address update fails
        }
      })()
    }

    // Step 7: Update shipment and contact in parallel (if contact update exists)
    console.log('📤 Sending PACE API update with data:', JSON.stringify(shipmentUpdateData, null, 2))

    const shipmentUpdatePromise = fetch(`${paceApiUrl}/UpdateObject/updateJobShipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        Accept: 'application/json',
      },
      body: JSON.stringify(shipmentUpdateData),
    })

    // Wait for both updates to complete in parallel
    const [updateResponse] = await Promise.all([
      shipmentUpdatePromise,
      contactUpdatePromise || Promise.resolve(), // Only wait for contact if it exists
    ])

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text()
      console.error('❌ PACE API update failed:', errorText)
      console.error('❌ Status:', updateResponse.status, updateResponse.statusText)
      console.error('❌ Data sent:', JSON.stringify(shipmentUpdateData, null, 2))
      return NextResponse.json(
        { error: 'Failed to update shipment', details: errorText },
        { status: updateResponse.status }
      )
    }

    const updateResult = await updateResponse.json()
    console.log('✅ PACE API update successful!')
    console.log('✅ Update result:', JSON.stringify(updateResult, null, 2))
    console.log('✅ Updated shipment with aggregated tracking and cost:', {
      totalCost,
      primaryTracking: primaryTrackingNumber,
      totalBoxes: trackingNumbers.length,
      shipped: shipmentUpdateData.shipped,
      shipmentType: shipmentUpdateData.shipmentType,
    })

    // Audit log: shipment tracking updated via ShipStation flow
    const txnId = generatePaceTransactionId()
    await logPaceTransactionWithId(txnId, {
      action: 'pace.shipment.process',
      entityType: 'JobShipment',
      entityId: shipmentId,
      tenantId: membership.tenantId,
      metadata: {
        totalCost,
        primaryTrackingNumber,
        trackingNumbers,
        totalBoxes: cartons.length,
        shipped: shipmentUpdateData.shipped,
        shipmentTypeChanged: shipmentUpdateData.shipmentType ? true : false,
        newShipmentType: shipmentUpdateData.shipmentType,
        addressUpdated: address ? true : false,
      },
      success: true,
    })

    return NextResponse.json({
      success: true,
      data: {
        totalCost,
        primaryTrackingNumber,
        trackingNumbers,
        totalBoxes: cartons.length,
      },
    })
  } catch (error: any) {
    console.error('Update tracking error:', error)
    return NextResponse.json(
      { error: 'Failed to update tracking', message: error.message },
      { status: 500 }
    )
  }
}
