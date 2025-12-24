import { PrismaClient, Prisma } from '@prisma/client'

// Define enums locally to avoid Prisma client generation timing issues in monorepo builds
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
export type ASNStatus = (typeof ASNStatus)[keyof typeof ASNStatus]

export const ReceivingStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  COMPLETED_WITH_DISCREPANCY: 'COMPLETED_WITH_DISCREPANCY',
} as const
export type ReceivingStatus = (typeof ReceivingStatus)[keyof typeof ReceivingStatus]

export const InventoryTransactionType = {
  RECEIVE: 'RECEIVE',
  SHIP: 'SHIP',
  ADJUST: 'ADJUST',
  TRANSFER: 'TRANSFER',
  RESERVE: 'RESERVE',
  UNRESERVE: 'UNRESERVE',
  DAMAGE: 'DAMAGE',
  PICK: 'PICK',
  KIT_ASSEMBLE: 'KIT_ASSEMBLE',
  KIT_PRODUCE: 'KIT_PRODUCE',
} as const
export type InventoryTransactionType = (typeof InventoryTransactionType)[keyof typeof InventoryTransactionType]

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

let prismaInstance: PrismaClient | undefined

function getPrismaClient(): PrismaClient {
  if (prismaInstance) {
    return prismaInstance
  }

  if (global.prisma) {
    prismaInstance = global.prisma
    return prismaInstance
  }

  prismaInstance = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

  if (process.env.NODE_ENV !== 'production') {
    global.prisma = prismaInstance
  }

  return prismaInstance
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient()
    return (client as any)[prop]
  },
})

export type { PrismaClient }
export { Prisma }
// Re-export all types from Prisma client for convenience
export type * from '@prisma/client'
