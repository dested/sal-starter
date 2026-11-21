import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { TRPCError } from '@trpc/server'
import express from 'express'
import type { Server } from 'node:http'
import { asAdmin, asAnon, asUser } from '../test/callers'
import { procedures } from '../test/access-table'
import { appRouter } from './router'
import { ACCESS } from './procedure-access'
import {
  adminProcedure,
  contextFromHeaders,
  createContext,
  protectedProcedure,
  publicProcedure,
  router,
  toHeaders,
  type Context,
} from './trpc'

// The builders contract: a three-procedure router made from the three real
// builders, called by each kind of caller. Written out in full, so a reversed
// check in any builder shows up as one wrong cell.
const probe = router({
  open: publicProcedure.query(() => 'ok'),
  user: protectedProcedure.query(() => 'ok'),
  admin: adminProcedure.query(() => 'ok'),
})

type Outcome = 'ok' | 'UNAUTHORIZED' | 'FORBIDDEN'
const CALLERS = ['signed out', 'signed in', 'admin'] as const
type Caller = (typeof CALLERS)[number]

const EXPECTED: Record<'open' | 'user' | 'admin', Record<Caller, Outcome>> = {
  open: { 'signed out': 'ok', 'signed in': 'ok', admin: 'ok' },
  user: { 'signed out': 'UNAUTHORIZED', 'signed in': 'ok', admin: 'ok' },
  admin: { 'signed out': 'UNAUTHORIZED', 'signed in': 'FORBIDDEN', admin: 'ok' },
}

async function outcome(ctx: Context, path: 'open' | 'user' | 'admin'): Promise<Outcome> {
  try {
    await probe.createCaller(ctx)[path]()
    return 'ok'
  } catch (error) {
    if (
      error instanceof TRPCError &&
      (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN')
    ) {
      return error.code
    }
    throw error
  }
}

describe('procedure builders', () => {
  let contexts: Record<Caller, Context> | undefined
  beforeAll(async () => {
    contexts = {
      'signed out': (await asAnon()).context,
      'signed in': (await asUser()).context,
      admin: (await asAdmin()).context,
    }
  })

  test('each builder lets in exactly its callers, with the right error for the rest', async () => {
    if (!contexts) throw new Error('beforeAll did not run')
    const seen: Record<string, Record<string, Outcome>> = {}
    for (const path of ['open', 'user', 'admin'] as const) {
      const row: Record<string, Outcome> = {}
      for (const caller of CALLERS) row[caller] = await outcome(contexts[caller], path)
      seen[path] = row
    }
    expect(seen).toEqual(EXPECTED)
  })

  test('each builder carries the tag whose ACCESS row matches what it does', () => {
    const tags = Object.fromEntries(procedures(probe).map((p) => [p.path, p.access]))
    expect(tags).toEqual({ open: 'public', user: 'user', admin: 'admin' })
    for (const [path, row] of Object.entries(EXPECTED)) {
      const tag = tags[path]
      if (!tag) throw new Error(`${path} has no tag`)
      for (const caller of CALLERS) expect(ACCESS[tag][caller]).toBe(row[caller] === 'ok')
    }
  })
})

// Over real headers: the cookie better-auth sets, through the same Node → Fetch
// header conversion and context the Express adapter uses.
describe('contextFromHeaders', () => {
  test('the cookie better-auth sets resolves to that session', async () => {
    const person = await asUser('Header Person')
    const ctx = await contextFromHeaders(toHeaders({ cookie: person.cookie, host: 'localhost' }))
    expect(ctx.session?.user.id).toBe(person.user.id)
    expect(ctx.isAdmin).toBe(false)
  })

  test('no cookie, or a garbage one, is no session', async () => {
    expect((await contextFromHeaders(toHeaders({}))).session).toBeNull()
    const garbage = toHeaders({ cookie: 'better-auth.session_token=not-a-token' })
    expect((await contextFromHeaders(garbage)).session).toBeNull()
  })

  test('repeated Node headers are all kept', () => {
    const headers = toHeaders({ 'x-a': ['1', '2'], host: 'h' })
    expect(headers.get('x-a')).toBe('1, 2')
    expect(headers.get('host')).toBe('h')
  })
})

describe('createContext over HTTP', () => {
  let server: Server
  let base = ''
  beforeAll(async () => {
    const app = express()
    app.use('/api/trpc', createExpressMiddleware({ router: appRouter, createContext }))
    server = app.listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', () => resolve()))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('no TCP address')
    base = `http://127.0.0.1:${address.port}`
  })
  afterAll(() => {
    server.close()
  })

  test('a request with the session cookie is that person; without it, UNAUTHORIZED', async () => {
    const person = await asUser('HTTP Person')
    const signedIn = await fetch(`${base}/api/trpc/me`, { headers: { cookie: person.cookie } })
    expect(signedIn.status).toBe(200)
    const body: unknown = await signedIn.json()
    expect(JSON.stringify(body)).toContain(person.user.id)
    expect((await fetch(`${base}/api/trpc/me`)).status).toBe(401)
  })
})
