import { z } from 'zod'

// ============================================
// WAREHOUSE MANAGEMENT SYSTEM TYPES
// ============================================

// Enum values matching Prisma schema
export const LocationType = {
  RECEIVING: 'RECEIVING',
  STORAGE: 'STORAGE',
  SHIPPING: 'SHIPPING',
  STAGING: 'STAGING',
  QUARANTINE: 'QUARANTINE',
} as const

export const InventoryTransactionType = {
  RECEIVE: 'RECEIVE',
  SHIP: 'SHIP',
  ADJUST: 'ADJUST',
  TRANSFER: 'TRANSFER',
  RESERVE: 'RESERVE',
  UNRESERVE: 'UNRESERVE',
  DAMAGE: 'DAMAGE',
} as const

export const ASNStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  IN_TRANSIT: 'IN_TRANSIT',
  ARRIVED: 'ARRIVED',
  RECEIVING: 'RECEIVING',
  RECEIVED: 'RECEIVED',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  CANCELLED: 'CANCELLED',
} as const

export const ReceivingStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  COMPLETED_WITH_DISCREPANCY: 'COMPLETED_WITH_DISCREPANCY',
} as const

export const FulfillmentTaskType = {
  PICK: 'PICK',
  PACK: 'PACK',
  SHIP: 'SHIP',
  PUT_AWAY: 'PUT_AWAY',
  COUNT: 'COUNT',
  TRANSFER: 'TRANSFER',
} as const

export const FulfillmentTaskStatus = {
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const

// ============================================
// ZOD SCHEMAS
// ============================================

// Location Type enum schema
export const locationTypeSchema = z.enum([
  'RECEIVING',
  'STORAGE',
  'SHIPPING',
  'STAGING',
  'QUARANTINE',
])

// Inventory Transaction Type enum schema
export const inventoryTransactionTypeSchema = z.enum([
  'RECEIVE',
  'SHIP',
  'ADJUST',
  'TRANSFER',
  'RESERVE',
  'UNRESERVE',
  'DAMAGE',
])

// ASN Status enum schema
export const asnStatusSchema = z.enum([
  'DRAFT',
  'PENDING',
  'IN_TRANSIT',
  'ARRIVED',
  'RECEIVING',
  'RECEIVED',
  'PARTIALLY_RECEIVED',
  'CANCELLED',
])

// Receiving Status enum schema
export const receivingStatusSchema = z.enum([
  'IN_PROGRESS',
  'COMPLETED',
  'COMPLETED_WITH_DISCREPANCY',
])

// Fulfillment Task Type enum schema
export const fulfillmentTaskTypeSchema = z.enum([
  'PICK',
  'PACK',
  'SHIP',
  'PUT_AWAY',
  'COUNT',
  'TRANSFER',
])

// Fulfillment Task Status enum schema
export const fulfillmentTaskStatusSchema = z.enum([
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
])

// ============================================
// WAREHOUSE LOCATION SCHEMAS
// ============================================

export const warehouseLocationSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string(),
  warehouseId: z.string(),
  zone: z.string().optional(),
  aisle: z.string().optional(),
  rack: z.string().optional(),
  shelf: z.string().optional(),
  bin: z.string().min(1, 'Bin identifier is required'),
  barcode: z.string().min(1, 'Barcode is required'),
  locationType: locationTypeSchema.default('STORAGE'),
  isActive: z.boolean().default(true),
  capacity: z.number().int().positive().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export const createWarehouseLocationSchema = warehouseLocationSchema.omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
})

export const updateWarehouseLocationSchema = warehouseLocationSchema.partial().required({
  id: true,
})

// ============================================
// INVENTORY ITEM (SKU) SCHEMAS
// ============================================

export const dimensionsSchema = z.object({
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  unit: z.enum(['in', 'cm', 'mm']).default('in'),
})

export const inventoryItemSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string(),
  sku: z.string().min(1, 'SKU is required'),
  upc: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  weight: z.number().positive().optional(),
  dimensions: dimensionsSchema.optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export const createInventoryItemSchema = inventoryItemSchema.omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
})

