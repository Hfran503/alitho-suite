import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// GET /api/rates/quote-requests - List quote requests for tenant
export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    const where = { tenantId: membership.tenantId }

    const [requests, total] = await Promise.all([
      db.shippingQuoteRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          createdBy: {
            select: { name: true, email: true },
          },
        },
      }),
      db.shippingQuoteRequest.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching quote requests:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch quote requests' },
      { status: 500 }
    )
  }
}

// POST /api/rates/quote-requests - Create a new quote request with rate estimate
export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const {
      // Multi-carrier: array of { carrierId, serviceCode, carrierName, serviceName }
      services,
      // Legacy single-carrier (backward compat)
      carrierId: singleCarrierId,
      serviceCode: singleServiceCode,
      carrierName: singleCarrierName,
      serviceName: singleServiceName,
      fromAddress,
      toAddress,
      residential,
      addressCount,
      packages,
      shipDate,
      confirmation,
      referenceNumber,
    } = body

    // Normalize to services array (support both multi and single carrier)
    const servicesList: { carrierId: string; serviceCode: string; carrierName: string; serviceName: string }[] =
      services && services.length > 0
        ? services
        : singleCarrierId && singleServiceCode
          ? [{ carrierId: singleCarrierId, serviceCode: singleServiceCode, carrierName: singleCarrierName, serviceName: singleServiceName }]
          : []

    // Validate required fields
    if (servicesList.length === 0) {
      return NextResponse.json({ error: 'At least one carrier/service is required' }, { status: 400 })
    }
    if (!fromAddress?.postalCode || !fromAddress?.city || !fromAddress?.state) {
      return NextResponse.json({ error: 'From address (ZIP, City, State) is required' }, { status: 400 })
    }
    if (!toAddress?.postalCode || !toAddress?.city || !toAddress?.state) {
      return NextResponse.json({ error: 'Destination (ZIP, City, State) is required' }, { status: 400 })
    }
    if (!packages || packages.length === 0) {
      return NextResponse.json({ error: 'At least one package is required' }, { status: 400 })
    }

    const numAddresses = parseInt(addressCount) || 1

    // Expand packages by qty for rate estimation
    const expandedCartons = []
    for (const pkg of packages) {
      const qty = Math.max(1, parseInt(pkg.qty) || 1)
      for (let i = 0; i < qty; i++) {
        expandedCartons.push({
          weight: pkg.weight,
          length: pkg.length,
          width: pkg.width,
          height: pkg.height,
        })
      }
    }

    // Get unique carrier IDs for the rate estimate call
    const uniqueCarrierIds = [...new Set(servicesList.map(s => s.carrierId))]

    // Call rate estimate API with all carriers (no serviceCode filter so we get all services)
    const rateResponse = await fetch(new URL('/api/shipstation/rate-estimates', req.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        fromAddress: {
          postalCode: fromAddress.postalCode,
          city: fromAddress.city,
          state: fromAddress.state,
          countryCode: fromAddress.countryCode || 'US',
        },
        toAddress: {
          postalCode: toAddress.postalCode,
          city: toAddress.city,
          state: toAddress.state,
          countryCode: toAddress.countryCode || 'US',
        },
        cartons: expandedCartons,
        shipDate,
        confirmation: confirmation || 'none',
        residential: residential ? 'yes' : 'no',
        carrierIds: uniqueCarrierIds,
      }),
    })

    if (!rateResponse.ok) {
      const errorData = await rateResponse.json()
      return NextResponse.json(
        { error: errorData.error || 'Failed to get rate estimate from carrier' },
        { status: 400 }
      )
    }

    const rateData = await rateResponse.json()
    const allReturnedRates = rateData.data?.rates || []

    // Match returned rates to selected services.
    // For each selected service, try exact match (carrierId + serviceCode) first.
    // If no exact match, fall back to the cheapest rate from the same carrier
    // (e.g., FedEx returns "fedex_home_delivery" instead of "fedex_ground" for residential).
    const matchedRates: any[] = []
    const usedRateKeys = new Set<string>()

    for (const svc of servicesList) {
      const exactMatch = allReturnedRates.find(
        (r: any) => r.carrierId === svc.carrierId && r.serviceCode === svc.serviceCode
      )

      if (exactMatch && !usedRateKeys.has(`${exactMatch.carrierId}-${exactMatch.serviceCode}`)) {
        matchedRates.push(exactMatch)
        usedRateKeys.add(`${exactMatch.carrierId}-${exactMatch.serviceCode}`)
      } else if (!exactMatch) {
        // Fallback: cheapest unused rate from the same carrier
        const fallback = allReturnedRates
          .filter((r: any) => r.carrierId === svc.carrierId && !usedRateKeys.has(`${r.carrierId}-${r.serviceCode}`))
          .sort((a: any, b: any) => a.amount - b.amount)[0]

        if (fallback) {
          matchedRates.push(fallback)
          usedRateKeys.add(`${fallback.carrierId}-${fallback.serviceCode}`)
        }
      }
    }

    if (matchedRates.length === 0) {
      return NextResponse.json(
        { error: 'No rates returned for the selected carrier/service(s) and destination. Try different services or verify the destination.' },
        { status: 400 }
      )
    }

    const totalPackages = packages.reduce(
      (sum: number, p: any) => sum + Math.max(1, parseInt(p.qty) || 1),
      0
    )

    // Build rate info for each matched rate
    const buildRateBreakdown = (rate: any) => {
      const carrierRate = (rate.shippingAmount || 0) + (rate.insuranceAmount || 0) + (rate.confirmationAmount || 0) + (rate.otherAmount || 0)
      return {
        carrierRate,
        markupAmount: rate.markupAmount || 0,
        processingFee: rate.processingCost || 0,
        shippingAmount: rate.shippingAmount || 0,
        insuranceAmount: rate.insuranceAmount || 0,
        confirmationAmount: rate.confirmationAmount || 0,
        otherAmount: rate.otherAmount || 0,
        rateDetails: rate.rateDetails || [],
      }
    }

    // Build allRates array sorted by price
    const allRates = matchedRates
      .sort((a: any, b: any) => a.amount - b.amount)
      .map((rate: any) => {
        // Use the actual carrier/service names from the rate response (e.g. "FedEx Home Delivery" not "FedEx Ground")
        const perAddr = rate.amount
        return {
          carrierId: rate.carrierId,
          serviceCode: rate.serviceCode,
          carrierName: rate.carrier || rate.carrierId,
          serviceName: rate.service || rate.serviceCode,
          perPackageRate: perAddr / totalPackages,
          perAddressRate: perAddr,
          totalRate: perAddr * numAddresses,
          deliveryDays: rate.deliveryDays || null,
          rateBreakdown: buildRateBreakdown(rate),
        }
      })

    // The cheapest rate becomes the "primary" stored in the main fields
    const cheapest = allRates[0]

    // Save to database
    const quoteRequest = await db.shippingQuoteRequest.create({
      data: {
        tenantId: membership.tenantId,
        createdById: session.user.id,
        referenceNumber: referenceNumber?.trim() || null,
        carrierId: cheapest.carrierId,
        serviceCode: cheapest.serviceCode,
        carrierName: cheapest.carrierName,
        serviceName: cheapest.serviceName,
        fromZip: fromAddress.postalCode,
        fromCity: fromAddress.city,
        fromState: fromAddress.state,
        fromCountry: fromAddress.countryCode || 'US',
        toZip: toAddress.postalCode,
        toCity: toAddress.city,
        toState: toAddress.state,
        toCountry: toAddress.countryCode || 'US',
        residential: residential === true || residential === 'yes',
        addressCount: numAddresses,
        confirmation: confirmation || 'none',
        shipDate: shipDate || null,
        packages,
        perPackageRate: cheapest.perPackageRate,
        perAddressRate: cheapest.perAddressRate,
        totalRate: cheapest.totalRate,
        deliveryDays: cheapest.deliveryDays,
        rateBreakdown: cheapest.rateBreakdown,
        allRates: allRates.length > 1 ? allRates : null,
      },
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: quoteRequest })
  } catch (error: any) {
    console.error('Error creating quote request:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create quote request' },
      { status: 500 }
    )
  }
}
