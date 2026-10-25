import { addImport, insertAfterLine, type EditStep, type Recipe } from '../lib'

const CLIENT = 'apps/web/src/lib/trpc.tsx'
const SERVER = 'apps/web/server.ts'

/** The browser client's `links: [ httpBatchLink(…) ]` becomes a splitLink: subscriptions on the socket. */
const splitLinks: EditStep = {
  file: CLIENT,
  what: 'subscriptions over wsLink (splitLink)',
  done: (s) => s.includes('wsLink('),
  apply: (s) => {
    const open = s.indexOf('links: [')
    if (open === -1) return null
    let depth = 0
    let close = -1
    for (let i = open + 'links: '.length; i < s.length; i++) {
      if (s[i] === '[') depth++
      else if (s[i] === ']' && --depth === 0) {
        close = i
        break
      }
    }
    if (close === -1) return null
    const inner = s
      .slice(open + 'links: ['.length, close)
      .trim()
      .replace(/,$/, '')
    if (!inner.startsWith('httpBatchLink(')) return null
    return `${s.slice(0, open)}links: [
      // Subscriptions ride one WebSocket (server/trpc-ws.ts); everything else is HTTP.
      splitLink({
        condition: (op) => op.type === 'subscription',
        true: wsLink({
          client: createWSClient({
            url: \`\${location.protocol === 'https:' ? 'wss' : 'ws'}://\${location.host}/api/trpc-ws\`,
            lazy: { enabled: true, closeMs: 10_000 },
          }),
          transformer: superjson,
        }),
        false: ${inner},
      }),
    ${s.slice(close)}`
  },
  manual: `In ${CLIENT}, wrap the browser client's httpBatchLink in
  splitLink({ condition: (op) => op.type === 'subscription',
    true: wsLink({ client: createWSClient({ url: 'ws(s)://<host>/api/trpc-ws', lazy: { enabled: true, closeMs: 10_000 } }), transformer: superjson }),
    false: <the httpBatchLink> })`,
}

export default function ws(): Recipe {
  return {
    name: 'ws',
    summary: 'WebSocket upgrades on the http server + tRPC subscriptions over wsLink',
    details: [
      'Adds apps/web/server/upgrades.ts, trpc-ws.ts (+ trpc-ws.test.ts), shutdown.ts and ws.',
      '  - onUpgrade(path, handler): claim upgrades by path; Vite HMR keeps its own in dev,',
      '    unclaimed upgrades are closed in production',
      '  - tRPC on /api/trpc-ws (applyWSSHandler, superjson, keep-alive, cookie auth)',
      '  - src/lib/trpc.tsx: splitLink sends subscriptions to a lazy wsLink, the rest to httpBatchLink',
      '  - server.ts attaches it; SIGTERM tells clients to reconnect and closes the sockets',
      '  Write a subscription as an async generator:',
      '    ticks: publicProcedure.subscription(async function* ({ signal }) { yield … })',
      '  Mobile keeps httpBatchLink; add the same splitLink there with',
      '  connectionParams: { cookie } when it needs subscriptions.',
    ].join('\n'),
    files: [
      { from: 'apps/web/server/upgrades.ts' },
      { from: 'apps/web/server/trpc-ws.ts' },
      { from: 'apps/web/server/trpc-ws.test.ts' },
      { from: 'apps/web/server/shutdown.ts', shared: true },
    ],
    dependencies: [
      { name: 'ws', range: '^8.22.0' },
      { name: '@types/ws', range: '^8.18.2', dev: true },
    ],
    edits: [
      addImport(SERVER, './server/upgrades', ['attachUpgrades']),
      addImport(SERVER, './server/trpc-ws', ['startTrpcWs']),
      addImport(SERVER, './server/shutdown', ['onShutdown']),
      insertAfterLine(
        SERVER,
        'attach WebSocket upgrades + tRPC on /api/trpc-ws',
        'const httpServer = http.createServer(app)',
        '  // WebSocket upgrades by path (server/upgrades.ts); Vite HMR keeps its own.\n  attachUpgrades(httpServer, { isProd })\n  onShutdown(startTrpcWs().close)\n',
        'attachUpgrades(httpServer'
      ),
      addImport(CLIENT, '@trpc/client', ['createWSClient', 'splitLink', 'wsLink']),
      splitLinks,
    ],
    next: [
      'Add a subscription to server/router.ts (an async generator), then useSubscription(trpc.x.subscriptionOptions()).',
    ],
  }
}
