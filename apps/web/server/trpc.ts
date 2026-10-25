import { initTRPC, TRPCError } from '@trpc/server'
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'
import type { IncomingHttpHeaders } from 'node:http'
import superjson from 'superjson'
import { isAdminEmail } from './access'
import { auth, type Session } from './auth'

export type Context = { session: Session | null; isAdmin: boolean }

/** The context for a session, wherever it came from (HTTP here, the SSR proxy in entry-server). */
export function contextFor(session: Session | null): Context {
  return { session, isAdmin: isAdminEmail(session?.user.email) }
}

/** Node's header object as a Fetch `Headers` (what better-auth reads). */
export function toHeaders(raw: IncomingHttpHeaders): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v)
    } else {
      headers.set(key, value)
    }
  }
  return headers
}

/** The context for a request's headers: any adapter (Express here, a WebSocket upgrade) ends up here. */
export async function contextFromHeaders(headers: Headers): Promise<Context> {
  return contextFor(await auth.api.getSession({ headers }))
}

export function createContext({ req }: CreateExpressContextOptions): Promise<Context> {
  return contextFromHeaders(toHeaders(req.headers))
}

// superjson on the wire: procedures return real Dates/Maps/BigInts and the
// client gets them back as such. Every client link must use it too.
const t = initTRPC.context<Context>().create({ transformer: superjson })

export const router = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({ ctx: { ...ctx, session: ctx.session } })
})

/** A session whose email is in ADMIN_EMAILS. Signed out is UNAUTHORIZED; anyone else FORBIDDEN. */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.isAdmin) {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
  return next()
})
