// Main-process side: serves a tRPC router over one Electron IPC channel.
//
//   createIpcHandler({ router: appRouter, createContext, ipcMain })
//
// Queries, mutations and subscriptions (v11 async-generator procedures, or
// legacy observables) go through `callProcedure` / `getErrorShape`, the same
// internals tRPC's own adapters use; that's why the catalog pins tRPC exactly.
// Subscriptions are tracked per webContents and their iterators are returned
// on stop, on abort, on navigation and when the webContents is destroyed.

import type { AnyRouter, inferRouterContext } from '@trpc/server'
import { isObservable, observableToAsyncIterable } from '@trpc/server/observable'
import {
  callProcedure,
  getErrorShape,
  getTRPCErrorFromUnknown,
  isAsyncIterable,
  isTrackedEnvelope,
  TRPCError,
} from '@trpc/server/unstable-core-do-not-import'
import { z } from 'zod'
import { CHANNEL, type IpcRequest, type IpcResponse } from './protocol'

export { ipcTransformer } from './protocol'

// Messages from the renderer are validated: the renderer is sandboxed, but it
// is still the less trusted side.
const requestSchema: z.ZodType<IpcRequest> = z.discriminatedUnion('method', [
  z.object({
    id: z.number().int(),
    method: z.enum(['query', 'mutation', 'subscription']),
    path: z.string(),
    input: z.unknown(),
  }),
  z.object({ id: z.number().int(), method: z.literal('cancel') }),
  z.object({ id: z.number().int(), method: z.literal('subscription.stop') }),
])

/** The slice of Electron's WebContents the handler needs (a fake one in tests). */
export interface IpcSender {
  readonly id: number
  send(channel: string, message: IpcResponse): void
  isDestroyed(): boolean
  on(event: 'destroyed', listener: () => void): unknown
  on(event: 'did-navigate', listener: () => void): unknown
}

export interface IpcMainEventLike {
  sender: IpcSender
}

/** The slice of Electron's `ipcMain` the handler needs. */
export interface IpcMainLike {
  on(channel: string, listener: (event: IpcMainEventLike, message: unknown) => void): unknown
  removeListener(
    channel: string,
    listener: (event: IpcMainEventLike, message: unknown) => void
  ): unknown
}

type ProcedureMethod = 'query' | 'mutation' | 'subscription'

export interface IpcHandlerOptions<TRouter extends AnyRouter> {
  router: TRouter
  ipcMain: IpcMainLike
  createContext: (opts: {
    sender: IpcSender
  }) => inferRouterContext<TRouter> | Promise<inferRouterContext<TRouter>>
  onError?: (opts: {
    error: TRPCError
    path: string | undefined
    type: ProcedureMethod | 'unknown'
    input: unknown
  }) => void
}

