import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createTRPCClient, createWSClient, httpBatchLink, splitLink, wsLink } from '@trpc/client'
import { initTRPC } from '@trpc/server'
import { applyWSSHandler } from '@trpc/server/adapters/ws'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import superjson from 'superjson'
import { WebSocketServer } from 'ws'
import { z } from 'zod'
import { attachUpgrades, onUpgrade } from './upgrades'

// The wiring trpc-ws.ts does, on a bare http server with a tiny router: an
// upgrade on the claimed path reaches tRPC, a subscription streams Dates
// through superjson, and an unclaimed path is closed in production mode.
const t = initTRPC.create({ transformer: superjson })
const router = t.router({
  ping: t.procedure.query(() => 'pong'),
  ticks: t.procedure.input(z.object({ count: z.number() })).subscription(async function* ({
    input,
  }) {
    for (let i = 0; i < input.count; i++) yield { i, at: new Date(0) }
  }),
})

let server: Server
let base: string
beforeAll(async () => {
  server = createServer()
  const wss = new WebSocketServer({ noServer: true })
  onUpgrade('/test-ws', (req, socket, head) =>
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  )
  applyWSSHandler({ wss, router })
  attachUpgrades(server, { isProd: true })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address: AddressInfo | string | null = server.address()
  if (address === null || typeof address === 'string') throw new Error('no port')
  base = `127.0.0.1:${address.port}`
})
afterAll(() => {
  server.closeAllConnections()
  server.close()
})

describe('tRPC over the upgrade registry', () => {
  test('a subscription streams through wsLink with superjson', async () => {
    const ws = createWSClient({ url: `ws://${base}/test-ws` })
    const client = createTRPCClient<typeof router>({
      links: [
        splitLink({
          condition: (op) => op.type === 'subscription',
          true: wsLink({ client: ws, transformer: superjson }),
          false: httpBatchLink({ url: `http://${base}/unused`, transformer: superjson }),
        }),
      ],
    })
    const got = await new Promise<{ i: number; at: Date }[]>((resolve, reject) => {
      const items: { i: number; at: Date }[] = []
      client.ticks.subscribe(
        { count: 3 },
        {
          onData: (d) => items.push(d),
          onComplete: () => resolve(items),
          onError: reject,
        }
      )
    })
    await ws.close()
    expect(got.map((d) => d.i)).toEqual([0, 1, 2])
    expect(got[0]?.at).toBeInstanceOf(Date)
  })

  test('an unclaimed path is closed in production', async () => {
    const closed = await new Promise<boolean>((resolve) => {
      const socket = new WebSocket(`ws://${base}/nobody-here`)
      socket.onopen = () => resolve(false)
      socket.onerror = () => resolve(true)
      socket.onclose = () => resolve(true)
    })
    expect(closed).toBe(true)
  })
})
