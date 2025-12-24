import { db } from '@repo/database'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { PrintButton } from './PrintButton'

interface PrintPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PrintPageProps) {
  const { id } = await params
  const pickOrder = await db.pickOrder.findFirst({
    where: { id },
    select: { pickOrderNumber: true },
  })

  return {
    title: pickOrder ? `Pick Order ${pickOrder.pickOrderNumber}` : 'Pick Order',
  }
}

export default async function PickOrderPrintPage({ params }: PrintPageProps) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return null
  }

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
  })

  if (!membership) {
    return notFound()
  }

  const { id } = await params

  const pickOrder = await db.pickOrder.findFirst({
    where: { id, tenantId: membership.tenantId },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      items: {
        include: {
          item: {
            select: {
              id: true,
              sku: true,
              name: true,
              trackByReference: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  company: true,
                },
              },
            },
          },
          location: {
            select: {
              id: true,
              barcode: true,
              name: true,
            },
          },
        },
      },
    },
  })

  if (!pickOrder) {
    return notFound()
  }

  // Get available stock for items without assigned locations
  const itemsWithStock = await Promise.all(
    pickOrder.items.map(async (orderItem: (typeof pickOrder.items)[number]) => {
      if (orderItem.locationId) {
        return { ...orderItem, suggestedLocations: [] }
      }

      const stock = await db.inventoryStock.findMany({
        where: {
          tenantId: membership.tenantId,
          itemId: orderItem.itemId,
          available: { gt: 0 },
          ...(orderItem.referenceNumber && { referenceNumber: orderItem.referenceNumber }),
          ...(orderItem.lotNumber && { lotNumber: orderItem.lotNumber }),
        },
        include: {
          location: {
            select: { id: true, barcode: true, name: true },
          },
        },
        orderBy: { available: 'desc' },
        take: 3,
      })

      return {
        ...orderItem,
        suggestedLocations: stock.map((s: typeof stock[number]) => ({
          barcode: s.location.barcode,
          name: s.location.name,
          available: s.available,
        })),
      }
    })
  )

  const totalItems = pickOrder.items.length
  const totalQty = pickOrder.items.reduce((sum: number, i: (typeof pickOrder.items)[number]) => sum + i.requestedQty, 0)
  const pickedQty = pickOrder.items.reduce((sum: number, i: (typeof pickOrder.items)[number]) => sum + i.pickedQty, 0)

  const priorityColors: Record<string, string> = {
    urgent: '#dc2626',
    high: '#ea580c',
    normal: '#2563eb',
    low: '#6b7280',
  }

  const statusColors: Record<string, string> = {
    DRAFT: '#6b7280',
    PENDING: '#eab308',
    IN_PROGRESS: '#3b82f6',
    COMPLETED: '#22c55e',
    CANCELLED: '#ef4444',
  }

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0.5in;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
        }

        .print-page * {
          box-sizing: border-box;
        }

        .print-page {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          color: #1f2937;
          background: white;
          padding: 20px;
          max-width: 210mm;
          margin: 0 auto;
        }

        .print-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #10b981;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }

        .title-section h1 {
          font-size: 24px;
          font-weight: bold;
          color: #065f46;
          margin: 0 0 4px 0;
        }

        .title-section .order-number {
          font-size: 18px;
          font-family: monospace;
          color: #374151;
        }

        .company-name {
          font-size: 14px;
          color: #6b7280;
          text-align: right;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .meta-box {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 12px;
        }

        .meta-box h3 {
          font-size: 11px;
          text-transform: uppercase;
          color: #6b7280;
          margin: 0 0 8px 0;
          letter-spacing: 0.5px;
        }

        .meta-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .meta-label {
          color: #6b7280;
        }

        .meta-value {
          font-weight: 600;
        }

        .status-badge, .priority-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          color: white;
        }

        .destination-box {
          background: #ecfdf5;
          border: 2px solid #10b981;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 20px;
        }

        .destination-box h3 {
          font-size: 11px;
          text-transform: uppercase;
          color: #065f46;
          margin: 0 0 4px 0;
        }

        .destination-box .destination {
          font-size: 16px;
          font-weight: bold;
          color: #065f46;
          margin: 0;
        }

        .destination-box .notes {
          font-size: 12px;
          color: #047857;
          margin-top: 4px;
        }

        .print-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }

        .print-table th {
          background: #065f46;
          color: white;
          text-align: left;
          padding: 10px 8px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .print-table td {
          padding: 10px 8px;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: top;
        }

        .print-table tr:nth-child(even) {
          background: #f9fafb;
        }

        .sku {
          font-family: monospace;
          font-weight: 600;
          font-size: 13px;
        }

        .item-name {
          color: #6b7280;
          font-size: 11px;
        }

        .ref-badge {
          display: inline-block;
          background: #dbeafe;
          color: #1e40af;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
          font-size: 10px;
        }

        .location-badge {
          display: inline-block;
          background: #fef3c7;
          color: #92400e;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
          font-size: 11px;
          font-weight: 600;
        }

        .suggested-locations {
          font-size: 10px;
          color: #6b7280;
          margin-top: 4px;
        }

        .qty-cell {
          text-align: center;
          font-size: 16px;
          font-weight: bold;
        }

        .checkbox-cell {
          width: 40px;
          text-align: center;
        }

        .checkbox {
          width: 20px;
          height: 20px;
          border: 2px solid #9ca3af;
          border-radius: 3px;
          display: inline-block;
        }

        .summary-box {
          background: #f3f4f6;
          border-radius: 6px;
          padding: 15px;
          display: flex;
          justify-content: space-around;
          margin-bottom: 20px;
        }

        .summary-item {
          text-align: center;
        }

        .summary-item .value {
          font-size: 24px;
          font-weight: bold;
          color: #065f46;
        }

        .summary-item .label {
          font-size: 11px;
          color: #6b7280;
          text-transform: uppercase;
        }

        .signature-section {
          margin-top: 30px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
        }

        .signature-box {
          border-top: 1px solid #9ca3af;
          padding-top: 8px;
        }

        .signature-box .label {
          font-size: 11px;
          color: #6b7280;
        }

        .notes-section {
          margin-top: 20px;
          padding: 12px;
          background: #fffbeb;
          border: 1px solid #fcd34d;
          border-radius: 6px;
        }

        .notes-section h3 {
          font-size: 11px;
          text-transform: uppercase;
          color: #92400e;
          margin: 0 0 4px 0;
        }

        .print-button {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          z-index: 100;
        }

        .print-button:hover {
          background: #059669;
        }

        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 10px;
          color: #9ca3af;
          border-top: 1px solid #e5e7eb;
          padding-top: 10px;
        }
      `}</style>

      <PrintButton />

      <div className="print-page">
        <div className="print-header">
          <div className="title-section">
            <h1>PICK ORDER</h1>
            <div className="order-number">{pickOrder.pickOrderNumber}</div>
          </div>
          <div className="company-name">
            {membership.tenant.name}
            <br />
            <span style={{ fontSize: '11px' }}>
              Printed: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>

        <div className="meta-grid">
          <div className="meta-box">
            <h3>Order Details</h3>
            <div className="meta-row">
              <span className="meta-label">Status:</span>
              <span
                className="status-badge"
                style={{ backgroundColor: statusColors[pickOrder.status] || '#6b7280' }}
              >
                {pickOrder.status.replace('_', ' ')}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Priority:</span>
              <span
                className="priority-badge"
                style={{ backgroundColor: priorityColors[pickOrder.priority] || '#6b7280' }}
              >
                {pickOrder.priority.toUpperCase()}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Created:</span>
              <span className="meta-value">
                {new Date(pickOrder.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Ordered By:</span>
              <span className="meta-value">
                {pickOrder.createdBy?.name || pickOrder.createdBy?.email || 'Unknown'}
              </span>
            </div>
          </div>

          <div className="meta-box">
            <h3>Progress</h3>
            <div className="meta-row">
              <span className="meta-label">Total Items:</span>
              <span className="meta-value">{totalItems}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Total Qty:</span>
              <span className="meta-value">{totalQty}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Picked:</span>
              <span className="meta-value">{pickedQty} / {totalQty}</span>
            </div>
          </div>
        </div>

        <div className="destination-box">
          <h3>Destination</h3>
          <p className="destination">{pickOrder.destination}</p>
          {pickOrder.destinationNotes && (
            <div className="notes">{pickOrder.destinationNotes}</div>
          )}
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>SKU / Item</th>
              <th>Customer</th>
              <th>Reference</th>
              <th>Location</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Qty</th>
              <th style={{ width: '50px', textAlign: 'center' }}>Done</th>
            </tr>
          </thead>
          <tbody>
            {itemsWithStock.map((item, index) => (
              <tr key={item.id}>
                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{index + 1}</td>
                <td>
                  <div className="sku">{item.item.sku}</div>
                  <div className="item-name">{item.item.name}</div>
                </td>
                <td>
                  {item.item.customer ? (
                    <span style={{ fontSize: '11px' }}>{item.item.customer.name}</span>
                  ) : (
                    <span style={{ color: '#9ca3af' }}>-</span>
                  )}
                </td>
                <td>
                  {item.referenceNumber ? (
                    <span className="ref-badge">{item.referenceNumber}</span>
                  ) : (
                    <span style={{ color: '#9ca3af' }}>-</span>
                  )}
                  {item.lotNumber && (
                    <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                      Lot: {item.lotNumber}
                    </div>
                  )}
                </td>
                <td>
                  {item.location ? (
                    <span className="location-badge">{item.location.barcode}</span>
                  ) : item.suggestedLocations && item.suggestedLocations.length > 0 ? (
                    <div>
                      <span style={{ color: '#9ca3af', fontSize: '10px' }}>Suggested:</span>
                      {item.suggestedLocations.map((loc: { barcode: string; name: string; available: number }, i: number) => (
                        <div key={i} className="suggested-locations">
                          <span className="location-badge" style={{ background: '#e5e7eb', color: '#374151' }}>
                            {loc.barcode}
                          </span>
                          <span style={{ marginLeft: '4px' }}>({loc.available} avail)</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: '#9ca3af' }}>Any</span>
                  )}
                </td>
                <td className="qty-cell">{item.requestedQty}</td>
                <td className="checkbox-cell">
                  <div className="checkbox" style={item.isPicked ? { background: '#10b981', borderColor: '#10b981' } : {}}></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="summary-box">
          <div className="summary-item">
            <div className="value">{totalItems}</div>
            <div className="label">Line Items</div>
          </div>
          <div className="summary-item">
            <div className="value">{totalQty}</div>
            <div className="label">Total Units</div>
          </div>
          <div className="summary-item">
            <div className="value">{pickOrder.priority.toUpperCase()}</div>
            <div className="label">Priority</div>
          </div>
        </div>

        {pickOrder.notes && (
          <div className="notes-section">
            <h3>Notes</h3>
            <div>{pickOrder.notes}</div>
          </div>
        )}

        <div className="signature-section">
          <div className="signature-box">
            <div className="label">Picked By: _________________________ Date: _________</div>
          </div>
          <div className="signature-box">
            <div className="label">Verified By: _________________________ Date: _________</div>
          </div>
        </div>

        <div className="footer">
          Pick Order {pickOrder.pickOrderNumber} | {membership.tenant.name} | Generated {new Date().toISOString()}
        </div>
      </div>
    </>
  )
}