export const updateInventoryItemSchema = inventoryItemSchema.partial().required({
  id: true,
})

// ============================================
// INVENTORY STOCK SCHEMAS
// ============================================

export const inventoryStockSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string(),
  sku: z.string(),
  locationId: z.string(),
  available: z.number().int().min(0).default(0),
  reserved: z.number().int().min(0).default(0),
  damaged: z.number().int().min(0).default(0),
  onHold: z.number().int().min(0).default(0),
  lotNumber: z.string().optional(),
  expirationDate: z.date().optional(),
  updatedAt: z.date().optional(),
})

export const adjustStockSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  locationId: z.string().min(1, 'Location is required'),
  quantity: z.number().int(), // Can be negative for decrements
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional(),
  lotNumber: z.string().optional(),
})

export const transferStockSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  fromLocationId: z.string().min(1, 'From location is required'),
  toLocationId: z.string().min(1, 'To location is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  lotNumber: z.string().optional(),
  notes: z.string().optional(),
})

// ============================================
// INVENTORY TRANSACTION SCHEMAS
// ============================================

export const inventoryTransactionSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string(),
  sku: z.string(),
  locationId: z.string(),
  type: inventoryTransactionTypeSchema,
  quantity: z.number().int(),
  previousQty: z.number().int(),
  newQty: z.number().int(),
  referenceType: z.string().optional(), // ASN, ORDER, ADJUSTMENT, TRANSFER
  referenceId: z.string().optional(),
  userId: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.date().optional(),
})

// ============================================
// ASN (ADVANCED SHIPPING NOTICE) SCHEMAS
// ============================================

export const asnItemSchema = z.object({
  id: z.string().optional(),
  asnId: z.string().optional(),
  sku: z.string().min(1, 'SKU is required'),
  description: z.string().optional(),
  expectedQty: z.number().int().positive('Expected quantity must be positive'),
  receivedQty: z.number().int().min(0).default(0),
  lotNumber: z.string().optional(),
  expirationDate: z.date().optional(),
  metadata: z.record(z.any()).optional(),
})

export const asnSchema = z.object({
  id: z.string().optional(),
  asnNumber: z.string().optional(),
  tenantId: z.string(),
  vendorId: z.string().optional(),
  vendorName: z.string().optional(),
  expectedDate: z.date(),
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  status: asnStatusSchema.default('DRAFT'),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  items: z.array(asnItemSchema).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export const createAsnSchema = asnSchema.omit({
  id: true,
  asnNumber: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  items: z.array(asnItemSchema.omit({ id: true, asnId: true })).min(1, 'At least one item is required'),
})

export const updateAsnSchema = asnSchema.partial().required({
  id: true,
})

// ============================================
// RECEIVING SCHEMAS
// ============================================

export const receivingItemSchema = z.object({
  id: z.string().optional(),
  receivingRecordId: z.string().optional(),
  sku: z.string().min(1, 'SKU is required'),
  description: z.string().optional(),
  expectedQty: z.number().int().min(0).default(0),
  receivedQty: z.number().int().min(0),
  damagedQty: z.number().int().min(0).default(0),
  putAwayLocationId: z.string().optional(),
  lotNumber: z.string().optional(),
  expirationDate: z.date().optional(),
  notes: z.string().optional(),
})

export const receivingRecordSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string(),
  asnId: z.string().optional(),
  receivedById: z.string(),
  receivedAt: z.date().default(() => new Date()),
  status: receivingStatusSchema.default('IN_PROGRESS'),
  notes: z.string().optional(),
  discrepancyNotes: z.string().optional(),
  items: z.array(receivingItemSchema).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export const receiveItemInputSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  damagedQty: z.number().int().min(0).default(0),
  putAwayLocationId: z.string().optional(),
  lotNumber: z.string().optional(),
  expirationDate: z.date().optional(),
  notes: z.string().optional(),
})

// ============================================
// FULFILLMENT TASK SCHEMAS
// ============================================

