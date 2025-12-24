import { db, Prisma } from '@repo/database'

// Inventory transaction type derived from Prisma schema
type InventoryTransactionType = 'RECEIVE' | 'SHIP' | 'ADJUST' | 'TRANSFER' | 'RESERVE' | 'UNRESERVE' | 'DAMAGE' | 'PICK' | 'KIT_ASSEMBLE' | 'KIT_PRODUCE'

// Types
export interface StockAdjustmentParams {
  tenantId: string
  itemId: string
  locationId: string
  quantity: number // positive to add, negative to subtract
  type: InventoryTransactionType
  userId?: string
  notes?: string
  referenceType?: string
  referenceId?: string
  lotNumber?: string
}

export interface StockTransferParams {
  tenantId: string
  itemId: string
  fromLocationId: string
  toLocationId: string
  quantity: number
  userId?: string
  notes?: string
  lotNumber?: string
}

export interface ReserveStockParams {
  tenantId: string
  itemId: string
  locationId: string
  quantity: number
  userId?: string
  referenceType?: string
  referenceId?: string
  notes?: string
  lotNumber?: string
}

// Get stock by item across all locations
export async function getStockByItem(
  tenantId: string,
  itemId: string
): Promise<{
  item: { id: string; sku: string | null; name: string; trackByReference: boolean } | null
  totalAvailable: number
  totalReserved: number
  totalDamaged: number
  totalOnHold: number
  locations: Array<{
    location: { id: string; barcode: string; name: string | null; warehouseId: string }
    available: number
    reserved: number
    damaged: number
    onHold: number
    lotNumber: string | null
    referenceNumber: string | null
  }>
}> {
  const stockRecords = await db.inventoryStock.findMany({
    where: { tenantId, itemId },
    include: {
      item: { select: { id: true, sku: true, name: true, trackByReference: true } },
      location: { select: { id: true, barcode: true, name: true, warehouseId: true } },
    },
  })

  if (stockRecords.length === 0) {
    const item = await db.inventoryItem.findFirst({
      where: { id: itemId, tenantId },
      select: { id: true, sku: true, name: true, trackByReference: true },
    })
    return {
      item,
      totalAvailable: 0,
      totalReserved: 0,
      totalDamaged: 0,
      totalOnHold: 0,
      locations: [],
    }
  }

  const totals = stockRecords.reduce(
    (acc: { totalAvailable: number; totalReserved: number; totalDamaged: number; totalOnHold: number }, record: (typeof stockRecords)[number]) => ({
      totalAvailable: acc.totalAvailable + record.available,
      totalReserved: acc.totalReserved + record.reserved,
      totalDamaged: acc.totalDamaged + record.damaged,
      totalOnHold: acc.totalOnHold + record.onHold,
    }),
    { totalAvailable: 0, totalReserved: 0, totalDamaged: 0, totalOnHold: 0 }
  )

  return {
    item: stockRecords[0].item,
    ...totals,
    locations: stockRecords.map((record: (typeof stockRecords)[number]) => ({
      location: record.location,
      available: record.available,
      reserved: record.reserved,
      damaged: record.damaged,
      onHold: record.onHold,
      lotNumber: record.lotNumber,
      referenceNumber: record.referenceNumber,
    })),
  }
}

// Get all stock at a specific location
export async function getStockByLocation(
  tenantId: string,
  locationId: string
): Promise<Array<{
  item: { id: string; sku: string | null; name: string }
  available: number
  reserved: number
  damaged: number
  onHold: number
  lotNumber: string | null
  referenceNumber: string | null
}>> {
  const stockRecords = await db.inventoryStock.findMany({
    where: { tenantId, locationId },
    include: {
      item: { select: { id: true, sku: true, name: true } },
    },
  })

  return stockRecords.map((record: (typeof stockRecords)[number]) => ({
    item: record.item,
    available: record.available,
    reserved: record.reserved,
    damaged: record.damaged,
    onHold: record.onHold,
    lotNumber: record.lotNumber,
    referenceNumber: record.referenceNumber,
  }))
}

