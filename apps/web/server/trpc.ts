import { initTRPC, TRPCError } from '@trpc/server'
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'
import superjson from 'superjson'
import { auth, type Session } from './auth'

export type Context = { session: Session | null }

export async function createContext({ req }: CreateExpressContextOptions): Promise<Context> {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v)
    } else {
      headers.set(key, value)
    }
  }
  const session = await auth.api.getSession({ headers })
  return { session }
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
