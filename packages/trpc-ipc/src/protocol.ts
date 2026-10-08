// The wire format between renderer and main. One IPC channel, `trpc`, carries
// both directions. Electron IPC uses structured clone, so Date, Map, Set and
// typed arrays survive without a transformer (decisions.md: no superjson here).
// Type-only apart from two constants, so the preload bundle stays tiny.

export const CHANNEL = 'trpc'

export type IpcRequest =
  | { id: number; method: 'query' | 'mutation' | 'subscription'; path: string; input: unknown }
  // Abort an in-flight query or mutation (its AbortSignal fired).
  | { id: number; method: 'cancel' }
  // The renderer unsubscribed from a subscription.
  | { id: number; method: 'subscription.stop' }

export type IpcResponse =
  | { id: number; result: { type: 'data'; data: unknown; id?: string } }
  | { id: number; result: { type: 'started' } }
  | { id: number; result: { type: 'stopped' } }
  // The router's error shape (getErrorShape), `{ message, code, data }` by default.
  | { id: number; error: unknown }

/** What the preload exposes on `window.trpcIpc`. Nothing else crosses the bridge. */
export interface IpcBridge {
  send(message: IpcRequest): void
  /** Returns an unsubscribe function. */
  onMessage(listener: (message: IpcResponse) => void): () => void
}

/**
 * Pass to `initTRPC.create({ transformer: ipcTransformer })`. It does nothing at
 * runtime (structured clone already carries Date/Map/Set/typed arrays), but a
 * router without a transformer makes tRPC type every output as JSON (a `Date`
 * becomes `string`). With it, the client's types match what IPC delivers.
 */
export const ipcTransformer = {
  serialize: (value: unknown): unknown => value,
  deserialize: (value: unknown): unknown => value,
}
