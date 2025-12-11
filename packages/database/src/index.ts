import { PrismaClient, Prisma, InventoryTransactionType, LocationType, ASNStatus, ReceivingStatus } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

let prismaInstance: PrismaClient | undefined

// Initialize Neon adapter asynchronously (only in production with Neon)
async function createPrismaClientWithNeon(): Promise<PrismaClient> {
  const { neonConfig } = await import('@neondatabase/serverless')
  const { PrismaNeon } = await import('@prisma/adapter-neon')
  const ws = (await import('ws')).default

  // Configure WebSocket for Neon serverless
  neonConfig.webSocketConstructor = ws

  const connectionString = process.env.DATABASE_URL!
  const adapter = new PrismaNeon({ connectionString })

  return new PrismaClient({
    adapter,
    log: ['error'],
  } as any)
}

function getPrismaClient(): PrismaClient {
  if (prismaInstance) {
    return prismaInstance
  }

  if (global.prisma) {
    prismaInstance = global.prisma
    return prismaInstance
  }

  // Development: use standard Prisma connection
  prismaInstance = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

  if (process.env.NODE_ENV !== 'production') {
    global.prisma = prismaInstance
  }

  return prismaInstance
}

// Initialize the client - in production with Neon, use the serverless adapter
const isProduction = process.env.NODE_ENV === 'production'
const useNeonAdapter = isProduction && process.env.DATABASE_URL?.includes('neon.tech')

if (useNeonAdapter) {
  // Initialize async - the Proxy will handle waiting for it
  createPrismaClientWithNeon().then(client => {
    prismaInstance = client
    if (process.env.NODE_ENV !== 'production') {
      global.prisma = client
    }
  }).catch(err => {
    console.error('Failed to initialize Neon adapter, falling back to standard connection:', err)
    prismaInstance = getPrismaClient()
  })
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient()
    return (client as any)[prop]
  },
})

export type { PrismaClient }
export { Prisma, InventoryTransactionType, LocationType, ASNStatus, ReceivingStatus }
