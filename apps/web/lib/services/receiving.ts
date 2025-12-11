import { db, ReceivingStatus } from '@repo/database'

// Types
export interface StartReceivingParams {
  tenantId: string
  warehouseId: string
  userId: string
  asnId?: string
  notes?: string
}

export interface RecordItemParams {
  receivingRecordId: string
  itemId?: string
  sku: string
  description: string
  expectedQty?: number
  receivedQty: number
  damagedQty?: number
  putAwayLocationId?: string
  lotNumber?: string
  expirationDate?: Date
  notes?: string
}

export interface CompleteReceivingParams {
  receivingRecordId: string
  tenantId: string
  userId: string
  discrepancyNotes?: string
}

// Start a new receiving session (with or without ASN)
export async function startReceiving(params: StartReceivingParams) {
  const { tenantId, warehouseId, userId, asnId, notes } = params

  return db.$transaction(async (tx) => {
    // If ASN provided, validate it exists and is in correct status
    if (asnId) {
      const asn = await tx.aSN.findFirst({
        where: { id: asnId, tenantId },
        include: { items: true, receivingRecord: { select: { id: true } } },
      })

      if (!asn) {
        throw new Error('ASN not found')
      }

      if (asn.receivingRecord) {
        throw new Error('ASN already has a receiving session')
      }

      if (!['ARRIVED', 'RECEIVING', 'PARTIALLY_RECEIVED'].includes(asn.status)) {
        throw new Error(`Cannot start receiving for ASN in status: ${asn.status}`)
      }

      // Create receiving record linked to ASN
      const receivingRecord = await tx.receivingRecord.create({
        data: {
          tenantId,
          warehouseId: asn.warehouseId,
          receivedById: userId,
          asnId,
          notes,
          status: 'IN_PROGRESS',
        },
        include: {
          asn: { include: { items: true } },
          warehouse: { select: { id: true, name: true } },
          receivedBy: { select: { id: true, name: true, email: true } },
        },
      })

      // Pre-populate receiving items from ASN items
      for (const asnItem of asn.items) {
        await tx.receivingItem.create({
          data: {
            receivingRecordId: receivingRecord.id,
            itemId: asnItem.itemId,
            sku: asnItem.sku,
            description: asnItem.description,
            expectedQty: asnItem.expectedQty,
            receivedQty: 0,
            damagedQty: 0,
            lotNumber: asnItem.lotNumber,
            expirationDate: asnItem.expirationDate,
          },
        })
      }

      // Update ASN status to RECEIVING
      await tx.aSN.update({
        where: { id: asnId },
        data: { status: 'RECEIVING' },
      })

      // Fetch the receiving record with items
      return tx.receivingRecord.findUnique({
        where: { id: receivingRecord.id },
        include: {
          asn: { include: { items: true } },
          warehouse: { select: { id: true, name: true } },
          receivedBy: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
              putAwayLocation: { select: { id: true, barcode: true, name: true } },
            },
          },
        },
      })
    }

    // Create receiving record without ASN
    const receivingRecord = await tx.receivingRecord.create({
      data: {
        tenantId,
        warehouseId,
        receivedById: userId,
        notes,
        status: 'IN_PROGRESS',
      },
      include: {
        warehouse: { select: { id: true, name: true } },
        receivedBy: { select: { id: true, name: true, email: true } },
        items: true,
      },
    })

    return receivingRecord
  })
}

// Record/update a received item
export async function recordItem(params: RecordItemParams) {
  const {
    receivingRecordId,
    itemId,
    sku,
    description,
    expectedQty = 0,
    receivedQty,
    damagedQty = 0,
    putAwayLocationId,
    lotNumber,
    expirationDate,
    notes,
  } = params

  // Check if item already exists in this receiving record
  const existingItem = await db.receivingItem.findFirst({
    where: {
      receivingRecordId,
      sku,
      lotNumber: lotNumber || null,
    },
  })

  if (existingItem) {
    // Update existing item
    return db.receivingItem.update({
      where: { id: existingItem.id },
      data: {
        receivedQty,
        damagedQty,
        putAwayLocationId,
        notes,
      },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        putAwayLocation: { select: { id: true, barcode: true, name: true } },
      },
    })
  }

  // Create new receiving item
  return db.receivingItem.create({
    data: {
      receivingRecordId,
      itemId,
      sku,
      description,
      expectedQty,
      receivedQty,
      damagedQty,
      putAwayLocationId,
      lotNumber,
      expirationDate,
      notes,
    },
    include: {
      item: { select: { id: true, sku: true, name: true } },
      putAwayLocation: { select: { id: true, barcode: true, name: true } },
    },
  })
}

