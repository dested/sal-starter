import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { E2E_DATABASE_URL } from '../e2e/db'
import globalSetup from '../e2e/global-setup'
import { PrismaClient } from './generated/prisma/client'
import { backoffMs, defineJob, runDueJobs, type EnqueueOptions } from './jobs'

// Runs against the isolated e2e database (`<db>_test`, created, migrated and
// truncated by global-setup) through its own client, never the dev DB.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: E2E_DATABASE_URL, options: '-c TimeZone=UTC' }),
})
const db = { db: prisma } satisfies EnqueueOptions
const run = (now?: () => Date) => runDueJobs({ db: prisma, ...(now ? { now } : {}) })

beforeAll(async () => {
  await globalSetup()
})
afterAll(async () => {
  await prisma.$disconnect()
})

describe('jobs', () => {
  test('enqueue is typed and parsed; a due job runs once and is done', async () => {
    const seen: string[] = []
    const job = defineJob('test.hello', z.object({ name: z.string() }), async ({ name }) => {
      seen.push(name)
    })
    const id = await job.enqueue({ name: 'ada' }, db)
    expect(await run()).toBe(1)
    expect(await run()).toBe(0)
    expect(seen).toEqual(['ada'])
    expect(await prisma.job.findUnique({ where: { id: id ?? '' } })).toMatchObject({
      state: 'done',
      attempts: 1,
    })
  })

  test('a key dedupes while the job waits', async () => {
    const job = defineJob('test.dedupe', z.object({}), async () => {})
    expect(await job.enqueue({}, { ...db, key: 'k' })).not.toBeNull()
    expect(await job.enqueue({}, { ...db, key: 'k' })).toBeNull()
    await run()
    expect(await job.enqueue({}, { ...db, key: 'k' })).not.toBeNull()
  })

  test('a failure waits out the backoff, then fails for good at maxAttempts', async () => {
    const job = defineJob('test.flaky', z.object({}), async () => {
      throw new Error('boom')
    })
    const id = (await job.enqueue({}, { ...db, maxAttempts: 2 })) ?? ''
    const t0 = Date.now()
    await run(() => new Date(t0))
    const waiting = await prisma.job.findUniqueOrThrow({ where: { id } })
    expect(waiting).toMatchObject({ state: 'waiting', attempts: 1 })
    expect(waiting.lastError).toContain('boom')
    expect(waiting.runAfter.getTime()).toBe(t0 + backoffMs(1))
    // Not due yet, then due.
    expect(await run(() => new Date(t0 + 1_000))).toBe(0)
    await run(() => new Date(t0 + backoffMs(1)))
    expect(await prisma.job.findUniqueOrThrow({ where: { id } })).toMatchObject({
      state: 'failed',
      attempts: 2,
    })
  })

  test('concurrent runners never take the same job (SKIP LOCKED)', async () => {
    let runs = 0
    const job = defineJob('test.race', z.object({ n: z.number() }), async () => {
      runs++
      await new Promise((r) => setTimeout(r, 5))
    })
    for (let n = 0; n < 20; n++) await job.enqueue({ n }, db)
    const [a, b, c] = await Promise.all([run(), run(), run()])
    expect((a ?? 0) + (b ?? 0) + (c ?? 0)).toBe(20)
    expect(runs).toBe(20)
  })

  test('backoff doubles from 30 s and caps at an hour', () => {
    expect([1, 2, 3].map(backoffMs)).toEqual([30_000, 60_000, 120_000])
    expect(backoffMs(20)).toBe(60 * 60_000)
  })
})
