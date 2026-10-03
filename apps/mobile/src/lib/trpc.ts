import { QueryClient } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCContext, createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import superjson from 'superjson'
import type { AppRouter } from '@app/web/router'
import { apiUrl } from '~/lib/api-url'
import { authClient } from '~/lib/auth-client'

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000 } },
})

// Same /api/trpc and superjson transformer as web. Native has no cookie jar,
// so the better-auth cookie from SecureStore rides in a Cookie header.
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${apiUrl()}/api/trpc`,
      transformer: superjson,
      async headers() {
        const cookie = await authClient.getCookie()
        return cookie ? { Cookie: cookie } : {}
      },
      fetch(url, options) {
        return fetch(url, { ...options, credentials: 'omit' })
      },
    }),
  ],
})

// For prefetching outside components (screens prefetch on focus).
export const trpc = createTRPCOptionsProxy<AppRouter>({ client: trpcClient, queryClient })