// Update a receiving item
export async function updateReceivingItem(
  itemId: string,
  data: {
    receivedQty?: number
    damagedQty?: number
    putAwayLocationId?: string | null
    notes?: string
  }
) {
  return db.receivingItem.update({
    where: { id: itemId },
    data,
    include: {
      item: { select: { id: true, sku: true, name: true } },
      putAwayLocation: { select: { id: true, barcode: true, name: true } },
    },
  })
}

// Delete a receiving item
export async function deleteReceivingItem(itemId: string) {
  return db.receivingItem.delete({
    where: { id: itemId },
  })
}

// Complete receiving session and update inventory
export async function completeReceiving(params: CompleteReceivingParams) {
  const { receivingRecordId, tenantId, userId, discrepancyNotes } = params

  return db.$transaction(async (tx) => {
    // Get receiving record with items
    const receivingRecord = await tx.receivingRecord.findUnique({
      where: { id: receivingRecordId },
      include: {
        items: {
          include: {
            item: true,
            putAwayLocation: true,
          },
        },
        asn: { include: { items: true } },
      },
    })

    if (!receivingRecord) {
      throw new Error('Receiving record not found')
    }

    if (receivingRecord.tenantId !== tenantId) {
      throw new Error('Unauthorized')
    }

    if (receivingRecord.status !== 'IN_PROGRESS') {
      throw new Error(`Cannot complete receiving in status: ${receivingRecord.status}`)
    }

    // Check for discrepancies
    let hasDiscrepancy = false
    let totalExpected = 0
    let totalReceived = 0
    let totalDamaged = 0

    for (const item of receivingRecord.items) {
      totalExpected += item.expectedQty
      totalReceived += item.receivedQty
      totalDamaged += item.damagedQty

      if (item.expectedQty !== item.receivedQty + item.damagedQty) {
        hasDiscrepancy = true
      }
    }

    // Determine final status
    const status: ReceivingStatus = hasDiscrepancy ? 'COMPLETED_WITH_DISCREPANCY' : 'COMPLETED'

    // Update inventory for each item that has a put-away location
    for (const item of receivingRecord.items) {
      if (item.putAwayLocationId && item.receivedQty > 0) {
        // Need to find or create the inventory item first
        let inventoryItemId = item.itemId

        if (!inventoryItemId) {
          // Check if item exists by SKU
          const existingItem = await tx.inventoryItem.findFirst({
            where: { tenantId, sku: item.sku },
          })

          if (existingItem) {
            inventoryItemId = existingItem.id
          } else {
            // Create new inventory item
            const newItem = await tx.inventoryItem.create({
              data: {
                tenantId,
                sku: item.sku,
                name: item.description,
                description: item.description,
                isActive: true,
              },
            })
            inventoryItemId = newItem.id

            // Update receiving item with the new item ID
            await tx.receivingItem.update({
              where: { id: item.id },
              data: { itemId: inventoryItemId },
            })
          }
        }

        // Get or create stock record
        let stock = await tx.inventoryStock.findFirst({
          where: {
            tenantId,
            itemId: inventoryItemId,
            locationId: item.putAwayLocationId,
            lotNumber: item.lotNumber || null,
          },
        })

        if (!stock) {
          stock = await tx.inventoryStock.create({
            data: {
              tenantId,
              itemId: inventoryItemId,
              locationId: item.putAwayLocationId,
              lotNumber: item.lotNumber || null,
              expirationDate: item.expirationDate,
              available: 0,
              reserved: 0,
              damaged: 0,
              onHold: 0,
            },
          })
        }

        // Add received quantity to available
        const previousAvailable = stock.available
        const newAvailable = previousAvailable + item.receivedQty

        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: { available: newAvailable },
        })

        // Create receive transaction
        await tx.inventoryTransaction.create({
          data: {
            tenantId,
            itemId: inventoryItemId,
            locationId: item.putAwayLocationId,
            type: 'RECEIVE',
            quantity: item.receivedQty,
            previousQty: previousAvailable,
            newQty: newAvailable,
            referenceType: 'RECEIVING',
            referenceId: receivingRecordId,
            userId,
            notes: `Received from receiving session${receivingRecord.asnId ? ` (ASN)` : ''}`,
          },
        })

        // Add damaged quantity if any
        if (item.damagedQty > 0) {
          const previousDamaged = stock.damaged
          const newDamaged = previousDamaged + item.damagedQty

          await tx.inventoryStock.update({
            where: { id: stock.id },
            data: { damaged: newDamaged },
          })

          await tx.inventoryTransaction.create({
            data: {
              tenantId,
              itemId: inventoryItemId,
              locationId: item.putAwayLocationId,
              type: 'DAMAGE',
              quantity: item.damagedQty,
              previousQty: previousDamaged,
              newQty: newDamaged,
              referenceType: 'RECEIVING',
              referenceId: receivingRecordId,
              userId,
              notes: `Damaged items from receiving session`,
            },
          })
        }
      }
    }

    // Update receiving record
    const updatedRecord = await tx.receivingRecord.update({
      where: { id: receivingRecordId },
      data: {
        status,
        completedAt: new Date(),
        discrepancyNotes: hasDiscrepancy ? discrepancyNotes : null,
      },
    })

    // Update ASN if linked
    if (receivingRecord.asnId) {
      // Update ASN item received quantities
      for (const receivingItem of receivingRecord.items) {
        // Find matching ASN item
        const asnItem = receivingRecord.asn?.items.find(
          (ai) => ai.sku === receivingItem.sku && ai.lotNumber === receivingItem.lotNumber
        )

        if (asnItem) {
          await tx.aSNItem.update({
            where: { id: asnItem.id },
            data: { receivedQty: receivingItem.receivedQty },
          })
        }
      }

      // Determine ASN status
      const asnStatus = hasDiscrepancy ? 'PARTIALLY_RECEIVED' : 'RECEIVED'
      await tx.aSN.update({
        where: { id: receivingRecord.asnId },
        data: {
          status: asnStatus,
          receivedAt: new Date(),
        },
      })
    }

    return {
      receivingRecord: updatedRecord,
      summary: {
        totalExpected,
        totalReceived,
        totalDamaged,
        hasDiscrepancy,
        status,
      },
    }
  })
}

