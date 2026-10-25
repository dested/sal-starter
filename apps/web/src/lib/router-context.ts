import type { QueryClient } from '@tanstack/react-query'
import type { TRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { createContext, RouterContextProvider } from 'react-router'
import { authClient } from '~/lib/auth-client'
import { getBrowserClients } from '~/lib/trpc'
import type { Session } from '../../server/auth'
import type { AppRouter } from '../../server/router'

// Typed React Router context that every loader reads with `context.get(...)`,
// the same on both sides. SSR: entry-server.tsx fills a provider per request
// (tRPC calls the router directly, the session comes from the request headers).
// Browser: createBrowserRouter's getContext calls browserContext() once per
// navigation or fetcher call.

export type LoaderClients = {
  queryClient: QueryClient
  trpc: TRPCOptionsProxy<AppRouter>
}

/** queryClient + tRPC options proxy, for `queryClient.prefetchQuery(trpc.x.queryOptions())`. */
export const clientsContext = createContext<LoaderClients>()

/**
 * The current session, loaded at most once per request or navigation and only
 * if a loader asks: `const session = await context.get(sessionContext)()`.
 */
export const sessionContext = createContext<() => Promise<Session | null>>()

export function browserContext(): RouterContextProvider {
  const { queryClient, trpc } = getBrowserClients()
  let session: Promise<Session | null> | undefined
  const context = new RouterContextProvider()
  context.set(clientsContext, { queryClient, trpc })
  context.set(sessionContext, () => (session ??= fetchClientSession()))
  return context
}

async function fetchClientSession(): Promise<Session | null> {
  const { data, error } = await authClient.getSession()
  if (error || !data) return null
  return data
}
