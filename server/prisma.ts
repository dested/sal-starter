import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { env } from './env'

// Singleton across HMR reloads — without this, vite dev creates a new
// PrismaClient on every change and exhausts Postgres connections.
declare global {
  var __prisma: PrismaClient | undefined
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  })

if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma

export type DB = typeof prisma
