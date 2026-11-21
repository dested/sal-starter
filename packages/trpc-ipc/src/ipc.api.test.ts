import { describe, expect, test } from 'bun:test'
import { createTRPCClient, isTRPCClientError } from '@trpc/client'
import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import {
  createIpcHandler,
  ipcTransformer,
  type IpcMainEventLike,
  type IpcMainLike,
  type IpcSender,
} from './main'
import type { IpcBridge, IpcResponse } from './protocol'
import { ipcLink } from './renderer'

// A fake ipcMain + webContents + preload bridge. Messages go through
// structuredClone, like Electron IPC, so a Date that survives here survives there.
function fakeIpc() {
  const mainListeners = new Set<(event: IpcMainEventLike, message: unknown) => void>()
  const rendererListeners = new Set<(message: IpcResponse) => void>()
  const senderEvents = new Map<string, Array<() => void>>()
  let destroyed = false
  const sent: unknown[] = []

  const sender: IpcSender = {
    id: 1,
    send(_channel, message) {
      const copy = structuredClone(message)
      queueMicrotask(() => {
        for (const l of rendererListeners) l(copy)
      })
    },
    isDestroyed: () => destroyed,
    on(event: 'destroyed' | 'did-navigate', listener: () => void) {
      senderEvents.set(event, [...(senderEvents.get(event) ?? []), listener])
    },
  }
  const ipcMain: IpcMainLike = {
    on(_channel, listener) {
      mainListeners.add(listener)
    },
    removeListener(_channel, listener) {
      mainListeners.delete(listener)
    },
  }
  const bridge: IpcBridge = {
    send(message) {
      sent.push(message)
      const copy: unknown = structuredClone(message)
      queueMicrotask(() => {
        for (const l of mainListeners) l({ sender }, copy)
      })
    },
    onMessage(listener) {
      rendererListeners.add(listener)
      return () => rendererListeners.delete(listener)
    },
  }
  const destroy = () => {
    destroyed = true
    for (const l of senderEvents.get('destroyed') ?? []) l()
  }
  return { ipcMain, bridge, sent, destroy }
}

const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms))

function setup() {
  const t = initTRPC.context<{ who: string }>().create({ transformer: ipcTransformer })
  const state = { returned: 0, slowAborted: false }
  const router = t.router({
    ping: t.procedure.query(({ ctx }) => ({ who: ctx.who, at: new Date(0), tags: new Set(['a']) })),
    echo: t.procedure.input(z.object({ text: z.string() })).mutation(({ input }) => input.text),
    fail: t.procedure.query(() => {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'nope' })
    }),
    slow: t.procedure.query(
      ({ signal }) =>
        new Promise<string>((resolve) => {
          signal?.addEventListener('abort', () => {
            state.slowAborted = true
            resolve('aborted')
          })
        })
    ),
    count: t.procedure.input(z.object({ to: z.number() })).subscription(async function* ({
      input,
    }) {
      for (let i = 1; i <= input.to; i++) yield i
    }),
    forever: t.procedure.subscription(async function* ({ signal }) {
      try {
        let i = 0
        while (signal?.aborted !== true) {
          yield i++
          await tick(2)
        }
      } finally {
        state.returned++
      }
    }),
  })
  const ipc = fakeIpc()
  const handler = createIpcHandler({
    router,
    ipcMain: ipc.ipcMain,
    createContext: () => ({ who: 'main' }),
  })
  const client = createTRPCClient<typeof router>({ links: [ipcLink({ bridge: ipc.bridge })] })
  return { client, handler, ipc, state }
}

describe('trpc over ipc', () => {
  test('query round-trips structured-clone types and context', async () => {
    const { client } = setup()
    const res = await client.ping.query()
    expect(res.who).toBe('main')
    // ipcTransformer keeps the types honest: `at` is typed Date, not string.
    const at: Date = res.at
    expect(at).toBeInstanceOf(Date)
    expect(res.tags).toBeInstanceOf(Set)
  })

  test('mutation with zod input', async () => {
    const { client } = setup()
    expect(await client.echo.mutate({ text: 'hi' })).toBe('hi')
  })

  test('errors arrive as TRPCClientError with the code', async () => {
    const { client } = setup()
    const err = await client.fail.query().catch((e: unknown) => e)
    expect(isTRPCClientError(err)).toBe(true)
    if (!isTRPCClientError(err)) return
    expect(err.message).toBe('nope')
    expect(err.data?.code).toBe('NOT_FOUND')
  })

  test('bad input is a BAD_REQUEST', async () => {
    const { client, ipc } = setup()
    const err = await new Promise<unknown>((resolve) => {
      ipc.bridge.onMessage((m) => resolve(m))
      ipc.bridge.send({ id: 999, method: 'mutation', path: 'echo', input: { text: 1 } })
    })
    expect(err).toMatchObject({ id: 999, error: { data: { code: 'BAD_REQUEST' } } })
    void client
  })

  test('subscription streams data then completes', async () => {
    const { client } = setup()
    const seen: number[] = []
    await new Promise<void>((resolve, reject) => {
      client.count.subscribe(
        { to: 3 },
        { onData: (n) => seen.push(n), onComplete: () => resolve(), onError: reject }
      )
    })
    expect(seen).toEqual([1, 2, 3])
  })

  test('unsubscribe sends subscription.stop and returns the iterator', async () => {
    const { client, ipc, state } = setup()
    const seen: number[] = []
    const sub = client.forever.subscribe(undefined, { onData: (n) => seen.push(n) })
    await tick(20)
    sub.unsubscribe()
    await tick(20)
    const count = seen.length
    expect(count).toBeGreaterThan(0)
    expect(
      ipc.sent.some(
        (m) =>
          typeof m === 'object' && m !== null && 'method' in m && m.method === 'subscription.stop'
      )
    ).toBe(true)
    expect(state.returned).toBe(1)
    await tick(20)
    expect(seen.length).toBe(count)
  })

  test('abort cancels the call in main', async () => {
    const { client, state } = setup()
    const ac = new AbortController()
    const pending = client.slow.query(undefined, { signal: ac.signal }).catch((e: unknown) => e)
    await tick()
    ac.abort()
    const err = await pending
    expect(isTRPCClientError(err)).toBe(true)
    await tick()
    expect(state.slowAborted).toBe(true)
  })

  test('a destroyed webContents stops its subscriptions', async () => {
    const { client, ipc, state } = setup()
    client.forever.subscribe(undefined, {})
    await tick(10)
    ipc.destroy()
    await tick(20)
    expect(state.returned).toBe(1)
  })

  test('dispose stops listening', async () => {
    const { client, handler } = setup()
    handler.dispose()
    const raced = await Promise.race([
      client.ping.query().then(() => 'answered'),
      tick(30).then(() => 'silent'),
    ])
    expect(raced).toBe('silent')
  })
})
