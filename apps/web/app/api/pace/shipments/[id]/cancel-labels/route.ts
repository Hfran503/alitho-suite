import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getPaceApiCredentials } from '@/lib/secrets'
import { getEasyPostClient } from '@/lib/easypost'

/**
 * POST /api/pace/shipments/[id]/cancel-labels
 * Cancel all EasyPost labels and delete all cartons, contents, and shipment tracking/cost data
 */
export async function POST(
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

    const { id: shipmentId } = await params

    // Get PACE credentials
    const credentials = await getPaceApiCredentials()
    const paceApiUrl = credentials.url
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    // Step 1: Find all cartons for this shipment using xpath query
    const xpath = `@shipment=${shipmentId}`
    const queryParams = new URLSearchParams({
      type: 'Carton',
      xpath: xpath,
      offset: '0',
      limit: '1000',
    })

    const findCartonsUrl = `${paceApiUrl}/FindObjects/findSortAndLimit?${queryParams.toString()}`

    console.log('Finding cartons for shipment:', shipmentId)

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
      return NextResponse.json({
        success: true,
        message: 'No cartons found to cancel',
        data: {
          cartonsProcessed: 0,
          deletedCartons: 0,
          failedDeletions: 0,
          canceledLabels: 0,
          failedCancellations: 0,
          details: {
            deletedCartons: [],
            failedDeletions: [],
            canceledLabels: [],
            failedCancellations: [],
          },
        },
      })
    }

    console.log(`Found ${cartonIds.length} carton IDs to process`)

    // Step 2: Fetch each carton's details to get tracking info
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

    console.log(`Loaded ${cartons.length} cartons with details`)

    // Step 3: Cancel EasyPost and ShipStation labels
    let easypost = null
    let shipstationClient = null
    const canceledLabels = []
    const failedCancellations = []

    try {
      // Check if EasyPost integration is configured
      const easypostIntegration = await db.integration.findUnique({
        where: {
          tenantId_provider: {
            tenantId: membership.tenantId,
            provider: 'easypost',
          },
        },
      })

      if (easypostIntegration?.enabled) {
        easypost = await getEasyPostClient(membership.tenantId)
      }
    } catch (error) {
      console.log('EasyPost not configured, skipping EasyPost label cancellation:', error)
    }

    try {
      // Check if ShipStation integration is configured
      const { getShipStationClient } = await import('@/lib/shipstation')
      const shipstationIntegration = await db.integration.findUnique({
        where: {
          tenantId_provider: {
            tenantId: membership.tenantId,
            provider: 'shipstation',
          },
        },
      })

      if (shipstationIntegration?.enabled) {
        shipstationClient = await getShipStationClient(membership.tenantId)
      }
    } catch (error) {
      console.log('ShipStation not configured, skipping ShipStation label cancellation:', error)
    }

    if (easypost) {
      for (const carton of cartons) {
        // Try to get EasyPost shipment ID from custom field or note
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
            console.log(`Attempting to refund EasyPost shipment ${easypostShipmentId} for carton ${carton.id}`)

            // Retrieve the shipment to get the PostageLabel ID
            const shipment = await easypost.Shipment.retrieve(easypostShipmentId)

            if (shipment.postage_label && shipment.postage_label.id) {
              // Refund the label
              const refund = await easypost.Shipment.refund(easypostShipmentId)

              canceledLabels.push({
                cartonId: carton.id,
                trackingNumber: carton.trackingNumber,
                easypostShipmentId: easypostShipmentId,
                refundStatus: refund.refund_status,
              })

              // Update ShippingLabel status in database
              try {
                await db.shippingLabel.updateMany({
                  where: {
                    tenantId: membership.tenantId,
                    paceCartonId: parseInt(carton.id),
                    status: 'active',
                  },
                  data: {
                    status: 'refunded',
                  },
                })
              } catch (dbError) {
                console.error(`Failed to update label status in database for carton ${carton.id}:`, dbError)
              }

              console.log(`Successfully refunded label for carton ${carton.id}, status: ${refund.refund_status}`)
            } else {
              console.log(`No postage label found for shipment ${easypostShipmentId}`)
              failedCancellations.push({
                cartonId: carton.id,
                trackingNumber: carton.trackingNumber,
                reason: 'No postage label found for this shipment',
              })
            }
          } catch (error: any) {
            console.error(`Failed to refund label for carton ${carton.id}:`, error)
            failedCancellations.push({
              cartonId: carton.id,
              trackingNumber: carton.trackingNumber,
              easypostShipmentId: easypostShipmentId,
              reason: error.message,
            })
          }
        } else if (carton.trackingNumber) {
          console.log(`No EasyPost shipment ID found for carton ${carton.id}`)
          failedCancellations.push({
            cartonId: carton.id,
            trackingNumber: carton.trackingNumber,
            reason: 'EasyPost shipment ID not stored - cannot refund',
          })
        }
      }
    }

    // Process ShipStation labels (both carton labels and return labels)
    if (shipstationClient) {
      // First, get all ShipStation labels for this shipment (including return labels without cartonId)
      const allShipmentLabels = await db.shippingLabel.findMany({
        where: {
          tenantId: membership.tenantId,
          paceShipmentId: parseInt(shipmentId),
          provider: 'shipstation',
          status: 'active',
        },
      })

      console.log(`Found ${allShipmentLabels.length} ShipStation labels to void for shipment ${shipmentId}`)

      // Void all labels (both outbound and return)
      for (const label of allShipmentLabels) {
        if (label.providerLabelId) {
          try {
            console.log(`Attempting to void ShipStation label ${label.providerLabelId}${label.isReturnLabel ? ' (RETURN LABEL)' : ''}`)

            // Void the label
            const voidResponse = await shipstationClient.voidLabel(label.providerLabelId)

            canceledLabels.push({
              cartonId: label.paceCartonId || 'N/A (Return Label)',
              trackingNumber: label.trackingNumber,
              shipstationLabelId: label.providerLabelId,
              voidStatus: voidResponse.approved ? 'approved' : 'rejected',
              isReturnLabel: label.isReturnLabel,
            })

            // Update ShippingLabel status in database
            await db.shippingLabel.update({
              where: {
                id: label.id,
              },
              data: {
                status: 'voided',
              },
            })

            console.log(`Successfully voided label ${label.providerLabelId}, approved: ${voidResponse.approved}`)
          } catch (error: any) {
            console.error(`Failed to void label ${label.providerLabelId}:`, error)
            failedCancellations.push({
              cartonId: label.paceCartonId || 'N/A (Return Label)',
              trackingNumber: label.trackingNumber,
              shipstationLabelId: label.providerLabelId,
              reason: error.message,
              isReturnLabel: label.isReturnLabel,
            })
          }
        }
      }

      // Also handle legacy carton labels that might not be in our database
      for (const carton of cartons) {
        // Check if we already processed this carton's label
        const alreadyProcessed = allShipmentLabels.some(
          label => label.paceCartonId === parseInt(carton.id)
        )

        if (alreadyProcessed) {
          continue
        }

        // Try to get ShipStation label ID from our ShippingLabel table
        let shipstationLabelId = null

        try {
          const shippingLabel = await db.shippingLabel.findFirst({
            where: {
              tenantId: membership.tenantId,
              paceCartonId: parseInt(carton.id),
              provider: 'shipstation',
              status: 'active',
            },
            select: {
              providerLabelId: true,
            },
          })

          if (shippingLabel?.providerLabelId) {
            shipstationLabelId = shippingLabel.providerLabelId
          }
        } catch (error) {
          console.error(`Error looking up label for carton ${carton.id}:`, error)
        }

        if (shipstationLabelId) {
          try {
            console.log(`Attempting to void ShipStation label ${shipstationLabelId} for carton ${carton.id}`)

            // Void the label
            const voidResponse = await shipstationClient.voidLabel(shipstationLabelId)

            canceledLabels.push({
              cartonId: carton.id,
              trackingNumber: carton.trackingNumber,
              shipstationLabelId: shipstationLabelId,
              voidStatus: voidResponse.approved ? 'approved' : 'rejected',
            })

            // Update ShippingLabel status in database
            try {
              await db.shippingLabel.updateMany({
                where: {
                  tenantId: membership.tenantId,
                  paceCartonId: parseInt(carton.id),
                  status: 'active',
                },
                data: {
                  status: 'voided',
                },
              })
            } catch (dbError) {
              console.error(`Failed to update label status in database for carton ${carton.id}:`, dbError)
            }

            console.log(`Successfully voided label for carton ${carton.id}, approved: ${voidResponse.approved}`)
          } catch (error: any) {
            console.error(`Failed to void label for carton ${carton.id}:`, error)
            failedCancellations.push({
              cartonId: carton.id,
              trackingNumber: carton.trackingNumber,
              shipstationLabelId: shipstationLabelId,
              reason: error.message,
            })
          }
        } else if (carton.trackingNumber) {
          console.log(`No ShipStation label ID found for carton ${carton.id}`)
          failedCancellations.push({
            cartonId: carton.id,
            trackingNumber: carton.trackingNumber,
            reason: 'ShipStation label ID not stored - cannot void',
          })
        }
      }
    }

    // Step 4: Delete all cartons (this will cascade delete carton contents in PACE)
    const deletedCartons = []
    const failedDeletions = []

    for (const carton of cartons) {
      try {
        const deleteUrl = `${paceApiUrl}/DeleteObject/DeleteObject?${new URLSearchParams({
          type: 'Carton',
          key: carton.id.toString(),
        })}`

        console.log(`Deleting carton ${carton.id}...`)

        const deleteResponse = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            Accept: 'application/json',
            Authorization: authHeader,
          },
        })

        if (deleteResponse.ok) {
          deletedCartons.push(carton.id)
          console.log(`Deleted carton ${carton.id}`)
        } else {
          const errorText = await deleteResponse.text()
          console.error(`Failed to delete carton ${carton.id}:`, errorText)
          failedDeletions.push({
            cartonId: carton.id,
            reason: errorText,
          })
        }
      } catch (error: any) {
        console.error(`Error deleting carton ${carton.id}:`, error)
        failedDeletions.push({
          cartonId: carton.id,
          reason: error.message,
        })
      }
    }

    // Step 5: Clear shipment tracking and cost data, change shipment type back to planned
    try {
      const shipmentUpdateData: any = {
        id: parseInt(shipmentId),
        trackingNumber: '',
        trackingLink: '',
        cost: 0,
        u_tracking_notes: '',
        shipped: false, // Mark as not shipped since labels were cancelled
      }

      // Change shipment type from completed → planned
      try {
        // Get current shipment to check its type
        const readShipmentResponse = await fetch(
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

        if (readShipmentResponse.ok) {
          const currentShipment = await readShipmentResponse.json()
          const currentTypeId = currentShipment.shipmentType

          if (currentTypeId) {
            console.log(`🔍 Looking up shipment type mapping for tenantId=${membership.tenantId}, completedTypeId=${currentTypeId}`)

            // Look up the planned type for this completed type
            const mapping = await db.shipmentTypeMapping.findFirst({
              where: {
                tenantId: membership.tenantId,
                completedTypeId: currentTypeId,
              },
            })

            if (mapping) {
              shipmentUpdateData.shipmentType = mapping.plannedTypeId
              console.log(`✅ Changing shipment type back: ${mapping.completedTypeName} (${currentTypeId}) → ${mapping.plannedTypeName} (${mapping.plannedTypeId})`)
            } else {
              console.warn(`⚠️ No shipment type mapping found for tenantId=${membership.tenantId}, completedTypeId=${currentTypeId}`)
              console.warn('⚠️ ShipmentType will NOT be reverted. Please configure ShipmentTypeMapping in database.')
            }
          } else {
            console.warn('⚠️ Current shipment has no shipmentType field, cannot revert shipmentType')
          }
        }
      } catch (error) {
        console.error('❌ Error updating shipment type:', error)
        // Don't fail if type update fails
      }

      console.log('📤 Clearing shipment tracking and cost data, marking as not shipped:', JSON.stringify(shipmentUpdateData, null, 2))

      const updateShipmentResponse = await fetch(
        `${paceApiUrl}/UpdateObject/updateJobShipment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
            Accept: 'application/json',
          },
          body: JSON.stringify(shipmentUpdateData),
        }
      )

      if (updateShipmentResponse.ok) {
        const updateResult = await updateShipmentResponse.json()
        console.log('✅ PACE API update successful (cancel labels)!')
        console.log('✅ Update result:', JSON.stringify(updateResult, null, 2))
        console.log('✅ Successfully cleared shipment tracking and cost data, set shipped=false')
      } else {
        const errorText = await updateShipmentResponse.text()
        console.error('❌ PACE API update failed (cancel labels):', {
          status: updateShipmentResponse.status,
          statusText: updateShipmentResponse.statusText,
          response: errorText,
        })
        console.error('❌ Data sent:', JSON.stringify(shipmentUpdateData, null, 2))
      }
    } catch (error) {
      console.error('❌ Error clearing shipment data:', error)
    }

    return NextResponse.json({
      success: true,
      message: 'Labels cancelled and data cleaned up',
      data: {
        cartonsProcessed: cartons.length,
        deletedCartons: deletedCartons.length,
        failedDeletions: failedDeletions.length,
        canceledLabels: canceledLabels.length,
        failedCancellations: failedCancellations.length,
        details: {
          deletedCartons,
          failedDeletions,
          canceledLabels,
          failedCancellations,
        },
      },
    })
  } catch (error: any) {
    console.error('Cancel labels error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel labels', message: error.message },
      { status: 500 }
    )
  }
}