// Adjust stock (add/remove inventory)
export async function adjustStock(params: StockAdjustmentParams) {
  const {
    tenantId,
    itemId,
    locationId,
    quantity,
    type,
    userId,
    notes,
    referenceType,
    referenceId,
    lotNumber,
  } = params

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    // Get or create stock record
    let stock = await tx.inventoryStock.findFirst({
      where: {
        tenantId,
        itemId,
        locationId,
        lotNumber: lotNumber || null,
      },
    })

    if (!stock) {
      stock = await tx.inventoryStock.create({
        data: {
          tenantId,
          itemId,
          locationId,
          lotNumber: lotNumber || null,
          available: 0,
          reserved: 0,
          damaged: 0,
          onHold: 0,
        },
      })
    }

    const previousQty = stock.available
    let newQty = previousQty

    // Determine which field to update based on type
    let updateField: 'available' | 'damaged' | 'onHold' = 'available'
    if (type === 'DAMAGE') {
      updateField = 'damaged'
      newQty = stock.damaged + quantity
    } else if (type === 'RESERVE' || type === 'UNRESERVE') {
      // Reservations are handled separately
      throw new Error('Use reserveStock or releaseReservation for reservations')
    } else {
      newQty = previousQty + quantity
    }

    // Validate new quantity isn't negative (unless it's a removal/damage)
    if (updateField === 'available' && newQty < 0) {
      throw new Error(`Insufficient stock. Available: ${previousQty}, Requested: ${Math.abs(quantity)}`)
    }

    // Update stock
    const updatedStock = await tx.inventoryStock.update({
      where: { id: stock.id },
      data: { [updateField]: newQty },
    })

    // Create transaction record
    const transaction = await tx.inventoryTransaction.create({
      data: {
        tenantId,
        itemId,
        locationId,
        type,
        quantity,
        previousQty: updateField === 'available' ? previousQty : stock[updateField],
        newQty,
        referenceType,
        referenceId,
        userId,
        notes,
      },
    })

    return { stock: updatedStock, transaction }
  })
}

// Transfer stock between locations
export async function transferStock(params: StockTransferParams) {
  const {
    tenantId,
    itemId,
    fromLocationId,
    toLocationId,
    quantity,
    userId,
    notes,
    lotNumber,
  } = params

  if (quantity <= 0) {
    throw new Error('Transfer quantity must be positive')
  }

  if (fromLocationId === toLocationId) {
    throw new Error('Source and destination locations must be different')
  }

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    // Get source stock
    const sourceStock = await tx.inventoryStock.findFirst({
      where: {
        tenantId,
        itemId,
        locationId: fromLocationId,
        lotNumber: lotNumber || null,
      },
    })

    if (!sourceStock || sourceStock.available < quantity) {
      throw new Error(
        `Insufficient stock at source location. Available: ${sourceStock?.available || 0}, Requested: ${quantity}`
      )
    }

    // Get or create destination stock
    let destStock = await tx.inventoryStock.findFirst({
      where: {
        tenantId,
        itemId,
        locationId: toLocationId,
        lotNumber: lotNumber || null,
      },
    })

    if (!destStock) {
      destStock = await tx.inventoryStock.create({
        data: {
          tenantId,
          itemId,
          locationId: toLocationId,
          lotNumber: lotNumber || null,
          available: 0,
          reserved: 0,
          damaged: 0,
          onHold: 0,
        },
      })
    }

    // Update source stock (subtract)
    const sourcePreviousQty = sourceStock.available
    const sourceNewQty = sourcePreviousQty - quantity
    await tx.inventoryStock.update({
      where: { id: sourceStock.id },
      data: { available: sourceNewQty },
    })

    // Update destination stock (add)
    const destPreviousQty = destStock.available
    const destNewQty = destPreviousQty + quantity
    await tx.inventoryStock.update({
      where: { id: destStock.id },
      data: { available: destNewQty },
    })

    // Create transfer transaction records
    const sourceTransaction = await tx.inventoryTransaction.create({
      data: {
        tenantId,
        itemId,
        locationId: fromLocationId,
        type: 'TRANSFER',
        quantity: -quantity,
        previousQty: sourcePreviousQty,
        newQty: sourceNewQty,
        referenceType: 'TRANSFER',
        referenceId: toLocationId,
        userId,
        notes: notes || `Transfer to location`,
      },
    })

    const destTransaction = await tx.inventoryTransaction.create({
      data: {
        tenantId,
        itemId,
        locationId: toLocationId,
        type: 'TRANSFER',
        quantity,
        previousQty: destPreviousQty,
        newQty: destNewQty,
        referenceType: 'TRANSFER',
        referenceId: fromLocationId,
        userId,
        notes: notes || `Transfer from location`,
      },
    })

    return {
      sourceTransaction,
      destTransaction,
    }
  })
}

