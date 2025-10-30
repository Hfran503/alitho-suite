import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPaceApiCredentials } from '@/lib/secrets'

interface EstimatePart {
  jobProductTypeId: string
  description?: string
  quantity: number
  quantities?: number[]
  sequence?: number
  finalSizeWidth?: number
  finalSizeHeight?: number
  runSizeWidth?: number
  runSizeHeight?: number
  buySizeWidth?: number
  buySizeHeight?: number
  inventoryItem?: string
  foldPatternKey?: string
  numPages?: number
  numSigs?: number
  itemsFoldPattern?: number
  secondWeb?: boolean
  overrides?: Record<string, any>
}

interface CreateEstimateRequest {
  customer: string
  salesPerson?: number
  estimator?: number
  description: string
  dueDate?: string
  deliveryDate?: string
  notes?: string
  reference?: string
  parts: EstimatePart[]
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const credentials = await getPaceApiCredentials()
    const { url: paceApiUrl, username, password } = credentials

    if (!paceApiUrl || !username || !password) {
      return NextResponse.json(
        { error: 'PACE API not configured' },
        { status: 500 }
      )
    }

    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

    // Parse request body
    const body: CreateEstimateRequest = await req.json()

    if (!body.customer || !body.description || !body.parts || body.parts.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: customer, description, and at least one part' },
        { status: 400 }
      )
    }

    console.log('Creating estimate with data:', JSON.stringify(body, null, 2))

    // Step 1: Create a basic estimate using CreateObject (without parts)
    const estimateData = {
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

    console.log('Creating basic estimate...')
    const createEstimateResponse = await fetch(
      `${paceApiUrl}/CreateObject/createEstimate`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(estimateData),
      }
    )

    if (!createEstimateResponse.ok) {
      const errorText = await createEstimateResponse.text()
      console.error('Failed to create estimate:', errorText)
      return NextResponse.json(
        { error: 'Failed to create estimate in PACE', details: errorText },
        { status: createEstimateResponse.status }
      )
    }

    const createdEstimate = await createEstimateResponse.json()
    console.log('Estimate created:', createdEstimate.id)

    // Step 2: Create all parts for the estimate
    const partPromises = body.parts.map(async (part, index) => {
      try {
        // Fetch JobProductType details
        console.log(`Fetching JobProductType ${part.jobProductTypeId} for part ${index + 1}...`)
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
          console.error(`Failed to fetch JobProductType ${part.jobProductTypeId}`)
          throw new Error(`JobProductType ${part.jobProductTypeId} not found`)
        }

        const jobProductType = await jobProductTypeResponse.json()
        // console.log(`JobProductType ${part.jobProductTypeId} FULL DATA:`, JSON.stringify(jobProductType, null, 2))

        // Build EstimatePart with ALL fields from JobProductType
        // Link to the JobProductType
        const estimatePart: any = {
          estimate: createdEstimate.id,
          jobProductType: part.jobProductTypeId, // Required - link to JobProductType
          description: part.description || jobProductType.description || `Part ${index + 1}`,
          quantity: part.quantity,
          sequence: part.sequence || (index + 1) * 10,

          // Size fields - Use user inputs first, then JobProductType values (no fallback defaults)
          finalSizeWidth: part.finalSizeWidth || jobProductType.finalSizeWidth,
          finalSizeHeight: part.finalSizeHeight || jobProductType.finalSizeHeight,
          runSizeWidth: part.runSizeWidth || jobProductType.runSizeWidth || jobProductType.finalSizeWidth,
          runSizeHeight: part.runSizeHeight || jobProductType.runSizeHeight || jobProductType.finalSizeHeight,
          buySizeWidth: part.buySizeWidth || jobProductType.buySizeWidth || jobProductType.runSizeWidth || jobProductType.finalSizeWidth,
          buySizeHeight: part.buySizeHeight || jobProductType.buySizeHeight || jobProductType.runSizeHeight || jobProductType.finalSizeHeight,
        }

        // Conditionally add fields from JobProductType only if they have values
        if (jobProductType.componentType) estimatePart.componentType = jobProductType.componentType
        if (jobProductType.colorsSide1) estimatePart.colorsSide1 = jobProductType.colorsSide1
        if (jobProductType.colorsSide2) estimatePart.colorsSide2 = jobProductType.colorsSide2
        if (jobProductType.colorsTotal) estimatePart.colorsTotal = jobProductType.colorsTotal
        if (jobProductType.speedFactor) estimatePart.speedFactor = jobProductType.speedFactor
        if (jobProductType.inkType) estimatePart.inkType = jobProductType.inkType
        if (jobProductType.salesCategory) estimatePart.salesCategory = jobProductType.salesCategory
        if (jobProductType.taxCategory) estimatePart.taxCategory = jobProductType.taxCategory
        if (jobProductType.usePriceListPricing !== undefined) estimatePart.usePriceListPricing = jobProductType.usePriceListPricing
        if (jobProductType.productionType) estimatePart.productionType = jobProductType.productionType
        if (jobProductType.coating) estimatePart.coating = jobProductType.coating
        if (jobProductType.varnish) estimatePart.varnish = jobProductType.varnish
        if (jobProductType.coatingSides) estimatePart.coatingSides = jobProductType.coatingSides
        if (jobProductType.varnishSides) estimatePart.varnishSides = jobProductType.varnishSides
        if (jobProductType.patternCategory) estimatePart.patternCategory = jobProductType.patternCategory
        if (jobProductType.pressEventWorkflow) estimatePart.pressEventWorkflow = jobProductType.pressEventWorkflow
        if (jobProductType.prepressWorkflow) estimatePart.prepressWorkflow = jobProductType.prepressWorkflow
        if (jobProductType.shippingWorkflow) estimatePart.shippingWorkflow = jobProductType.shippingWorkflow

        // Handle fold pattern - prioritize user inputs
        if (part.foldPatternKey) {
          estimatePart.foldPatternKey = part.foldPatternKey
          estimatePart.numPages = part.numPages || jobProductType.numPages
          estimatePart.numSigs = part.numSigs
          if (part.itemsFoldPattern !== undefined) {
            estimatePart.itemsFoldPattern = part.itemsFoldPattern
          }
        } else if (jobProductType.foldPatternKey) {
          estimatePart.foldPatternKey = jobProductType.foldPatternKey
          estimatePart.numPages = jobProductType.numPages
          estimatePart.numSigs = part.numSigs || jobProductType.numSigs
          if (part.itemsFoldPattern !== undefined) {
            estimatePart.itemsFoldPattern = part.itemsFoldPattern
          } else if (jobProductType.itemsFoldPattern !== undefined) {
            estimatePart.itemsFoldPattern = jobProductType.itemsFoldPattern
          }
        } else if (jobProductType.componentType === 1 && jobProductType.numPages) {
          // Default fold pattern based on numPages from JobProductType
          // Format is "pages:signatures", e.g., "2:1" means 2 pages, 1 signature
          const numPages = jobProductType.numPages
          estimatePart.foldPatternKey = `${numPages}:1`
          estimatePart.numPages = numPages
          estimatePart.numSigs = part.numSigs || 1
          if (part.itemsFoldPattern !== undefined) {
            estimatePart.itemsFoldPattern = part.itemsFoldPattern
          } else if (jobProductType.itemsFoldPattern !== undefined) {
            estimatePart.itemsFoldPattern = jobProductType.itemsFoldPattern
          }
        }

        // numSigs can be set independently from fold pattern
        if (part.numSigs !== undefined && !estimatePart.numSigs) {
          estimatePart.numSigs = part.numSigs
        }

        // itemsFoldPattern can be set independently
        if (part.itemsFoldPattern !== undefined && estimatePart.itemsFoldPattern === undefined) {
          estimatePart.itemsFoldPattern = part.itemsFoldPattern
        }

        if (jobProductType.numAcross) estimatePart.numAcross = jobProductType.numAcross
        if (jobProductType.numUp) estimatePart.numUp = jobProductType.numUp
        if (jobProductType.grainDirection) estimatePart.grainDirection = jobProductType.grainDirection

        if (part.secondWeb !== undefined) estimatePart.secondWeb = part.secondWeb
        else if (jobProductType.secondWeb !== undefined) estimatePart.secondWeb = jobProductType.secondWeb

        // Apply any user overrides
        Object.assign(estimatePart, part.overrides || {})

        // Create the EstimatePart
        console.log(`Creating EstimatePart ${index + 1}...`)
        console.log('EstimatePart data being sent:', JSON.stringify(estimatePart, null, 2))
        const createPartResponse = await fetch(
          `${paceApiUrl}/CreateObject/createEstimatePart`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              Authorization: authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(estimatePart),
          }
        )

        if (!createPartResponse.ok) {
          const errorText = await createPartResponse.text()
          console.error(`Failed to create part ${index + 1}:`, errorText)
          throw new Error(`Failed to create part ${index + 1}: ${errorText}`)
        }

        const createdPart = await createPartResponse.json()
        console.log(`EstimatePart ${index + 1} created:`, createdPart.id)

        // Step 2b: Create EstimateQuantity objects for each quantity breakpoint
        const quantities = part.quantities || [part.quantity]
        console.log(`Creating ${quantities.length} EstimateQuantity object(s) for part ${createdPart.id}...`)

        const createdQuantityIds: string[] = []

        for (let qtyIndex = 0; qtyIndex < quantities.length; qtyIndex++) {
          const qty = quantities[qtyIndex]
          console.log(`Creating EstimateQuantity ${qtyIndex + 1}/${quantities.length} with quantity ${qty}...`)

          const estimateQuantity = {
            estimatePart: createdPart.id,
            quantityOrdered: qty,
            sequence: qtyIndex + 1,
          }

          const createQuantityResponse = await fetch(
            `${paceApiUrl}/CreateObject/createEstimateQuantity`,
            {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                Authorization: authHeader,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(estimateQuantity),
            }
          )

          if (!createQuantityResponse.ok) {
            const errorText = await createQuantityResponse.text()
            console.error(`Failed to create quantity ${qtyIndex + 1} for part ${createdPart.id}:`, errorText)
            continue
          }

          const createdQuantity = await createQuantityResponse.json()
          const createdQuantityId = createdQuantity.id
          createdQuantityIds.push(createdQuantityId)
          console.log(`EstimateQuantity ${qtyIndex + 1} created:`, createdQuantityId)

          // Step 2c: Create EstimatePaper for the quantity
          console.log(`Creating EstimatePaper for quantity ${createdQuantityId}...`)
          const estimatePaper = {
            estimateQuantity: createdQuantityId,
            inventoryItem: part.inventoryItem || '1003',
            // grainDirection is optional and will be set by PACE based on inventory item
          }
          console.log('EstimatePaper data:', JSON.stringify(estimatePaper, null, 2))

          const createPaperResponse = await fetch(
            `${paceApiUrl}/CreateObject/createEstimatePaper`,
            {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                Authorization: authHeader,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(estimatePaper),
            }
          )

          if (!createPaperResponse.ok) {
            const errorText = await createPaperResponse.text()
            console.error(`Failed to create paper for quantity ${createdQuantityId}:`, errorText)
          } else {
            const createdPaper = await createPaperResponse.json()
            console.log(`EstimatePaper created:`, createdPaper.id)
          }

          // Step 2d: Create EstimatePress for the quantity
          // Only create press if JobProductType has a press defined
          if (jobProductType.press) {
            console.log(`Creating EstimatePress for quantity ${createdQuantityId}...`)
            const estimatePress = {
              estimateQuantity: createdQuantityId,
              press: jobProductType.press,
              pressForced: true, // Force PACE to use this press and not override it
            }
            console.log('EstimatePress data:', JSON.stringify(estimatePress, null, 2))

            const createPressResponse = await fetch(
              `${paceApiUrl}/CreateObject/createEstimatePress`,
              {
                method: 'POST',
                headers: {
                  Accept: 'application/json',
                  Authorization: authHeader,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(estimatePress),
              }
            )

            if (!createPressResponse.ok) {
              const errorText = await createPressResponse.text()
              console.error(`Failed to create press for quantity ${createdQuantityId}:`, errorText)
            } else {
              const createdPress = await createPressResponse.json()
              console.log(`EstimatePress created:`, createdPress.id)
              console.log(`EstimatePress stored with press value:`, createdPress.press)
            }
          } else {
            console.log(`Skipping EstimatePress creation - no press defined in JobProductType`)
          }
        }

        return {
          partId: createdPart.id,
          jobProductTypeId: part.jobProductTypeId,
          description: estimatePart.description,
          quantities: quantities,
          quantityIds: createdQuantityIds,
          paperInfo: {
            standardPaperType: estimatePart.standardPaperType,
            paperType: estimatePart.paperType,
            weight: estimatePart.weight,
            buySizeGrain: estimatePart.buySizeGrain,
            runSize: `${estimatePart.runSizeWidth}x${estimatePart.runSizeHeight}`,
            paperPrice: estimatePart.paperPrice,
            paperPriceUOM: estimatePart.paperPriceUOM,
          },
        }
      } catch (error) {
        console.error(`Error creating part ${index + 1}:`, error)
        return {
          error: error instanceof Error ? error.message : 'Unknown error',
          partIndex: index,
        }
      }
    })

    const createdParts = await Promise.all(partPromises)

    // Check for any part creation failures
    const failedParts = createdParts.filter((p) => 'error' in p)
    if (failedParts.length > 0) {
      console.error('Some parts failed to create:', failedParts)
      return NextResponse.json(
        {
          success: false,
          error: 'Some parts failed to create',
          estimate: {
            id: createdEstimate.id,
            number: createdEstimate.id,
          },
          createdParts: createdParts.filter((p) => !('error' in p)),
          failedParts,
        },
        { status: 207 } // Multi-Status
      )
    }

    // Step 3: Calculate the estimate to get pricing
    console.log(`Calculating estimate ${createdEstimate.id}...`)
    const calculateResponse = await fetch(
      `${paceApiUrl}/InvokeAction/calculateEstimate?estimatePrimaryKey=${createdEstimate.id}`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: authHeader,
        },
      }
    )

    if (!calculateResponse.ok) {
      const errorText = await calculateResponse.text()
      console.error('Failed to calculate estimate:', errorText)
      // Return the estimate but note that calculation failed
      return NextResponse.json({
        success: true,
        warning: 'Estimate created but pricing calculation failed',
        estimate: {
          id: createdEstimate.id,
          number: createdEstimate.id,
          description: body.description,
          customer: body.customer,
          calculated: false,
        },
        parts: createdParts,
        calculationError: errorText,
      })
    }

    const calculatedEstimate = await calculateResponse.json()
    console.log('Estimate calculated successfully')

    // Step 4: Re-read the full estimate with expanded data to get pricing
    const fullEstimateResponse = await fetch(
      `${paceApiUrl}/ReadObject/readEstimate?primaryKey=${createdEstimate.id}`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: authHeader,
        },
        body: '',
      }
    )

    let fullEstimateWithPricing = calculatedEstimate
    if (fullEstimateResponse.ok) {
      fullEstimateWithPricing = await fullEstimateResponse.json()
      console.log('Full estimate keys:', Object.keys(fullEstimateWithPricing))

      // Look for pricing-related fields
      if (fullEstimateWithPricing.estimateParts) {
        console.log('Found estimateParts in full estimate')
      }
      if (fullEstimateWithPricing.estimateQuantities) {
        console.log('Found estimateQuantities in full estimate:', fullEstimateWithPricing.estimateQuantities.length)
      }
    }

    // Step 5: Find EstimateQuantity objects using FindObjects API to get pricing
    const partsWithPricing = await Promise.all(
      createdParts.map(async (part) => {
        if ('error' in part) return part

        try {
          // Use FindObjects to find EstimateQuantity objects for this part
          // XPath syntax: @fieldName = value
          const xpath = `@estimatePart = ${part.partId}`
          console.log(`Searching for EstimateQuantity with xpath: ${xpath}`)

          const findResponse = await fetch(
            `${paceApiUrl}/FindObjects/find?type=EstimateQuantity&xpath=${encodeURIComponent(xpath)}`,
            {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                Authorization: authHeader,
              },
            }
          )

          if (!findResponse.ok) {
            const errorText = await findResponse.text()
            console.error(`Failed to find EstimateQuantity for part ${part.partId}:`, errorText)
            return part
          }

          // FindObjects returns an array of IDs as strings
          const quantityIds: string[] = await findResponse.json()
          console.log(`Found ${quantityIds.length} EstimateQuantity IDs for part ${part.partId}:`, quantityIds)

          // If no quantities found, read the part to check its state
          if (quantityIds.length === 0) {
            console.log(`No quantities found for part ${part.partId}, reading part details...`)
            const partReadResponse = await fetch(
              `${paceApiUrl}/ReadObject/readEstimatePart?primaryKey=${part.partId}`,
              {
                method: 'POST',
                headers: {
                  Accept: 'application/json',
                  Authorization: authHeader,
                },
                body: '',
              }
            )
            if (partReadResponse.ok) {
              const partData = await partReadResponse.json()
              console.log('Part state:', partData.state)
              console.log('Part quantity:', partData.quantity)
              console.log('Part errors/messages:', partData.calcMessages)
            }
          }

          // Now read each EstimateQuantity to get full pricing data
          const quantities = await Promise.all(
            quantityIds.map(async (qtyId) => {
              try {
                const qtyResponse = await fetch(
                  `${paceApiUrl}/ReadObject/readEstimateQuantity?primaryKey=${qtyId}`,
                  {
                    method: 'POST',
                    headers: {
                      Accept: 'application/json',
                      Authorization: authHeader,
                    },
                    body: '',
                  }
                )

                if (qtyResponse.ok) {
                  const qtyData = await qtyResponse.json()
                  console.log(`EstimateQuantity ${qtyId} pricing:`, {
                    quantity: qtyData.displayQuantity || qtyData.quantityNum,
                    price: qtyData.price,
                    quotedPrice: qtyData.quotedPrice,
                    cost: qtyData.cost,
                    grandTotal: qtyData.grandTotal,
                  })
                  return qtyData
                }
              } catch (err) {
                console.error(`Failed to read EstimateQuantity ${qtyId}:`, err)
              }
              return null
            })
          )

          // Filter out any null values
          const validQuantities = quantities.filter((q) => q !== null)
          console.log(`Successfully retrieved ${validQuantities.length} quantities with pricing for part ${part.partId}`)

          return {
            ...part,
            quantities: validQuantities,
          }
        } catch (err) {
          console.error(`Failed to fetch pricing for part ${part.partId}:`, err)
          return part
        }
      })
    )

    return NextResponse.json({
      success: true,
      estimate: {
        id: calculatedEstimate.id,
        number: calculatedEstimate.estimateNumber,
        description: body.description,
        customer: body.customer,
        state: calculatedEstimate.state,
        calculated: true,
      },
      parts: partsWithPricing,
      fullEstimate: calculatedEstimate, // Include full calculated estimate data
    })
  } catch (error) {
    console.error('Error creating estimate:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