// Get receiving record by ID
export async function getReceivingRecord(id: string, tenantId: string) {
  return db.receivingRecord.findFirst({
    where: { id, tenantId },
    include: {
      asn: {
        include: {
          items: true,
          warehouse: { select: { id: true, name: true } },
        },
      },
      warehouse: { select: { id: true, name: true } },
      receivedBy: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          item: { select: { id: true, sku: true, name: true } },
          putAwayLocation: { select: { id: true, barcode: true, name: true } },
        },
      },
    },
  })
}

// List receiving records
export async function listReceivingRecords(
  tenantId: string,
  filters: {
    warehouseId?: string
    status?: ReceivingStatus
    hasAsn?: boolean
    limit?: number
    offset?: number
  }
) {
  const where: {
    tenantId: string
    warehouseId?: string
    status?: ReceivingStatus
    asnId?: { not: null } | null
  } = {
    tenantId,
    ...(filters.warehouseId && { warehouseId: filters.warehouseId }),
    ...(filters.status && { status: filters.status }),
    ...(filters.hasAsn !== undefined && {
      asnId: filters.hasAsn ? { not: null } : null,
    }),
  }

  const [records, total] = await Promise.all([
    db.receivingRecord.findMany({
      where,
      include: {
        asn: { select: { id: true, asnNumber: true, vendorName: true } },
        warehouse: { select: { id: true, name: true } },
        receivedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    }),
    db.receivingRecord.count({ where }),
  ])

  return { records, total }
}