export function createIpcHandler<TRouter extends AnyRouter>(
  opts: IpcHandlerOptions<TRouter>
): { dispose: () => void } {
  const { router, ipcMain } = opts
  // senderId → request id → the controller that aborts that call.
  const inflight = new Map<number, Map<number, AbortController>>()

  function callsOf(sender: IpcSender): Map<number, AbortController> {
    let calls = inflight.get(sender.id)
    if (calls === undefined) {
      calls = new Map()
      inflight.set(sender.id, calls)
      const id = sender.id
      // A reload or a closed window: nobody is listening any more.
      const abortAll = () => {
        const current = inflight.get(id)
        if (current === undefined) return
        for (const ac of current.values()) ac.abort()
        current.clear()
      }
      sender.on('did-navigate', abortAll)
      sender.on('destroyed', () => {
        abortAll()
        inflight.delete(id)
      })
    }
    return calls
  }

  function respond(sender: IpcSender, message: IpcResponse): void {
    if (!sender.isDestroyed()) sender.send(CHANNEL, message)
  }

  function errorShape(
    cause: unknown,
    req: { path: string | undefined; type: ProcedureMethod | 'unknown'; input: unknown },
    ctx: inferRouterContext<TRouter> | undefined
  ): unknown {
    const error = getTRPCErrorFromUnknown(cause)
    opts.onError?.({ error, ...req })
    return getErrorShape({ config: router._def._config, error, ...req, ctx })
  }

  async function runCall(
    sender: IpcSender,
    req: Extract<IpcRequest, { method: ProcedureMethod }>,
    ac: AbortController
  ): Promise<void> {
    const { id, method: type, path, input } = req
    const calls = callsOf(sender)
    let ctx: inferRouterContext<TRouter> | undefined
    try {
      ctx = await opts.createContext({ sender })
      const result: unknown = await callProcedure({
        router,
        path,
        getRawInput: async () => input,
        ctx,
        type,
        signal: ac.signal,
        batchIndex: 0,
      })

      if (type !== 'subscription') {
        if (isAsyncIterable(result) || isObservable(result)) {
          throw new TRPCError({
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: `Cannot return an async iterable or observable from a ${type} over IPC`,
          })
        }
        calls.delete(id)
        respond(sender, { id, result: { type: 'data', data: result } })
        return
      }

      const iterable: AsyncIterable<unknown> | undefined = isObservable(result)
        ? observableToAsyncIterable(result, ac.signal)
        : isAsyncIterable(result)
          ? result
          : undefined
      if (iterable === undefined) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Subscription ${path} did not return an async generator or observable`,
        })
      }

      respond(sender, { id, result: { type: 'started' } })
      const iterator = iterable[Symbol.asyncIterator]()
      const aborted = new Promise<'abort'>((resolve) => {
        if (ac.signal.aborted) resolve('abort')
        else ac.signal.addEventListener('abort', () => resolve('abort'), { once: true })
      })
      try {
        while (true) {
          const next = await Promise.race([iterator.next(), aborted])
          if (next === 'abort' || next.done === true) break
          const value: unknown = next.value
          if (isTrackedEnvelope(value)) {
            const [eventId, data] = value
            respond(sender, {
              id,
              result: { type: 'data', id: eventId, data: { id: eventId, data } },
            })
          } else {
            respond(sender, { id, result: { type: 'data', data: value } })
          }
        }
      } finally {
        // Don't await: a generator parked in an await only settles `return()`
        // once that await does; the procedure's own `signal` should end it.
        void iterator.return?.()
      }
      calls.delete(id)
      respond(sender, { id, result: { type: 'stopped' } })
    } catch (cause) {
      calls.delete(id)
      respond(sender, { id, error: errorShape(cause, { path, type, input }, ctx) })
    }
  }

  const listener = (event: IpcMainEventLike, raw: unknown): void => {
    const { sender } = event
    const parsed = requestSchema.safeParse(raw)
    if (!parsed.success) {
      opts.onError?.({
        error: new TRPCError({ code: 'BAD_REQUEST', message: 'Malformed IPC message' }),
        path: undefined,
        type: 'unknown',
        input: raw,
      })
      return
    }
    const req = parsed.data
    const calls = callsOf(sender)

    if (req.method === 'cancel' || req.method === 'subscription.stop') {
      calls.get(req.id)?.abort()
      calls.delete(req.id)
      return
    }

    if (calls.has(req.id)) {
      respond(sender, {
        id: req.id,
        error: errorShape(
          new TRPCError({ code: 'BAD_REQUEST', message: `Duplicate id ${req.id}` }),
          { path: req.path, type: req.method, input: req.input },
          undefined
        ),
      })
      return
    }
    const ac = new AbortController()
    calls.set(req.id, ac)
    void runCall(sender, req, ac)
  }

  ipcMain.on(CHANNEL, listener)

  return {
    dispose() {
      ipcMain.removeListener(CHANNEL, listener)
      for (const calls of inflight.values()) for (const ac of calls.values()) ac.abort()
      inflight.clear()
    },
  }
}
