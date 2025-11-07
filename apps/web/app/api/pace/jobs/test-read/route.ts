import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPaceApiCredentials } from '@/lib/secrets'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const jobNumber = searchParams.get('job') || 'CAD25'

    // Get PACE API credentials
    const credentials = await getPaceApiCredentials()
    const paceApiUrl = credentials.url
    const paceUsername = credentials.username
    const pacePassword = credentials.password

    const authHeader = 'Basic ' + Buffer.from(`${paceUsername}:${pacePassword}`).toString('base64')

    // Read the job to see all fields
    const readUrl = `${paceApiUrl}/ReadObject/readJob?primaryKey=${encodeURIComponent(jobNumber)}`

    console.log(`Reading job ${jobNumber} from PACE...`)

    const response = await fetch(readUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
      body: '',
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: errorText }, { status: response.status })
    }

    const jobData = await response.json()

    // Log all fields that contain 'note' or 'calitho' (case insensitive)
    const relevantFields = Object.keys(jobData).filter(key =>
      key.toLowerCase().includes('note') ||
      key.toLowerCase().includes('calitho') ||
      key.startsWith('u_') ||
      key.startsWith('U_')
    )

    console.log('Job fields containing "note", "calitho", or starting with "u_"/"U_":', relevantFields)

    const relevantData: any = {}
    relevantFields.forEach(key => {
      relevantData[key] = jobData[key]
    })

    return NextResponse.json({
      success: true,
      jobNumber,
      allFieldCount: Object.keys(jobData).length,
      relevantFields,
      relevantData,
      // Include full data for inspection
      fullData: jobData
    })
  } catch (error) {
    console.error('Test read error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
