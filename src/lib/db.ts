import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['warn', 'error'],
  })

// Enforce AuditLog immutability: prevent updates and deletes at the Prisma level
// Using Prisma client extensions ($extends) since $use middleware was removed in Prisma 5+
export const db = prismaClient.$extends({
  query: {
    AuditLog: {
      async update({ model, operation }) {
        throw new Error(`AuditLog records are immutable. ${operation} operation is not allowed on AuditLog model.`)
      },
      async updateMany({ model, operation }) {
        throw new Error(`AuditLog records are immutable. ${operation} operation is not allowed on AuditLog model.`)
      },
      async delete({ model, operation }) {
        throw new Error(`AuditLog records are immutable. ${operation} operation is not allowed on AuditLog model.`)
      },
      async deleteMany({ model, operation }) {
        throw new Error(`AuditLog records are immutable. ${operation} operation is not allowed on AuditLog model.`)
      },
    },
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaClient
