import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { createIsomorphicFn } from '@tanstack/react-start'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import type { TRPCClient } from '@trpc/client'
import { routeTree } from './routeTree.gen'
import { getSsrCookieHeaders } from './lib/ssr-cookie-headers'
import { logBadResponse } from './lib/log-response'
import type { AppRouter } from './trpc/router'

function getBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
}

const getServerHeaders = createIsomorphicFn()
    .client((): Record<string, string> => ({}))
    .server((): Record<string, string> => getSsrCookieHeaders())

export type TRPCOptionsProxy = ReturnType<typeof createTRPCOptionsProxy<AppRouter>>

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  })
  const trpcClient: TRPCClient<AppRouter> = createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
        headers: getServerHeaders,
        fetch: async (input, init) => {
          const response = await fetch(input, init)
          await logBadResponse(
            'trpc',
            { url: typeof input === 'string' ? input : input.toString(), method: init?.method },
            response,
          )
          return response
        },
      }),
    ],
  })
  const trpc = createTRPCOptionsProxy<AppRouter>({
    client: trpcClient,
    queryClient,
  })

  const router = createRouter({
    routeTree,
    context: { session: null, queryClient, trpcClient, trpc },
    defaultPreload: 'intent',
    defaultErrorComponent: ({ error }) => (
        <div className="p-6">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <pre className="mt-2 text-sm opacity-70">{error.message}</pre>
        </div>
    ),
    defaultNotFoundComponent: () => (
        <div className="p-6">
          <h1 className="text-xl font-semibold">Not found</h1>
        </div>
    ),
    scrollRestoration: true,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
