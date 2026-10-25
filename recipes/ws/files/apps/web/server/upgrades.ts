// WebSocket upgrades on the Express http.Server, routed by exact pathname.
// Vite's HMR socket rides the same server in dev (server.ts `hmr.server`) and
// keeps its own `upgrade` listener, so a path nobody claimed here is left for
// it; in production nothing else listens, so an unclaimed upgrade is closed.
import type { IncomingMessage, Server } from 'node:http'
import type { Duplex } from 'node:stream'

export type UpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => void

const handlers = new Map<string, UpgradeHandler>()

/** Claim the upgrades for `path`, e.g. onUpgrade('/api/trpc-ws', …). */
export function onUpgrade(path: string, handler: UpgradeHandler): void {
  handlers.set(path, handler)
}

export function attachUpgrades(server: Server, { isProd }: { isProd: boolean }): () => void {
  const listener = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname
    const handler = handlers.get(path)
    if (handler) handler(req, socket, head)
    else if (isProd) socket.destroy()
  }
  server.on('upgrade', listener)
  return () => {
    server.off('upgrade', listener)
  }
}
