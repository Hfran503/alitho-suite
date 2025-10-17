import { z } from 'zod'

// ============================================
// ORDER SCHEMAS
// ============================================

export const orderItemSchema = z.object({
  id: z.string().optional(),
  sku: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().positive('Unit price must be positive'),
  total: z.number(),
})

export const orderSchema = z.object({
  id: z.string().optional(),
  orderNumber: z.string().optional(),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).default('pending'),

  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: z.string().email('Invalid email'),
  customerPhone: z.string().optional(),

  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  currency: z.string().default('USD'),

  shippingAddress: z.record(z.any()).optional(),
  billingAddress: z.record(z.any()).optional(),

  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),

  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
})

export const createOrderSchema = orderSchema.omit({ id: true, orderNumber: true })
export const updateOrderSchema = orderSchema.partial().required({ id: true })

export type Order = z.infer<typeof orderSchema>
export type OrderItem = z.infer<typeof orderItemSchema>
export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>

// ============================================
// TENANT SCHEMAS
// ============================================

export const tenantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Tenant name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
  status: z.enum(['active', 'suspended', 'deleted']).default('active'),
  metadata: z.record(z.any()).optional(),
})

export const createTenantSchema = tenantSchema.omit({ id: true })
export const updateTenantSchema = tenantSchema.partial().required({ id: true })

export type Tenant = z.infer<typeof tenantSchema>
export type CreateTenantInput = z.infer<typeof createTenantSchema>
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>

// ============================================
// USER & MEMBERSHIP SCHEMAS
// ============================================

export const userSchema = z.object({
  id: z.string().optional(),
  email: z.string().email('Invalid email'),
  name: z.string().optional(),
  image: z.string().url().optional(),
})

export const membershipSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  tenantId: z.string(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']).default('member'),
})

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
  tenantId: z.string(),
})

export type User = z.infer<typeof userSchema>
export type Membership = z.infer<typeof membershipSchema>
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>

// ============================================
// ATTACHMENT SCHEMAS
// ============================================

export const attachmentSchema = z.object({
  id: z.string().optional(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(),
  bucket: z.string(),
  key: z.string(),
  url: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
})

export const createPresignedUploadSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  mimeType: z.string().min(1, 'MIME type is required'),
  size: z.number().positive('Size must be positive'),
  entityType: z.string().optional(), // e.g., 'order'
  entityId: z.string().optional(),
})

export type Attachment = z.infer<typeof attachmentSchema>
export type CreatePresignedUploadInput = z.infer<typeof createPresignedUploadSchema>

// ============================================
// AUDIT LOG SCHEMAS
// ============================================

export const auditLogSchema = z.object({
  id: z.string().optional(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().optional(),
  userId: z.string().optional(),
  actorName: z.string().optional(),
  actorEmail: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  tenantId: z.string(),
  createdAt: z.date().optional(),
})

export type AuditLog = z.infer<typeof auditLogSchema>

// ============================================
// JOB SCHEMAS
// ============================================

export const jobSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).default('pending'),
  payload: z.record(z.any()).optional(),
  result: z.record(z.any()).optional(),
  error: z.string().optional(),
  progress: z.number().min(0).max(100).default(0),
})

export const createExportJobSchema = z.object({
  type: z.enum(['csv', 'excel', 'pdf']),
  entityType: z.string(), // e.g., 'orders'
  filters: z.record(z.any()).optional(),
  tenantId: z.string(),
})

export type Job = z.infer<typeof jobSchema>
export type CreateExportJobInput = z.infer<typeof createExportJobSchema>

// ============================================
// API RESPONSE TYPES
// ============================================

export type ApiResponse<T = any> = {
  success: true
  data: T
} | {
  success: false
  error: string
  details?: any
}

export type PaginatedResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type PaginationParams = {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}
