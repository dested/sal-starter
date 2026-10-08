// Renderer side: a TRPCLink that talks to main through `window.trpcIpc`.
//
//   createTRPCClient<AppRouter>({ links: [ipcLink()] })
//
// No transformer: structured clone already carries Date/Map/Set. An
// AbortSignal on a query or mutation sends `cancel`; unsubscribing from a
// subscription sends `subscription.stop`.

import { TRPCClientError, type TRPCLink } from '@trpc/client'
import type { AnyRouter } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import type { IpcBridge, IpcResponse } from './protocol'

export type { IpcBridge } from './protocol'

declare global {
  interface Window {
    trpcIpc?: IpcBridge
  }
}

export interface IpcLinkOptions {
  /** Defaults to `window.trpcIpc` (set by `exposeTrpcIpc()` in the preload). */
  bridge?: IpcBridge
}

export function ipcLink<TRouter extends AnyRouter>(opts: IpcLinkOptions = {}): TRPCLink<TRouter> {
  const bridge = opts.bridge ?? globalThis.window?.trpcIpc
  if (bridge === undefined) {
    throw new Error('ipcLink: window.trpcIpc is missing. Call exposeTrpcIpc() in the preload.')
  }
  const handlers = new Map<number, (message: IpcResponse) => void>()
  bridge.onMessage((message) => handlers.get(message.id)?.(message))
  // Op ids are unique per client; one counter here also keeps them unique
  // across several clients sharing the bridge.
  let nextId = 1

  return () =>
    ({ op }) =>
      observable((observer) => {
        const id = nextId++
        const { type, path, input, signal } = op
        let done = false
        const finish = () => {
          done = true
          handlers.delete(id)
          signal?.removeEventListener('abort', onAbort)
        }
        const onAbort = () => {
          if (done) return
          finish()
          bridge.send({ id, method: 'cancel' })
          observer.error(TRPCClientError.from(new DOMException('Aborted', 'AbortError')))
        }

        handlers.set(id, (message) => {
          if ('error' in message) {
            finish()
            observer.error(TRPCClientError.from({ error: message.error }))
            return
          }
          const { result } = message
          if (type !== 'subscription') {
            if (result.type === 'data') {
              finish()
              observer.next({ result: { data: result.data } })
              observer.complete()
            }
            return
          }
          if (result.type === 'started') {
            observer.next({ result: { type: 'started' } })
          } else if (result.type === 'data') {
            observer.next({
              result:
                result.id === undefined
                  ? { type: 'data', data: result.data }
                  : { type: 'data', id: result.id, data: result.data },
            })
          } else {
            finish()
            observer.next({ result: { type: 'stopped' } })
            observer.complete()
          }
        })

        if (signal?.aborted === true) {
          handlers.delete(id)
          observer.error(TRPCClientError.from(new DOMException('Aborted', 'AbortError')))
          return () => {}
        }
        signal?.addEventListener('abort', onAbort)
        bridge.send({ id, method: type, path, input })

        return () => {
          if (done) return
          finish()
          bridge.send({ id, method: type === 'subscription' ? 'subscription.stop' : 'cancel' })
        }
      })
}
