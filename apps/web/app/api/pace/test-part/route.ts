import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPaceApiCredentials } from '@/lib/secrets'

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url: paceApiUrl, username, password } = await getPaceApiCredentials()
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')

    // Find EstimateQuantity for part 42479
    const qtyFindResponse = await fetch(
      `${paceApiUrl}/FindObjects/find?type=EstimateQuantity&xpath=${encodeURIComponent('@estimatePart = 42479')}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: authHeader,
        },
      }
    )

    if (!qtyFindResponse.ok) {
      return NextResponse.json({ error: 'Failed to find quantities' }, { status: 500 })
    }

    const quantityIds: string[] = await qtyFindResponse.json()
    console.log('Found quantity IDs:', quantityIds)

    if (quantityIds.length === 0) {
      return NextResponse.json({ error: 'No quantities found' }, { status: 404 })
    }

    // Get the first quantity
    const qtyId = quantityIds[0]

    // Find EstimateMaterial for this quantity
    const materialFindResponse = await fetch(
      `${paceApiUrl}/FindObjects/find?type=EstimateMaterial&xpath=${encodeURIComponent(`@estimateQuantity = ${qtyId}`)}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: authHeader,
        },
      }
    )

    if (!materialFindResponse.ok) {
      return NextResponse.json({ error: 'Failed to find materials' }, { status: 500 })
    }

    const materialIds: string[] = await materialFindResponse.json()
    console.log('Found material IDs:', materialIds)

    // Read each material
    const materials = []
    for (const materialId of materialIds) {
      const materialResponse = await fetch(
        `${paceApiUrl}/ReadObject/readEstimateMaterial?primaryKey=${materialId}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: authHeader,
          },
          body: '',
        }
      )

      if (materialResponse.ok) {
        const material = await materialResponse.json()
        materials.push(material)
      }
    }

    return NextResponse.json({
      partId: 42479,
      quantityId: qtyId,
      materialCount: materials.length,
      materials,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
