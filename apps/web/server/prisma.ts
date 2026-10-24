import { PrismaClient } from './generated/prisma/client'
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
    // Sessions run in UTC. Prisma stores DateTime as `timestamp` (no zone), and
    // under a non-UTC server zone the pg adapter shifts values by the offset.
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL, options: '-c TimeZone=UTC' }),
  })

if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma

export type DB = typeof prisma
