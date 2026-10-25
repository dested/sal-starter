import { redirect, type RouteObject, type LoaderFunctionArgs } from 'react-router'
import { clientsContext, sessionContext } from '~/lib/router-context'
import type { Session } from '../../server/auth'
import { DashboardPage } from './dashboard'
import { RouteErrorBoundary } from './error-boundary'
import { HomePage } from './home'
import { Layout } from './layout'
import { SignInPage } from './sign-in'
import { SignUpPage } from './sign-up'

// Loaders read the typed context in ~/lib/router-context.ts, which
// entry-server.tsx (SSR) and index.tsx (browser) fill, so no loader branches
// on where it runs.

export type RootLoaderData = { session: Session | null }

async function rootLoader({ context }: LoaderFunctionArgs): Promise<RootLoaderData> {
  return { session: await context.get(sessionContext)() }
}

async function dashboardLoader({ context }: LoaderFunctionArgs): Promise<RootLoaderData> {
  const { queryClient, trpc } = context.get(clientsContext)
  // Check the session and warm the posts cache in parallel so the dashboard
  // renders with data (a signed-out user's UNAUTHORIZED is swallowed by
  // prefetchQuery, never dehydrated, and the redirect below wins).
  const [session] = await Promise.all([
    context.get(sessionContext)(),
    queryClient.prefetchQuery(trpc.posts.list.queryOptions()),
  ])
  if (!session) throw redirect('/sign-in')
  return { session }
}

async function redirectIfSignedIn({ context }: LoaderFunctionArgs) {
  if (await context.get(sessionContext)()) throw redirect('/dashboard')
  return null
}

export const routes: RouteObject[] = [
  {
    id: 'root',
    path: '/',
    Component: Layout,
    loader: rootLoader,
    ErrorBoundary: RouteErrorBoundary,
    children: [
      { index: true, Component: HomePage },
      { path: 'sign-in', Component: SignInPage, loader: redirectIfSignedIn },
      { path: 'sign-up', Component: SignUpPage, loader: redirectIfSignedIn },
      { path: 'dashboard', Component: DashboardPage, loader: dashboardLoader },
    ],
  },
]
