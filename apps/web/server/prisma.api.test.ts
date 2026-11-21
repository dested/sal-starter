import { describe, expect, test } from 'bun:test'
import { prisma } from './prisma'

// Outside production the client lives on globalThis, so a dev reload (Vite
// HMR re-imports server modules) reuses one pool instead of opening another per
// save until Postgres runs out of connections. test/preload.api.ts relies on it
// too, to close the pool before dropping the clone.
describe('prisma client', () => {
  test('is reused across reloads outside production', async () => {
    expect(process.env.NODE_ENV).not.toBe('production')
    expect(globalThis.__prisma).toBe(prisma)
    expect(await prisma.$queryRaw`SELECT 1 AS one`).toEqual([{ one: 1 }])
  })
})