// Reserve stock for an order
export async function reserveStock(params: ReserveStockParams) {
  const {
    tenantId,
    itemId,
    locationId,
    quantity,
    userId,
    referenceType,
    referenceId,
    notes,
    lotNumber,
  } = params

  if (quantity <= 0) {
    throw new Error('Reserve quantity must be positive')
  }

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const stock = await tx.inventoryStock.findFirst({
      where: {
        tenantId,
        itemId,
        locationId,
        lotNumber: lotNumber || null,
      },
    })

    if (!stock || stock.available < quantity) {
      throw new Error(
        `Insufficient available stock. Available: ${stock?.available || 0}, Requested: ${quantity}`
      )
    }

    const previousAvailable = stock.available
    const previousReserved = stock.reserved
    const newAvailable = previousAvailable - quantity
    const newReserved = previousReserved + quantity

    // Update stock
    await tx.inventoryStock.update({
      where: { id: stock.id },
      data: {
        available: newAvailable,
        reserved: newReserved,
      },
    })

    // Create transaction
    const transaction = await tx.inventoryTransaction.create({
      data: {
        tenantId,
        itemId,
        locationId,
        type: 'RESERVE',
        quantity: -quantity, // Negative because it's reducing available
        previousQty: previousAvailable,
        newQty: newAvailable,
        referenceType,
        referenceId,
        userId,
        notes,
      },
    })

    return { transaction }
  })
}

// Release reserved stock (cancel order or back to available)
export async function releaseReservation(params: ReserveStockParams) {
  const {
    tenantId,
    itemId,
    locationId,
    quantity,
    userId,
    referenceType,
    referenceId,
    notes,
    lotNumber,
  } = params

  if (quantity <= 0) {
    throw new Error('Release quantity must be positive')
  }

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const stock = await tx.inventoryStock.findFirst({
      where: {
        tenantId,
        itemId,
        locationId,
        lotNumber: lotNumber || null,
      },
    })

    if (!stock || stock.reserved < quantity) {
      throw new Error(
        `Insufficient reserved stock. Reserved: ${stock?.reserved || 0}, Requested: ${quantity}`
      )
    }

    const previousAvailable = stock.available
    const previousReserved = stock.reserved
    const newAvailable = previousAvailable + quantity
    const newReserved = previousReserved - quantity

    // Update stock
    await tx.inventoryStock.update({
      where: { id: stock.id },
      data: {
        available: newAvailable,
        reserved: newReserved,
      },
    })

    // Create transaction
    const transaction = await tx.inventoryTransaction.create({
      data: {
        tenantId,
        itemId,
        locationId,
        type: 'UNRESERVE',
        quantity, // Positive because it's adding back to available
        previousQty: previousAvailable,
        newQty: newAvailable,
        referenceType,
        referenceId,
        userId,
        notes,
      },
    })

    return { transaction }
  })
}

// Get transaction history
export async function getTransactions(
  tenantId: string,
  filters: {
    itemId?: string
    locationId?: string
    type?: InventoryTransactionType
    startDate?: Date
    endDate?: Date
    limit?: number
    offset?: number
  }
) {
  const where: Prisma.InventoryTransactionWhereInput = {
    tenantId,
    ...(filters.itemId && { itemId: filters.itemId }),
    ...(filters.locationId && { locationId: filters.locationId }),
    ...(filters.type && { type: filters.type }),
    ...((filters.startDate || filters.endDate) && {
      createdAt: {
        ...(filters.startDate && { gte: filters.startDate }),
        ...(filters.endDate && { lte: filters.endDate }),
      },
    }),
  }

  const [transactions, total] = await Promise.all([
    db.inventoryTransaction.findMany({
      where,
      include: {
        item: { select: { id: true, sku: true, name: true } },
        location: { select: { id: true, barcode: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    }),
    db.inventoryTransaction.count({ where }),
  ])

  return { transactions, total }
}
