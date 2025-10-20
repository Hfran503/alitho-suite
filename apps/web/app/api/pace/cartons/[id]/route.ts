import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'

// PATCH /api/pace/cartons/[id] - Update carton
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

    const { id: cartonId } = await params
    const body = await req.json()

    const credentials = await getPaceApiCredentials()
    const paceApiUrl = credentials.url
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    // Update the carton
    const updateUrl = `${paceApiUrl}/UpdateObject/updateCarton`

    const cartonPayload: any = {
      id: parseInt(cartonId),
      ...body,
    }

    console.log('Updating carton:', { url: updateUrl, payload: cartonPayload })

    const response = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cartonPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PACE API error (update carton):', {
        status: response.status,
        statusText: response.statusText,
        response: errorText,
      })
      return NextResponse.json(
        { error: `Failed to update carton: ${errorText}` },
        { status: response.status }
      )
    }

    const updatedCarton = await response.json()
    console.log('Carton updated:', updatedCarton)

    return NextResponse.json({ success: true, data: updatedCarton })
  } catch (error) {
    console.error('Update carton error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/pace/cartons/[id] - Delete carton and refund label if applicable
export async function DELETE(
  _req: NextRequest,
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

    const { id: cartonId } = await params

    const credentials = await getPaceApiCredentials()
    const paceApiUrl = credentials.url
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    // Step 1: Read the carton first to get shipment ID and check for EasyPost label
    const readCartonUrl = `${paceApiUrl}/ReadObject/readCarton?primaryKey=${cartonId}`
    const cartonResponse = await fetch(readCartonUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: authHeader,
      },
      body: '',
    })

    let shipmentId = null
    let labelRefunded = false
    let refundError = null

    if (cartonResponse.ok) {
      const carton = await cartonResponse.json()
      shipmentId = carton.shipment

      // Step 2: Try to refund EasyPost label if shipment ID exists
      let easypostShipmentId = carton.u_easypost_shipment_id

      // If not in custom field, try to extract from note
      if (!easypostShipmentId && carton.note) {
        const match = carton.note.match(/EasyPost:\s*([a-zA-Z0-9_]+)/)
        if (match) {
          easypostShipmentId = match[1]
        }
      }

      if (easypostShipmentId) {
        try {
          const { getEasyPostClient } = await import('@/lib/easypost')
          const easypost = await getEasyPostClient(membership.tenantId)

          console.log(`Attempting to refund EasyPost label ${easypostShipmentId} for carton ${cartonId}`)

          const shipment = await easypost.Shipment.retrieve(easypostShipmentId)

          if (shipment.postage_label && shipment.postage_label.id) {
            const refund = await easypost.Shipment.refund(easypostShipmentId)
            labelRefunded = true
            console.log(`Successfully refunded label for carton ${cartonId}, status: ${refund.refund_status}`)
          }
        } catch (error: any) {
          console.error(`Failed to refund label for carton ${cartonId}:`, error)
          refundError = error.message
          // Continue with deletion even if refund fails
        }
      }
    }

    // Step 3: Delete the carton from PACE
    const deleteUrl = `${paceApiUrl}/DeleteObject/DeleteObject?${new URLSearchParams({
      type: 'Carton',
      key: cartonId,
    })}`

    console.log('Deleting carton:', { url: deleteUrl, cartonId })

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PACE API error (delete carton):', {
        status: response.status,
        statusText: response.statusText,
        response: errorText,
      })
      return NextResponse.json(
        { error: `Failed to delete carton: ${errorText}` },
        { status: response.status }
      )
    }

    console.log('Carton deleted successfully')

    // Step 4: Update shipment tracking if we have a shipment ID
    if (shipmentId) {
      try {
        await fetch(`${paceApiUrl.replace('/rpc/rest/services', '')}/api/pace/shipments/${shipmentId}/update-tracking`, {
          method: 'POST',
        })
        console.log('Updated shipment tracking after carton deletion')
      } catch (error) {
        console.error('Failed to update shipment tracking:', error)
        // Don't fail the deletion if tracking update fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Carton deleted',
      labelRefunded,
      refundError,
    })
  } catch (error) {
    console.error('Delete carton error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
