import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'
import { generatePaceTransactionId, logPaceTransactionWithId } from '@/lib/paceAudit'

// POST /api/pace/shipments/[id]/process-skids - Create skids with cartons and content for a shipment
// Supports two modes:
// - 'skid' mode (default): Creates skids with cartons inside them
// - 'carton' mode: Creates cartons directly without skids
export async function POST(
  req: NextRequest,
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

    // Parse request body
    const body = await req.json()
    const { mode = 'skid', skids, cartons, shipmentDetails, deleteExisting } = body

    // Validate based on mode
    if (mode === 'skid') {
      // Allow empty skids array when deleting existing configuration (editing mode)
      if (!skids || !Array.isArray(skids)) {
        return NextResponse.json(
          { error: 'Skids data must be an array' },
          { status: 400 }
        )
      }

      if (skids.length === 0 && !deleteExisting) {
        return NextResponse.json(
          { error: 'Skids data is required when creating new configuration' },
          { status: 400 }
        )
      }
    } else if (mode === 'carton') {
      // Allow empty cartons array when deleting existing configuration
      if (!cartons || !Array.isArray(cartons)) {
        return NextResponse.json(
          { error: 'Cartons data must be an array' },
          { status: 400 }
        )
      }

      if (cartons.length === 0 && !deleteExisting) {
        return NextResponse.json(
          { error: 'Cartons data is required when creating new configuration' },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "skid" or "carton"' },
        { status: 400 }
      )
    }

    // Get PACE API credentials
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

    // Generate transaction ID for PACE audit cross-referencing
    const txnId = generatePaceTransactionId()

    // If deleteExisting is true, delete all existing cartons and skids for this shipment first
    if (deleteExisting) {
      console.log('Deleting existing cartons and skids for shipment:', shipmentId)

      // Find all cartons for this shipment
      const findCartonsUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${new URLSearchParams({
        type: 'Carton',
        xpath: `@shipment=${shipmentId}`,
        offset: '0',
        limit: '1000',
      })}`

      const findResponse = await fetch(findCartonsUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([]),
      })

      if (findResponse.ok) {
        const cartonIds: string[] = await findResponse.json()
        console.log(`Found ${cartonIds.length} existing cartons to delete`)

        // Delete each carton (this will also delete associated contents)
        for (const cartonId of cartonIds) {
          const deleteUrl = `${paceApiUrl}/DeleteObject/DeleteObject?${new URLSearchParams({
            type: 'Carton',
            key: cartonId,
          })}`

          try {
            await fetch(deleteUrl, {
              method: 'DELETE',
              headers: {
                'Accept': 'application/json',
                'Authorization': authHeader,
              },
            })
            console.log(`Deleted carton ${cartonId}`)
          } catch (err) {
            console.error(`Failed to delete carton ${cartonId}:`, err)
          }
        }
      }

      // Find all skids for this shipment
      const findSkidsUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${new URLSearchParams({
        type: 'Skid',
        xpath: `@jobShipment=${shipmentId}`,
        offset: '0',
        limit: '1000',
      })}`

      const findSkidsResponse = await fetch(findSkidsUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([]),
      })

      if (findSkidsResponse.ok) {
        const skidIds: string[] = await findSkidsResponse.json()
        console.log(`Found ${skidIds.length} existing skids to delete`)

        // Delete each skid
        for (const skidId of skidIds) {
          const deleteUrl = `${paceApiUrl}/DeleteObject/DeleteObject?${new URLSearchParams({
            type: 'Skid',
            key: skidId,
          })}`

          try {
            await fetch(deleteUrl, {
              method: 'DELETE',
              headers: {
                'Accept': 'application/json',
                'Authorization': authHeader,
              },
            })
            console.log(`Deleted skid ${skidId}`)
          } catch (err) {
            console.error(`Failed to delete skid ${skidId}:`, err)
          }
        }
      }
    }

    // Helper function to create carton content
    const createCartonContents = async (cartonId: number, contents: any[]) => {
      const createdContents = []

      for (const contentData of contents) {
        const contentPayload: any = {
          carton: cartonId,
          quantity: contentData.quantity,
        }

        // Add optional fields
        // IMPORTANT: For JobPart references, use jobPartJob field (not job field)
        if (contentData.jobPartJob && contentData.jobPart) {
          contentPayload.jobPartJob = contentData.jobPartJob
          contentPayload.jobPart = contentData.jobPart
        } else if (contentData.job) {
          contentPayload.job = contentData.job
        } else if (contentData.jobPart) {
          contentPayload.jobPart = contentData.jobPart
        }

        if (contentData.jobComponent) {
          contentPayload.jobComponent = contentData.jobComponent
        }
        if (contentData.jobProduct) {
          contentPayload.jobProduct = contentData.jobProduct
        }
        if (contentData.jobMaterial) {
          contentPayload.jobMaterial = contentData.jobMaterial
        }
        if (contentData.description) {
          contentPayload.contentDescription = contentData.description
        }

        // Validate that at least one item reference is present
        const hasItemReference = contentPayload.job || contentPayload.jobPartJob || contentPayload.jobMaterial ||
                                 contentPayload.jobComponent || contentPayload.jobProduct || contentPayload.jobPart

        if (!hasItemReference) {
          console.error('CartonContent validation failed - no item reference:', contentData)
          throw new Error('Carton content must have at least one item reference (job, component, product, part, or material)')
        }

        console.log('Creating carton content with payload:', contentPayload)

        const createContentUrl = `${paceApiUrl}/CreateObject/createCartonContent`

        const contentResponse = await fetch(createContentUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(contentPayload),
        })

        if (!contentResponse.ok) {
          const errorText = await contentResponse.text()
          console.error('PACE API error (create content):', {
            status: contentResponse.status,
            statusText: contentResponse.statusText,
            response: errorText,
          })
          throw new Error(`Failed to create carton content: ${errorText}`)
        }

        const createdContent = await contentResponse.json()
        console.log('Content created:', createdContent)
        createdContents.push(createdContent)
      }

      return createdContents
    }

    let result: any = { data: [], message: '' }

    // ============ CARTON MODE - Create cartons directly without skids ============
    if (mode === 'carton') {
      const createdCartons = []

      for (const cartonData of cartons) {
        // Create carton in PACE (no skid reference)
        const createCartonUrl = `${paceApiUrl}/CreateObject/createCarton`

        const cartonPayload: any = {
          shipment: parseInt(shipmentId),
          count: cartonData.count || 1,
          quantity: cartonData.contents.reduce((sum: number, content: any) => sum + (content.quantity || 0), 0),
          addDefaultContent: false,
        }

        // Add note if provided
        if (cartonData.note) {
          cartonPayload.note = cartonData.note
        }

        console.log('Creating carton (carton mode):', { url: createCartonUrl, payload: cartonPayload })

        const cartonResponse = await fetch(createCartonUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cartonPayload),
        })

        if (!cartonResponse.ok) {
          const errorText = await cartonResponse.text()
          console.error('PACE API error (create carton):', {
            status: cartonResponse.status,
            statusText: cartonResponse.statusText,
            response: errorText,
          })
          throw new Error(`Failed to create carton: ${errorText}`)
        }

        const createdCarton = await cartonResponse.json()
        console.log('Carton created:', createdCarton)

        // Create contents for this carton
        const createdContents = await createCartonContents(createdCarton.id, cartonData.contents)

        createdCartons.push({
          carton: createdCarton,
          contents: createdContents,
        })
      }

      result = {
        data: createdCartons,
        message: createdCartons.length === 0 && deleteExisting
          ? 'Successfully cleared all cartons from shipment'
          : `Successfully created ${createdCartons.length} carton(s)`,
      }
    }

    // ============ SKID MODE - Create skids with cartons inside ============
    if (mode === 'skid') {
      const createdSkids = []

      for (const skidData of skids) {
        // Create skid in PACE
        const createSkidUrl = `${paceApiUrl}/CreateObject/createSkid`

        const skidPayload = {
          jobShipment: parseInt(shipmentId),
          count: skidData.count || 1,
          description: skidData.description || '',
          weight: skidData.weight || 0,
        }

        console.log('Creating skid:', { url: createSkidUrl, payload: skidPayload })

        const skidResponse = await fetch(createSkidUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(skidPayload),
        })

        if (!skidResponse.ok) {
          const errorText = await skidResponse.text()
          console.error('PACE API error (create skid):', {
            status: skidResponse.status,
            statusText: skidResponse.statusText,
            response: errorText,
          })
          throw new Error(`Failed to create skid: ${errorText}`)
        }

        const createdSkid = await skidResponse.json()
        console.log('Skid created:', createdSkid)

        const createdCartons = []

        // Process each carton within this skid
        for (const cartonData of skidData.cartons || []) {
          // Create carton in PACE linked to the skid
          const createCartonUrl = `${paceApiUrl}/CreateObject/createCarton`

          const cartonPayload: any = {
            shipment: parseInt(shipmentId),
            skid: createdSkid.id,  // Link carton to skid
            count: cartonData.count || 1,
            quantity: cartonData.contents.reduce((sum: number, content: any) => sum + (content.quantity || 0), 0),
            addDefaultContent: false,
          }

          // Add note if provided
          if (cartonData.note) {
            cartonPayload.note = cartonData.note
          }

          console.log('Creating carton for skid:', { url: createCartonUrl, payload: cartonPayload })

          const cartonResponse = await fetch(createCartonUrl, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(cartonPayload),
          })

          if (!cartonResponse.ok) {
            const errorText = await cartonResponse.text()
            console.error('PACE API error (create carton):', {
              status: cartonResponse.status,
              statusText: cartonResponse.statusText,
              response: errorText,
            })
            throw new Error(`Failed to create carton: ${errorText}`)
          }

          const createdCarton = await cartonResponse.json()
          console.log('Carton created:', createdCarton)

          // Create contents for this carton using helper function
          const createdContents = await createCartonContents(createdCarton.id, cartonData.contents)

          createdCartons.push({
            carton: createdCarton,
            contents: createdContents,
          })
        }

        createdSkids.push({
          skid: createdSkid,
          cartons: createdCartons,
        })
      }

      result = {
        data: createdSkids,
        message: createdSkids.length === 0 && deleteExisting
          ? 'Successfully cleared all cartons and skids from shipment'
          : `Successfully created ${createdSkids.length} skid(s) with cartons`,
      }
    }

    // Update shipment with optional details if provided
    // When editing (deleteExisting is true), always update to allow clearing fields
    const hasAnyDetails = shipmentDetails && (
      shipmentDetails.notes !== undefined ||
      shipmentDetails.trackingNumber !== undefined ||
      shipmentDetails.trackingNotes !== undefined ||
      shipmentDetails.cost !== undefined
    )

    if (hasAnyDetails || deleteExisting) {
      const updateShipmentUrl = `${paceApiUrl}/UpdateObject/updateJobShipment`

      const shipmentUpdatePayload: any = {
        id: parseInt(shipmentId),
      }

      // When editing (deleteExisting), include all fields to allow clearing them
      // Use empty string or 0 to clear fields in PACE
      if (deleteExisting) {
        shipmentUpdatePayload.notes = shipmentDetails?.notes || ''
        shipmentUpdatePayload.trackingNumber = shipmentDetails?.trackingNumber || ''
        shipmentUpdatePayload.trackingNotes = shipmentDetails?.trackingNotes || ''
        shipmentUpdatePayload.cost = shipmentDetails?.cost !== undefined && shipmentDetails?.cost !== ''
          ? parseFloat(shipmentDetails.cost)
          : 0
      } else {
        // For new creation, only include non-empty fields
        if (shipmentDetails?.notes) {
          shipmentUpdatePayload.notes = shipmentDetails.notes
        }
        if (shipmentDetails?.trackingNumber) {
          shipmentUpdatePayload.trackingNumber = shipmentDetails.trackingNumber
        }
        if (shipmentDetails?.trackingNotes) {
          shipmentUpdatePayload.trackingNotes = shipmentDetails.trackingNotes
        }
        if (shipmentDetails?.cost !== undefined && shipmentDetails?.cost !== '') {
          shipmentUpdatePayload.cost = parseFloat(shipmentDetails.cost)
        }
      }

      console.log('Updating shipment with optional details:', { url: updateShipmentUrl, payload: shipmentUpdatePayload })

      const updateResponse = await fetch(updateShipmentUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shipmentUpdatePayload),
      })

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text()
        console.error('PACE API error (update shipment):', {
          status: updateResponse.status,
          statusText: updateResponse.statusText,
          response: errorText,
        })
        // Don't throw error - skids were created successfully, just log the warning
        console.warn('Failed to update shipment details, but skids were created successfully')
      } else {
        const updatedShipment = await updateResponse.json()
        console.log('Shipment updated:', updatedShipment)
      }
    }

    // Log the PACE transaction for audit trail
    await logPaceTransactionWithId(txnId, {
      action: mode === 'skid' ? 'pace.shipment.process_skids' : 'pace.shipment.process_cartons',
      entityType: 'JobShipment',
      entityId: shipmentId,
      tenantId: membership.tenantId,
      metadata: {
        mode,
        skidsCount: skids?.length || 0,
        cartonsCount: cartons?.length || 0,
        deleteExisting,
        shipmentDetails: shipmentDetails ? true : false,
      },
      success: true,
      paceResponse: result.data,
    })

    return NextResponse.json({
      success: true,
      data: result.data,
      message: result.message,
    })
  } catch (error) {
    console.error('Process skids error:', error)

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
