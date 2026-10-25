// Background work in the web process, on Postgres: a `job` row per piece of
// work, no Redis. Runners claim due rows with FOR UPDATE SKIP LOCKED, so any
// number of processes never take the same job. Delivery is at-least-once:
// handlers must be safe to run twice.
//
//   export const sendWelcome = defineJob('email.welcome', z.object({ userId: z.string() }),
//     async ({ userId }) => { … })
//   await sendWelcome.enqueue({ userId }, { key: userId })   // typed by the zod schema
//
// A failure retries after 30 s, 1 min, 2 min, … (capped at 1 h) until the
// job's maxAttempts, then stays `failed` with its last error. A job left
// `running` by a runner that died is taken again after STALE_MS. server.ts
// starts the runner after listen and stops it on SIGTERM (server/shutdown.ts).
import { z } from 'zod'
import type { Prisma } from './generated/prisma/client'
import { formatError, log } from './logger'
import { prisma, type DB } from './prisma'

export const BACKOFF_MS = 30_000
export const MAX_BACKOFF_MS = 60 * 60_000
/** A `running` job locked longer than this belongs to a runner that died */
export const STALE_MS = 10 * 60_000

type Tx = Prisma.TransactionClient

/** Job data is a JSON object (what `payload` stores). */
const JobPayload = z.record(z.string(), z.json(), { error: 'job data must be a JSON object' })

type Registered = { schema: z.ZodType; run: (data: unknown) => Promise<void> }
const handlers = new Map<string, Registered>()

export type EnqueueOptions = {
  /** At most one waiting or running job per (kind, key): a second enqueue returns null */
  key?: string
  runAfter?: Date
  maxAttempts?: number
  /** Enqueue inside your transaction, so the job exists only if the transaction commits */
  tx?: Tx
  /** Another client (tests); default the app's */
  db?: DB
}

export type JobDefinition<S extends z.ZodType> = {
  kind: string
  enqueue: (data: z.input<S>, options?: EnqueueOptions) => Promise<string | null>
}

/** Register a job kind. Its data is parsed with `schema` on enqueue and again on run. */
export function defineJob<S extends z.ZodType>(
  kind: string,
  schema: S,
  run: (data: z.output<S>) => Promise<void>
): JobDefinition<S> {
  // Dev re-imports a module after an edit; the newer handler wins. Twice in production is a bug.
  if (handlers.has(kind) && process.env.NODE_ENV === 'production') {
    throw new Error(`job kind "${kind}" is defined twice`)
  }
  handlers.set(kind, { schema, run: (data) => run(schema.parse(data)) })
  return {
    kind,
    enqueue: async (data, options = {}) => {
      const payload = JobPayload.parse(schema.parse(data))
      const insert = (tx: Tx) => enqueueRow(tx, kind, payload, options)
      return options.tx ? insert(options.tx) : (options.db ?? prisma).$transaction(insert)
    },
  }
}

async function enqueueRow(
  tx: Tx,
  kind: string,
  payload: Prisma.InputJsonObject,
  options: EnqueueOptions
): Promise<string | null> {
  if (options.key !== undefined) {
    // Held until commit, so two enqueues with the same key can't both pass the check.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${kind}), hashtext(${options.key}))`
    const live = await tx.job.findFirst({
      where: { kind, key: options.key, state: { in: ['waiting', 'running'] } },
      select: { id: true },
    })
    if (live) return null
  }
  const row = await tx.job.create({
    data: {
      kind,
      key: options.key ?? null,
      payload,
      runAfter: options.runAfter ?? new Date(),
      ...(options.maxAttempts !== undefined ? { maxAttempts: options.maxAttempts } : {}),
    },
    select: { id: true },
  })
  return row.id
}

const Claimed = z.array(
  z.object({
    id: z.string(),
    kind: z.string(),
    payload: z.json(),
    attempts: z.number(),
    maxAttempts: z.number(),
  })
)
type ClaimedJob = z.infer<typeof Claimed>[number]

/** Claim up to `limit` due jobs of the registered kinds; each claim counts as an attempt. */
async function claim(db: DB, limit: number, now: Date): Promise<ClaimedJob[]> {
  const kinds = [...handlers.keys()]
  if (kinds.length === 0 || limit <= 0) return []
  const stale = new Date(now.getTime() - STALE_MS)
  const rows: unknown = await db.$queryRaw`
    UPDATE "job" SET "state" = 'running', "locked_at" = ${now},
      "attempts" = "attempts" + 1, "updated_at" = ${now}
    WHERE "id" IN (
      SELECT "id" FROM "job"
      WHERE "kind" = ANY(${kinds})
        AND (("state" = 'waiting' AND "run_after" <= ${now})
          OR ("state" = 'running' AND "locked_at" < ${stale}))
      ORDER BY "run_after"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "kind", "payload", "attempts", "max_attempts" AS "maxAttempts"`
  return Claimed.parse(rows)
}

export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS)
}

async function runJob(db: DB, job: ClaimedJob, now: () => Date): Promise<void> {
  const handler = handlers.get(job.kind)
  if (!handler) return
  try {
    await handler.run(job.payload)
    await db.job.update({
      where: { id: job.id },
      data: { state: 'done', lockedAt: null, lastError: null },
    })
  } catch (e) {
    const lastError = formatError(e).slice(0, 4000)
    const final = job.attempts >= job.maxAttempts
    log.error(
      `[jobs] ${job.kind} ${job.id} attempt ${job.attempts}/${job.maxAttempts} failed${final ? ' for good' : ''}: ${lastError}`
    )
    await db.job.update({
      where: { id: job.id },
      data: final
        ? { state: 'failed', lockedAt: null, lastError }
        : {
            state: 'waiting',
            lockedAt: null,
            lastError,
            runAfter: new Date(now().getTime() + backoffMs(job.attempts)),
          },
    })
  }
}

/** Run every due job once, `concurrency` at a time; resolves with how many ran. For tests and scripts. */
export async function runDueJobs({
  db = prisma,
  concurrency = 4,
  now = () => new Date(),
}: { db?: DB; concurrency?: number; now?: () => Date } = {}): Promise<number> {
  let ran = 0
  for (;;) {
    const batch = await claim(db, concurrency, now())
    if (batch.length === 0) return ran
    await Promise.all(batch.map((job) => runJob(db, job, now)))
    ran += batch.length
  }
}

/**
 * The runner server.ts starts after listen: polls every `pollMs`, at most
 * `concurrency` jobs in flight. stop() stops claiming and waits for those.
 */
export function startJobs({ pollMs = 2_000, concurrency = 4 } = {}): { stop: () => Promise<void> } {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const inFlight = new Set<Promise<void>>()

  const tick = async () => {
    try {
      const batch = await claim(prisma, concurrency - inFlight.size, new Date())
      for (const job of batch) {
        const p = runJob(prisma, job, () => new Date()).finally(() => inFlight.delete(p))
        inFlight.add(p)
      }
    } catch (e) {
      log.error(`[jobs] poll failed: ${formatError(e)}`)
    }
    if (!stopped) timer = setTimeout(() => void tick(), pollMs)
  }
  timer = setTimeout(() => void tick(), 0)

  return {
    stop: async () => {
      stopped = true
      clearTimeout(timer)
      await Promise.allSettled([...inFlight])
    },
  }
}
