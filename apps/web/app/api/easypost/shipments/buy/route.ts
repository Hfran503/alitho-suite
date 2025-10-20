import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import { getEasyPostClient } from '@/lib/easypost'

/**
 * POST /api/easypost/shipments/buy
 * Purchase a shipping label for a shipment with a selected rate
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const { shipmentId, rateId } = body

    // Validate required fields
    if (!shipmentId || !rateId) {
      return NextResponse.json(
        { error: 'Missing required fields: shipmentId, rateId' },
        { status: 400 }
      )
    }

    // Get EasyPost client for this tenant
    const easypost = await getEasyPostClient(membership.tenantId)

    // Buy the shipment with the selected rate
    const boughtShipment = await easypost.Shipment.buy(shipmentId, rateId)

    // For multi-piece shipments, EasyPost returns multiple postage_label objects
    const isMultiPiece = Array.isArray(boughtShipment.postage_label)

    if (isMultiPiece) {
      // Multi-piece shipment - return array of labels
      const labels = (boughtShipment.postage_label as unknown as any[]).map((label: any, index: number) => ({
        trackingCode: Array.isArray(boughtShipment.tracking_code)
          ? boughtShipment.tracking_code[index]
          : boughtShipment.tracking_code,
        trackingUrl: Array.isArray(boughtShipment.tracker)
          ? boughtShipment.tracker[index]?.public_url
          : boughtShipment.tracker?.public_url,
        labelUrl: label.label_url,
        labelPdfUrl: label.label_pdf_url,
        labelZplUrl: label.label_zpl_url,
        labelFileType: label.label_file_type,
      }))

      return NextResponse.json({
        success: true,
        data: {
          shipmentId: boughtShipment.id,
          labels,
          selectedRate: {
            id: boughtShipment.selected_rate?.id,
            carrier: boughtShipment.selected_rate?.carrier,
            service: boughtShipment.selected_rate?.service,
            rate: parseFloat(boughtShipment.selected_rate?.rate || '0'),
            currency: boughtShipment.selected_rate?.currency,
            deliveryDays: boughtShipment.selected_rate?.delivery_days,
            deliveryDate: boughtShipment.selected_rate?.delivery_date,
          },
          status: boughtShipment.status,
          createdAt: boughtShipment.created_at,
          fees: boughtShipment.fees?.map((fee: any) => ({
            type: fee.type,
            amount: parseFloat(fee.amount),
            charged: fee.charged,
            refunded: fee.refunded,
          })),
        },
      })
    } else {
      // Single piece shipment - return single label
      const labelInfo = {
        shipmentId: boughtShipment.id,
        trackingCode: boughtShipment.tracking_code,
        trackingUrl: boughtShipment.tracker?.public_url,
        labelUrl: boughtShipment.postage_label?.label_url,
        labelPdfUrl: boughtShipment.postage_label?.label_pdf_url,
        labelZplUrl: boughtShipment.postage_label?.label_zpl_url,
        labelFileType: boughtShipment.postage_label?.label_file_type,
        selectedRate: {
          id: boughtShipment.selected_rate?.id,
          carrier: boughtShipment.selected_rate?.carrier,
          service: boughtShipment.selected_rate?.service,
          rate: parseFloat(boughtShipment.selected_rate?.rate || '0'),
          currency: boughtShipment.selected_rate?.currency,
          deliveryDays: boughtShipment.selected_rate?.delivery_days,
          deliveryDate: boughtShipment.selected_rate?.delivery_date,
        },
        status: boughtShipment.status,
        createdAt: boughtShipment.created_at,
        fees: boughtShipment.fees?.map((fee: any) => ({
          type: fee.type,
          amount: parseFloat(fee.amount),
          charged: fee.charged,
          refunded: fee.refunded,
        })),
      }

      return NextResponse.json({
        success: true,
        data: labelInfo,
      })
    }
  } catch (error: any) {
    console.error('Buy shipment error:', error)

    // Handle EasyPost-specific errors
    if (error.statusCode) {
      return NextResponse.json(
        {
          error: 'EasyPost API error',
          message: error.message || 'Failed to purchase label',
          details: error.error?.message,
        },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { error: 'Failed to purchase shipping label' },
      { status: 500 }
    )
  }
}
