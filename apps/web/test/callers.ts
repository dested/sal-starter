// Who calls the router in API tests: the real appRouter with a real context,
// built from a real session. People sign up and in through better-auth's server
// API, so its hooks (the allowlist) run, and the session comes back through the
// cookie it sets, the way a browser's would. Import only from *.api.test.ts
// (test/preload.api.ts has set the environment by then).

import { randomUUID } from 'node:crypto'
import { appRouter } from '../server/router'
import { contextFor, contextFromHeaders, type Context } from '../server/trpc'
import { auth } from '../server/auth'
import { TEST_ADMIN_EMAIL } from './env'

export type Api = ReturnType<typeof appRouter.createCaller>

export const TEST_PASSWORD = 'test-password-1234'

/** The anonymous caller: no session. */
export async function asAnon(): Promise<{ api: Api; context: Context }> {
  const context = contextFor(null)
  return { api: appRouter.createCaller(context), context }
}

/** `name=value; …` from a response's Set-Cookie headers: what a browser sends back. */
export function cookieFrom(headers: Headers): string {
  return headers
    .getSetCookie()
    .map((c) => c.split(';')[0] ?? '')
    .filter((c) => c !== '')
    .join('; ')
}

export type Person = {
  api: Api
  context: Context
  user: { id: string; email: string; name: string }
  /** The session cookie better-auth set: `Cookie` header value. */
  cookie: string
}

async function personFrom(headers: Headers): Promise<Person> {
  const cookie = cookieFrom(headers)
  const context = await contextFromHeaders(new Headers({ cookie }))
  if (!context.session)
    throw new Error('better-auth set a cookie that does not resolve to a session')
  const { id, email, name } = context.session.user
  return { api: appRouter.createCaller(context), context, user: { id, email, name }, cookie }
}

/** Signs a new person up (autoSignIn) and returns their caller. */
export async function signUp(email: string, name = 'Test Person'): Promise<Person> {
  const { headers } = await auth.api.signUpEmail({
    body: { email, password: TEST_PASSWORD, name },
    returnHeaders: true,
  })
  return personFrom(headers)
}

export async function signIn(email: string): Promise<Person> {
  const { headers } = await auth.api.signInEmail({
    body: { email, password: TEST_PASSWORD },
    returnHeaders: true,
  })
  return personFrom(headers)
}

/** A fresh signed-in person: a new user row and session per call. */
export async function asUser(name = 'Test Person'): Promise<Person> {
  return signUp(`user-${randomUUID()}@test.local`, name)
}

let adminSignedUp = false

/**
 * The admin (TEST_ADMIN_EMAIL, the one address ADMIN_EMAILS lists): a fresh
 * session per call, but one user row per process, so don't assume it owns
 * nothing.
 */
export async function asAdmin(): Promise<Person> {
  if (adminSignedUp) return signIn(TEST_ADMIN_EMAIL)
  adminSignedUp = true
  return signUp(TEST_ADMIN_EMAIL, 'Test Admin')
}
