import { redirect, type LoaderFunctionArgs } from 'react-router'
import type { Session } from '../../server/auth'
import { sessionContext } from './router-context'

// Auth helpers for loaders, on top of the typed context in router-context.ts
// (data loaders read `context.get(clientsContext)` for the QueryClient + tRPC).
//
//   loader: async (args) => {
//     const session = await requireSession(args)   // signed out → /sign-in?next=<here>
//     const { queryClient, trpc } = args.context.get(clientsContext)
//     await queryClient.prefetchQuery(trpc.posts.list.queryOptions())
//     return { session }
//   }

type Args = Pick<LoaderFunctionArgs, 'context' | 'request'>

/** `/sign-in?next=<this page>`, so signing in lands back where the visitor was headed. */
export function signInPath(request: Request): string {
  const url = new URL(request.url)
  const here = url.pathname + url.search
  return here === '/' ? '/sign-in' : `/sign-in?next=${encodeURIComponent(here)}`
}

/** The session, or a redirect to sign-in that comes back here (`?next=`). */
export async function requireSession({ context, request }: Args): Promise<Session> {
  const session = await context.get(sessionContext)()
  if (!session) throw redirect(signInPath(request))
  return session
}

/** For /sign-in and /sign-up: a signed-in visitor goes straight to `?next=` (or AFTER_SIGN_IN). */
export async function redirectIfSignedIn({ context, request }: Args): Promise<null> {
  if (await context.get(sessionContext)())
    throw redirect(nextFromSearch(new URL(request.url).search))
  return null
}

/** Where to land after sign-in when there is no `?next=`. */
export const AFTER_SIGN_IN = '/dashboard'

/**
 * A path on this site and nothing else, or null. It starts with one `/`; its
 * second character isn't `/` or `\` (browsers read `/\host` as `//host`); it
 * has no control character (URL parsing drops a tab or newline, so `/\t/host`
 * would become `//host`). Checked as given and once percent-decoded.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(next)
  } catch {
    return null
  }
  const ownPath = [next, decoded].every((p) => {
    if (!p.startsWith('/') || p[1] === '/' || p[1] === '\\') return false
    for (let i = 0; i < p.length; i++) {
      const c = p.charCodeAt(i)
      if (c < 0x20 || c === 0x7f) return false
    }
    return true
  })
  return ownPath ? next : null
}

/** The post-sign-in destination for a `?next=` search string. */
export function nextFromSearch(search: string): string {
  return safeNext(new URLSearchParams(search).get('next')) ?? AFTER_SIGN_IN
}
