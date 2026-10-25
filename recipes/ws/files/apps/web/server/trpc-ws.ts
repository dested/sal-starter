// tRPC over WebSocket at /api/trpc-ws: subscriptions (and anything else a
// client routes here). The browser's tRPC client splits subscriptions onto
// this socket (src/lib/trpc.tsx `splitLink`); queries and mutations stay on
// httpBatchLink. A WebSocket per tab, not an SSE stream per subscription, so
// subscriptions never eat the browser's 6 connections per host.
//
// Context is the HTTP one (trpc.ts contextFromHeaders): the upgrade carries the
// browser's cookies. A client that can't send cookies on an upgrade (React
// Native) puts `cookie` in the wsLink's connectionParams instead.
import { applyWSSHandler } from '@trpc/server/adapters/ws'
import { WebSocketServer } from 'ws'
import { log } from './logger'
import { appRouter } from './router'
import { contextFromHeaders, toHeaders } from './trpc'
import { onUpgrade } from './upgrades'

export const TRPC_WS_PATH = '/api/trpc-ws'

export function startTrpcWs(): { close: () => Promise<void> } {
  const wss = new WebSocketServer({ noServer: true })
  onUpgrade(TRPC_WS_PATH, (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (client) => wss.emit('connection', client, req))
  })
  const handler = applyWSSHandler({
    wss,
    router: appRouter,
    createContext({ req, info }) {
      const headers = toHeaders(req.headers)
      const cookie = info.connectionParams?.cookie
      if (cookie) headers.set('cookie', cookie)
      return contextFromHeaders(headers)
    },
    keepAlive: { enabled: true, pingMs: 30_000, pongWaitMs: 5_000 },
    onError({ error, path, type }) {
      log.error(`[trpc-ws] ${type} ${path ?? '<unknown>'} ${error.code} — ${error.message}`)
    },
  })
  return {
    close: () =>
      new Promise<void>((resolve) => {
        // Clients reconnect (to the next deploy) instead of erroring.
        handler.broadcastReconnectNotification()
        for (const client of wss.clients) client.terminate()
        wss.close(() => resolve())
      }),
  }
}