export const fulfillmentItemSchema = z.object({
  id: z.string().optional(),
  taskId: z.string().optional(),
  sku: z.string(),
  description: z.string().optional(),
  quantity: z.number().int().positive(),
  pickedQty: z.number().int().min(0).default(0),
  fromLocationId: z.string().optional(),
  toLocationId: z.string().optional(),
  notes: z.string().optional(),
})

export const fulfillmentTaskSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string(),
  orderId: z.string().optional(),
  orderNumber: z.string().optional(),
  type: fulfillmentTaskTypeSchema,
  status: fulfillmentTaskStatusSchema.default('PENDING'),
  priority: z.number().int().min(0).default(0),
  assignedToId: z.string().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  items: z.array(fulfillmentItemSchema).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export const createFulfillmentTaskSchema = fulfillmentTaskSchema.omit({
  id: true,
  tenantId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
})

export const assignTaskSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  userId: z.string().min(1, 'User ID is required'),
})

// ============================================
// BULK LOCATION GENERATION SCHEMA
// ============================================

export const bulkLocationGeneratorSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse is required'),
  locationType: locationTypeSchema.default('STORAGE'),
  // Zone pattern: e.g., "A" to "C" generates A, B, C
  zoneStart: z.string().optional(),
  zoneEnd: z.string().optional(),
  // Aisle pattern: e.g., "01" to "10" generates 01, 02, ..., 10
  aisleStart: z.string().optional(),
  aisleEnd: z.string().optional(),
  // Rack pattern
  rackStart: z.string().optional(),
  rackEnd: z.string().optional(),
  // Shelf pattern
  shelfStart: z.string().optional(),
  shelfEnd: z.string().optional(),
  // Bin pattern
  binStart: z.string().optional(),
  binEnd: z.string().optional(),
  // Barcode prefix
  barcodePrefix: z.string().optional(),
})

// ============================================
// TYPE EXPORTS
// ============================================

export type LocationTypeValue = z.infer<typeof locationTypeSchema>
export type InventoryTransactionTypeValue = z.infer<typeof inventoryTransactionTypeSchema>
export type ASNStatusValue = z.infer<typeof asnStatusSchema>
export type ReceivingStatusValue = z.infer<typeof receivingStatusSchema>
export type FulfillmentTaskTypeValue = z.infer<typeof fulfillmentTaskTypeSchema>
export type FulfillmentTaskStatusValue = z.infer<typeof fulfillmentTaskStatusSchema>

export type WarehouseLocation = z.infer<typeof warehouseLocationSchema>
export type CreateWarehouseLocationInput = z.infer<typeof createWarehouseLocationSchema>
export type UpdateWarehouseLocationInput = z.infer<typeof updateWarehouseLocationSchema>

export type Dimensions = z.infer<typeof dimensionsSchema>
export type InventoryItem = z.infer<typeof inventoryItemSchema>
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>

export type InventoryStock = z.infer<typeof inventoryStockSchema>
export type AdjustStockInput = z.infer<typeof adjustStockSchema>
export type TransferStockInput = z.infer<typeof transferStockSchema>
export type InventoryTransaction = z.infer<typeof inventoryTransactionSchema>

export type ASNItem = z.infer<typeof asnItemSchema>
export type ASN = z.infer<typeof asnSchema>
export type CreateASNInput = z.infer<typeof createAsnSchema>
export type UpdateASNInput = z.infer<typeof updateAsnSchema>

export type ReceivingItem = z.infer<typeof receivingItemSchema>
export type ReceivingRecord = z.infer<typeof receivingRecordSchema>
export type ReceiveItemInput = z.infer<typeof receiveItemInputSchema>

export type FulfillmentItem = z.infer<typeof fulfillmentItemSchema>
export type FulfillmentTask = z.infer<typeof fulfillmentTaskSchema>
export type CreateFulfillmentTaskInput = z.infer<typeof createFulfillmentTaskSchema>
export type AssignTaskInput = z.infer<typeof assignTaskSchema>

export type BulkLocationGeneratorInput = z.infer<typeof bulkLocationGeneratorSchema>
