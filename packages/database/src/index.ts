import { PrismaClient, Prisma } from '@prisma/client'

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
