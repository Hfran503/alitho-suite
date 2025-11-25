import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'
import type { JobShipment, Carton, CartonContent } from '@repo/types'
import { getPaceApiCredentials } from '@/lib/secrets'

export const dynamic = 'force-dynamic'

// GET /api/pace/shipments/[id]/pdf - Generate shipment configuration PDF
export async function GET(
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

    if (!shipmentId) {
      return NextResponse.json({ error: 'Shipment ID is required' }, { status: 400 })
    }

    // Get PACE API credentials
    const credentials = await getPaceApiCredentials()
    const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`

    // Fetch shipment details
    const shipmentUrl = `${credentials.url}/ReadObject/readJobShipment?primaryKey=${shipmentId}`
    const shipmentResponse = await fetch(shipmentUrl, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Authorization': authHeader },
      body: '',
    })

    if (!shipmentResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch shipment' }, { status: 500 })
    }

    const shipment: JobShipment = await shipmentResponse.json()

    // Fetch additional lookups for display
    let shipViaDescription = ''
    let companyName = ''

    // Lookup ShipVia description
    if ((shipment as any).shipVia) {
      try {
        const shipViaUrl = `${credentials.url}/ReadObject/readShipVia?primaryKey=${(shipment as any).shipVia}`
        const shipViaResponse = await fetch(shipViaUrl, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Authorization': authHeader },
          body: '',
        })
        if (shipViaResponse.ok) {
          const shipViaData = await shipViaResponse.json()
          shipViaDescription = shipViaData.description || ''
        }
      } catch (err) {
        console.error('Failed to fetch ShipVia:', err)
      }
    }

    // Lookup Contact company name
    if ((shipment as any).contact) {
      try {
        const contactUrl = `${credentials.url}/ReadObject/readContact?primaryKey=${(shipment as any).contact}`
        const contactResponse = await fetch(contactUrl, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Authorization': authHeader },
          body: '',
        })
        if (contactResponse.ok) {
          const contactData = await contactResponse.json()
          companyName = contactData.companyName || ''
        }
      } catch (err) {
        console.error('Failed to fetch Contact:', err)
      }
    }

    // Fetch cartons
    const xpath = `@shipment=${shipmentId}`
    const queryParams = new URLSearchParams({
      type: 'Carton',
      xpath: xpath,
      offset: '0',
      limit: '1000',
    })

    const findCartonsUrl = `${credentials.url}/FindObjects/findSortAndLimit?${queryParams.toString()}`
    const findResponse = await fetch(findCartonsUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([]),
    })

    let cartons: Carton[] = []

    if (findResponse.ok) {
      const cartonIds: string[] = await findResponse.json()

      if (cartonIds && cartonIds.length > 0) {
        const cartonPromises = cartonIds.map(async (cartonId) => {
          const readCartonUrl = `${credentials.url}/ReadObject/readCarton?primaryKey=${cartonId}`
          const cartonResponse = await fetch(readCartonUrl, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Authorization': authHeader },
            body: '',
          })

          if (!cartonResponse.ok) return null

          const carton: Carton = await cartonResponse.json()

          // Fetch skid details
          if (carton.skid) {
            try {
              const readSkidUrl = `${credentials.url}/ReadObject/readSkid?primaryKey=${carton.skid}`
              const skidResponse = await fetch(readSkidUrl, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Authorization': authHeader },
                body: '',
              })

              if (skidResponse.ok) {
                const skidData = await skidResponse.json()
                carton.skidDescription = skidData.description
                carton.skidWeight = skidData.weight
                carton.skidCount = skidData.count
              }
            } catch (err) {
              console.error('Failed to fetch skid details:', err)
            }
          }

          // Fetch carton contents
          const contentXpath = `@carton=${cartonId}`
          const contentQueryParams = new URLSearchParams({
            type: 'CartonContent',
            xpath: contentXpath,
            offset: '0',
            limit: '1000',
          })

          const findContentUrl = `${credentials.url}/FindObjects/findSortAndLimit?${contentQueryParams.toString()}`
          const findContentResponse = await fetch(findContentUrl, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify([]),
          })

          if (findContentResponse.ok) {
            const contentIds: string[] = await findContentResponse.json()

            if (contentIds && contentIds.length > 0) {
              const contentPromises = contentIds.map(async (contentId) => {
                const readContentUrl = `${credentials.url}/ReadObject/readCartonContent?primaryKey=${contentId}`
                const contentResponse = await fetch(readContentUrl, {
                  method: 'POST',
                  headers: { 'Accept': 'application/json', 'Authorization': authHeader },
                  body: '',
                })

                if (!contentResponse.ok) return null

                const content: CartonContent = await contentResponse.json()

                // Fetch JobComponent details
                if (content.jobComponent) {
                  try {
                    const compResponse = await fetch(
                      `${credentials.url}/ReadObject/readJobComponent?primaryKey=${content.jobComponent}`,
                      {
                        method: 'POST',
                        headers: { 'Accept': 'application/json', 'Authorization': authHeader },
                        body: '',
                      }
                    )
                    if (compResponse.ok) {
                      const compData = await compResponse.json()
                      content.jobComponentDescription = compData.description
                      content.jobComponentItemNumber = compData.u_itemNumber
                      content.jobComponentPO = compData.u_po
                    }
                  } catch (err) {
                    console.error('Failed to fetch JobComponent:', err)
                  }
                }

                return content
              })

              const contents = await Promise.all(contentPromises)
              carton.contents = contents.filter((c): c is CartonContent => c !== null)
            }
          }

          return carton
        })

        const cartonResults = await Promise.all(cartonPromises)
        cartons = cartonResults.filter((c): c is Carton => c !== null)
      }
    }

    // Generate HTML
    const html = generateShipmentPdfHtml(shipment, cartons, shipmentId, companyName, shipViaDescription)

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Shipment PDF error:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function generateShipmentPdfHtml(shipment: JobShipment, cartons: Carton[], shipmentId: string, companyName: string, shipViaDescription: string): string {
  // Group cartons by skid
  const groupedCartons: Map<number, { skid: number; description?: string; weight?: number; count?: number; cartons: Carton[] }> = new Map()
  const noSkidCartons: Carton[] = []

  cartons.forEach((carton) => {
    if (carton.skid) {
      if (!groupedCartons.has(carton.skid)) {
        groupedCartons.set(carton.skid, {
          skid: carton.skid,
          description: carton.skidDescription,
          weight: carton.skidWeight,
          count: carton.skidCount,
          cartons: [],
        })
      }
      groupedCartons.get(carton.skid)!.cartons.push(carton)
    } else {
      noSkidCartons.push(carton)
    }
  })

  // Calculate totals
  const totalCartons = cartons.reduce((sum, carton) => {
    const skidCount = carton.skidCount || 1
    const cartonCount = carton.count || 1
    return sum + (skidCount * cartonCount)
  }, 0)

  const grandTotalQty = cartons.reduce((sum, carton) => {
    const cartonTotal = (carton.contents || []).reduce((contentSum, content) => {
      const qty = content.quantity || 0
      const count = carton.count || 1
      const skidCount = carton.skidCount || 1
      return contentSum + (qty * count * skidCount)
    }, 0)
    return sum + cartonTotal
  }, 0)

  // Format date
  const shipDate = shipment.dateTime ? new Date(shipment.dateTime).toLocaleDateString() : 'N/A'

  // Build ship-to address using correct field names
  const s = shipment as any
  const contactName = [s.contactFirstName, s.contactLastName].filter(Boolean).join(' ')
  const addressLines = [
    companyName,
    contactName,
    s.address1,
    s.address2,
    s.address3,
    [s.city, s.state, s.zip].filter(Boolean).join(', '),
  ].filter(Boolean)

  // Add phone/email if available
  if (s.phone) addressLines.push(`Phone: ${s.phone}`)
  if (s.email) addressLines.push(`Email: ${s.email}`)

  const shipToAddress = addressLines.join('<br>')

  // Generate carton rows HTML
  let cartonRowsHtml = ''

  // Render skid groups
  Array.from(groupedCartons.values()).forEach((skidGroup) => {
    // Skid header row
    cartonRowsHtml += `
      <tr class="skid-header">
        <td colspan="7">
          <div class="skid-info">
            <strong>Skid #${skidGroup.skid}</strong>
            ${skidGroup.description ? `<span class="skid-desc">${skidGroup.description}</span>` : ''}
            ${skidGroup.count ? `<span class="skid-badge">Count: ${skidGroup.count}</span>` : ''}
            ${skidGroup.weight ? `<span class="skid-badge">Weight: ${skidGroup.weight} lbs</span>` : ''}
          </div>
        </td>
      </tr>
    `

    // Carton rows in this skid
    skidGroup.cartons.forEach((carton) => {
      const contents = carton.contents || []
      const cartonQty = contents.reduce((sum, c) => sum + ((c.quantity || 0) * (carton.count || 1) * (carton.skidCount || 1)), 0)

      cartonRowsHtml += `
        <tr class="carton-row">
          <td>
            <div class="carton-id">#${carton.id}</div>
            ${carton.count && carton.count > 1 ? `<div class="carton-count">${carton.count} cartons</div>` : ''}
          </td>
          <td>${carton.note || '-'}</td>
          <td>
            ${contents.map((content) => `
              <div class="content-item">
                <div class="content-type">${content.jobComponent ? 'Component' : content.jobProduct ? 'Product' : content.jobMaterial ? 'Material' : 'Item'}</div>
                <div class="content-desc">${content.jobComponentDescription || content.jobProductDescription || content.jobMaterialDescription || '-'}</div>
                ${content.jobComponentItemNumber ? `<div class="content-meta">Item: ${content.jobComponentItemNumber}</div>` : ''}
                ${content.jobComponentPO ? `<div class="content-meta">PO: ${content.jobComponentPO}</div>` : ''}
              </div>
            `).join('')}
          </td>
          <td class="text-right">${contents.map((c) => c.quantity?.toLocaleString() || '-').join('<br>')}</td>
          <td class="text-right">${cartonQty.toLocaleString()}</td>
          <td class="text-right">${carton.weight ? `${carton.weight} lbs` : '-'}</td>
          <td>${carton.trackingNumber || '-'}</td>
        </tr>
      `
    })
  })

  // Render cartons without skid
  noSkidCartons.forEach((carton) => {
    const contents = carton.contents || []
    const cartonQty = contents.reduce((sum, c) => sum + ((c.quantity || 0) * (carton.count || 1)), 0)

    cartonRowsHtml += `
      <tr class="carton-row">
        <td>
          <div class="carton-id">#${carton.id}</div>
          ${carton.count && carton.count > 1 ? `<div class="carton-count">${carton.count} cartons</div>` : ''}
        </td>
        <td>${carton.note || '-'}</td>
        <td>
          ${contents.map((content) => `
            <div class="content-item">
              <div class="content-type">${content.jobComponent ? 'Component' : content.jobProduct ? 'Product' : content.jobMaterial ? 'Material' : 'Item'}</div>
              <div class="content-desc">${content.jobComponentDescription || content.jobProductDescription || content.jobMaterialDescription || '-'}</div>
              ${content.jobComponentItemNumber ? `<div class="content-meta">Item: ${content.jobComponentItemNumber}</div>` : ''}
              ${content.jobComponentPO ? `<div class="content-meta">PO: ${content.jobComponentPO}</div>` : ''}
            </div>
          `).join('')}
        </td>
        <td class="text-right">${contents.map((c) => c.quantity?.toLocaleString() || '-').join('<br>')}</td>
        <td class="text-right">${cartonQty.toLocaleString()}</td>
        <td class="text-right">${carton.weight ? `${carton.weight} lbs` : '-'}</td>
        <td>${carton.trackingNumber || '-'}</td>
      </tr>
    `
  })

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shipment #${shipmentId} - Configuration</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #1f2937;
      padding: 20px;
      background: white;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e5e7eb;
    }

    .header-left h1 {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 4px;
    }

    .header-left .subtitle {
      color: #6b7280;
      font-size: 14px;
    }

    .header-right {
      text-align: right;
    }

    .header-right .date {
      font-size: 14px;
      color: #374151;
    }

    .header-right .shipment-type {
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 24px;
    }

    .info-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
    }

    .info-box h3 {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 8px;
    }

    .info-box p {
      font-size: 13px;
      color: #374151;
    }

    .summary-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
    }

    .summary-box .total-cartons {
      font-size: 28px;
      font-weight: 700;
      color: #1d4ed8;
    }

    .summary-box .total-qty {
      font-size: 14px;
      color: #3b82f6;
      margin-top: 4px;
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 12px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }

    th {
      background: #f3f4f6;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: #6b7280;
      padding: 10px 12px;
      text-align: left;
      border-bottom: 2px solid #e5e7eb;
    }

    th.text-right {
      text-align: right;
    }

    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }

    td.text-right {
      text-align: right;
    }

    .skid-header {
      background: #dbeafe;
    }

    .skid-header td {
      padding: 8px 12px;
      border-bottom: 1px solid #93c5fd;
    }

    .skid-info {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .skid-info strong {
      color: #1e40af;
      font-size: 13px;
    }

    .skid-desc {
      color: #3b82f6;
      font-size: 12px;
    }

    .skid-badge {
      background: #bfdbfe;
      color: #1e40af;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .carton-row {
      background: white;
    }

    .carton-row:hover {
      background: #f9fafb;
    }

    .carton-id {
      font-weight: 600;
      color: #374151;
    }

    .carton-count {
      font-size: 11px;
      color: #6b7280;
    }

    .content-item {
      margin-bottom: 8px;
    }

    .content-item:last-child {
      margin-bottom: 0;
    }

    .content-type {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: #9333ea;
      margin-bottom: 2px;
    }

    .content-desc {
      font-size: 12px;
      color: #374151;
    }

    .content-meta {
      font-size: 11px;
      color: #6b7280;
    }

    .totals-row {
      background: #f3f4f6;
      font-weight: 600;
    }

    .totals-row td {
      padding: 12px;
      border-top: 2px solid #d1d5db;
    }

    .total-value {
      font-size: 16px;
      font-weight: 700;
      color: #1d4ed8;
    }

    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 11px;
    }

    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2563eb;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .print-btn:hover {
      background: #1d4ed8;
    }

    @media print {
      .print-btn {
        display: none;
      }

      body {
        padding: 0;
      }

      .info-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @page {
      size: A4 landscape;
      margin: 15mm;
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
    </svg>
    Print / Save as PDF
  </button>

  <div class="header">
    <div class="header-left">
      <h1>Shipment Configuration</h1>
      <div class="subtitle">Shipment #${shipmentId} ${shipment.job ? `| Job: ${shipment.job}` : ''}</div>
    </div>
    <div class="header-right">
      <div class="date">Ship Date: ${shipDate}</div>
      ${(shipment as any).shipType ? `<div class="shipment-type">${(shipment as any).shipType}</div>` : ''}
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Ship To</h3>
      <p>${shipToAddress || 'N/A'}</p>
    </div>
    <div class="info-box">
      <h3>Shipping Details</h3>
      <p>
        ${shipViaDescription ? `Carrier: ${shipViaDescription}<br>` : ''}
        ${s.freightTerms ? `Freight Terms: ${s.freightTerms}<br>` : ''}
        ${s.shipType ? `Type: ${s.shipType}` : ''}
      </p>
    </div>
    <div class="info-box summary-box">
      <h3>Summary</h3>
      <div class="total-cartons">${totalCartons.toLocaleString()} Cartons</div>
      <div class="total-qty">Total Qty: ${grandTotalQty.toLocaleString()}</div>
    </div>
  </div>

  <h2 class="section-title">Carton Configuration</h2>

  <table>
    <thead>
      <tr>
        <th>Carton #</th>
        <th>Note</th>
        <th>Contents</th>
        <th class="text-right">Qty/Carton</th>
        <th class="text-right">Total Qty</th>
        <th class="text-right">Weight</th>
        <th>Tracking</th>
      </tr>
    </thead>
    <tbody>
      ${cartonRowsHtml}
      <tr class="totals-row">
        <td colspan="4"><strong>Totals</strong></td>
        <td class="text-right"><span class="total-value">${grandTotalQty.toLocaleString()}</span></td>
        <td colspan="2"><span style="color: #374151;">${totalCartons.toLocaleString()} total cartons</span></td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    Generated on ${new Date().toLocaleString()} | Shipment #${shipmentId}
  </div>
</body>
</html>
  `
}
