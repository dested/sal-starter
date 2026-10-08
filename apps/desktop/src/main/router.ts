// The app's tRPC router, served to the renderer over IPC (@app/trpc-ipc).
// Demo procedures prove all three kinds: a query, a mutation, a subscription.

import { ipcTransformer } from '@app/trpc-ipc/main'
import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { onLaunch, type Launch } from './launches'

const t = initTRPC.create({ transformer: ipcTransformer })

/** Resolves after `ms`, or as soon as `signal` aborts. */
function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal?.addEventListener('abort', done, { once: true })
  })
}

export const appRouter = t.router({
  ping: t.procedure.query(() => ({
    at: new Date(),
    electron: process.versions.electron ?? 'unknown',
    node: process.versions.node,
  })),

  echo: t.procedure
    .input(z.object({ text: z.string().max(200) }))
    .mutation(({ input }) => ({ text: input.text, reversed: [...input.text].reverse().join('') })),

  ticks: t.procedure
    .input(z.object({ everyMs: z.number().int().min(50).max(10_000) }))
    .subscription(async function* ({ input, signal }) {
      let n = 0
      while (signal?.aborted !== true) {
        yield { n: n++, at: new Date() }
        await sleep(input.everyMs, signal)
      }
    }),

  // Second launches of the app (argv + cwd), forwarded by the single-instance lock.
  launches: t.procedure.subscription(async function* ({ signal }) {
    const queue: Launch[] = []
    let wake: (() => void) | undefined
    const off = onLaunch((launch) => {
      queue.push(launch)
      wake?.()
    })
    const onAbort = () => wake?.()
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      while (signal?.aborted !== true) {
        const next = queue.shift()
        if (next !== undefined) {
          yield next
          continue
        }
        await new Promise<void>((resolve) => {
          wake = resolve
        })
        wake = undefined
      }
    } finally {
      off()
      signal?.removeEventListener('abort', onAbort)
    }
  }),
})

export type AppRouter = typeof appRouter
