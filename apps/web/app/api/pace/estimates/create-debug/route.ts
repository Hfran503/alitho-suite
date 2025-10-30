import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPaceApiCredentials } from '@/lib/secrets'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url: paceApiUrl, username, password } = await getPaceApiCredentials()
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')

    const body = await req.json()

    // Get the first part for demo
    const part = body.parts[0]

    // Fetch JobProductType to get all the data we need
    const jobProductTypeResponse = await fetch(
      `${paceApiUrl}/ReadObject/readJobProductType?primaryKey=${part.jobProductTypeId}`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: authHeader,
        },
        body: '',
      }
    )

    if (!jobProductTypeResponse.ok) {
      throw new Error(`JobProductType ${part.jobProductTypeId} not found`)
    }

    const jobProductType = await jobProductTypeResponse.json()

    // Step 1: Estimate Data
    const step1_estimateData = {
      customer: body.customer,
      salesPerson: body.salesPerson,
      estimator: body.estimator,
      description: body.description,
      estimateNumber: 'Test123',
      dueDate: body.dueDate,
      deliveryDate: body.deliveryDate,
      notes: body.notes,
      reference: body.reference,
    }

    // Step 2: Estimate Part Data
    const step2_estimatePartData: any = {
      estimate: '[ESTIMATE_ID]',
      jobProductType: part.jobProductTypeId,
      description: part.description || jobProductType.description || 'Part 1',
      quantity: part.quantity,
      sequence: part.sequence || 10,
      // Use user inputs first, then JobProductType values (no fallback defaults)
      finalSizeWidth: part.finalSizeWidth || jobProductType.finalSizeWidth,
      finalSizeHeight: part.finalSizeHeight || jobProductType.finalSizeHeight,
      runSizeWidth: part.runSizeWidth || jobProductType.runSizeWidth || jobProductType.finalSizeWidth,
      runSizeHeight: part.runSizeHeight || jobProductType.runSizeHeight || jobProductType.finalSizeHeight,
      buySizeWidth: part.buySizeWidth || jobProductType.buySizeWidth || jobProductType.runSizeWidth || jobProductType.finalSizeWidth,
      buySizeHeight: part.buySizeHeight || jobProductType.buySizeHeight || jobProductType.runSizeHeight || jobProductType.finalSizeHeight,
    }

    // Add optional fields from JobProductType
    if (jobProductType.componentType) step2_estimatePartData.componentType = jobProductType.componentType
    if (jobProductType.colorsSide1) step2_estimatePartData.colorsSide1 = jobProductType.colorsSide1
    if (jobProductType.colorsSide2) step2_estimatePartData.colorsSide2 = jobProductType.colorsSide2
    if (jobProductType.colorsTotal) step2_estimatePartData.colorsTotal = jobProductType.colorsTotal
    if (jobProductType.inkType) step2_estimatePartData.inkType = jobProductType.inkType
    if (jobProductType.salesCategory) step2_estimatePartData.salesCategory = jobProductType.salesCategory
    if (jobProductType.usePriceListPricing !== undefined) step2_estimatePartData.usePriceListPricing = jobProductType.usePriceListPricing
    if (jobProductType.productionType) step2_estimatePartData.productionType = jobProductType.productionType
    if (jobProductType.prepressWorkflow) step2_estimatePartData.prepressWorkflow = jobProductType.prepressWorkflow
    if (jobProductType.shippingWorkflow) step2_estimatePartData.shippingWorkflow = jobProductType.shippingWorkflow

    // Fold pattern - prioritize user inputs
    if (part.foldPatternKey) {
      step2_estimatePartData.foldPatternKey = part.foldPatternKey
      step2_estimatePartData.numPages = part.numPages || jobProductType.numPages
      step2_estimatePartData.numSigs = part.numSigs
      if (part.itemsFoldPattern !== undefined) {
        step2_estimatePartData.itemsFoldPattern = part.itemsFoldPattern
      }
    } else if (jobProductType.foldPatternKey) {
      step2_estimatePartData.foldPatternKey = jobProductType.foldPatternKey
      step2_estimatePartData.numPages = jobProductType.numPages
      step2_estimatePartData.numSigs = part.numSigs || jobProductType.numSigs
      if (part.itemsFoldPattern !== undefined) {
        step2_estimatePartData.itemsFoldPattern = part.itemsFoldPattern
      } else if (jobProductType.itemsFoldPattern !== undefined) {
        step2_estimatePartData.itemsFoldPattern = jobProductType.itemsFoldPattern
      }
    } else if (jobProductType.componentType === 1 && jobProductType.numPages) {
      const numPages = jobProductType.numPages
      step2_estimatePartData.foldPatternKey = `${numPages}:1`
      step2_estimatePartData.numPages = numPages
      step2_estimatePartData.numSigs = part.numSigs || 1
      if (part.itemsFoldPattern !== undefined) {
        step2_estimatePartData.itemsFoldPattern = part.itemsFoldPattern
      } else if (jobProductType.itemsFoldPattern !== undefined) {
        step2_estimatePartData.itemsFoldPattern = jobProductType.itemsFoldPattern
      }
    }

    // numSigs can be set independently from fold pattern
    if (part.numSigs !== undefined && !step2_estimatePartData.numSigs) {
      step2_estimatePartData.numSigs = part.numSigs
    }

    // itemsFoldPattern can be set independently
    if (part.itemsFoldPattern !== undefined && step2_estimatePartData.itemsFoldPattern === undefined) {
      step2_estimatePartData.itemsFoldPattern = part.itemsFoldPattern
    }

    if (part.secondWeb !== undefined) step2_estimatePartData.secondWeb = part.secondWeb
    else if (jobProductType.secondWeb !== undefined) step2_estimatePartData.secondWeb = jobProductType.secondWeb

    // Step 3: Estimate Quantity Data (multiple quantities)
    const step3_estimateQuantitiesData = (part.quantities || [part.quantity]).map((qty: number, index: number) => ({
      estimatePart: '[ESTIMATE_PART_ID]',
      quantityOrdered: qty,
      sequence: index + 1,
    }))

    // Step 4: Estimate Paper Data (one per quantity)
    const step4_estimatePapersData = (part.quantities || [part.quantity]).map(() => ({
      estimateQuantity: '[ESTIMATE_QUANTITY_ID]',
      inventoryItem: part.inventoryItem || '1003',
    }))

    // Step 5: Estimate Press Data (one per quantity if press is defined)
    const step5_estimatePressesData: any[] = []
    if (jobProductType.press) {
      (part.quantities || [part.quantity]).forEach(() => {
        step5_estimatePressesData.push({
          estimateQuantity: '[ESTIMATE_QUANTITY_ID]',
          press: jobProductType.press,
          pressForced: true,
        })
      })
    }

    return NextResponse.json({
      step1_estimateData,
      step2_estimatePartData,
      step3_estimateQuantitiesData,
      step4_estimatePapersData,
      step5_estimatePressesData,
      note: `Will create ${(part.quantities || [part.quantity]).length} quantity breakpoint(s) for pricing`,
    })
  } catch (error) {
    console.error('Error generating debug data:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
