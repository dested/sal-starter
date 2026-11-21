// The one fixture file every flow imports: `import { test, expect } from './flow'`.
//
// - A server per worker on the production build, on its own free port and its
//   own clone of the test template (e2e/server.ts). `baseURL` is that server.
//   `test.use({ emptyDatabase: true })` gives one test its own server and an
//   empty database instead (sparingly: it costs a server start).
// - Each test is one person on one device: its browser context and its
//   `request` send their own client address (x-forwarded-for), so better-auth's
//   production rate limiter sees separate people, as it would in real life.
// - `world.signIn('user' | 'admin')` makes a fresh person (test/people.ts) and
//   signs this test's browser in through /api/auth, not the form (the form has
//   its own flows). `world.account()` makes one and leaves the browser signed out.
// - Automatic checks when every test ends: no uncaught page error, no
//   console.error, no response >= 500 or failed same-origin request, no
//   horizontal overflow on the page it ended on. A flow that provokes one on
//   purpose says so: `problems.allow('response', /\/api\/auth\/get-session/)`.
// - Every page a test lands on is recorded for the every-screen check
//   (e2e/coverage.ts), and the server's output is attached to a failing test.

import {
  expect,
  test as base,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test'
import { processSuffix, templateUrl } from '../test/db'
import { newUserEmail, TEST_ADMIN_EMAIL, TEST_PASSWORD } from '../test/people'
import { startFlowServer, type FlowServer } from './server'

export { expect }

export type ProblemKind = 'pageerror' | 'console' | 'response' | 'requestfailed' | 'overflow'

export type Problems = {
  /** Let this test see a problem of `kind` whose text matches `pattern`; nothing else. */
  allow: (kind: ProblemKind, pattern: RegExp) => void
}

export type Person = { name: string; email: string; password: string }

export type World = {
  /** A fresh person (or the admin), signed in on this test's browser through /api/auth. */
  signIn: (kind: 'user' | 'admin', name?: string) => Promise<Person>
  /** A fresh account that exists, with this test's browser still signed out. */
  account: (name?: string) => Promise<Person>
}

type WorkerFixtures = { workerServer: FlowServer }
type TestFixtures = {
  emptyDatabase: boolean
  server: FlowServer
  world: World
  problems: Problems
}

let testsInWorker = 0

async function signUpOver(
  context: BrowserContext | null,
  request: APIRequestContext,
  server: FlowServer,
  person: Person,
  existing: boolean
): Promise<void> {
  const path = existing ? '/api/auth/sign-in/email' : '/api/auth/sign-up/email'
  const data = existing
    ? { email: person.email, password: person.password }
    : { name: person.name, email: person.email, password: person.password }
  const api = context ? context.request : request
  const res = await api.post(`${server.url}${path}`, { data, headers: { origin: server.url } })
  if (!res.ok()) throw new Error(`${path} answered ${res.status()}: ${await res.text()}`)
}

function attachVisits(page: Page, visited: Set<string>, origin: string): void {
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return
    const url = new URL(frame.url())
    if (url.origin === origin) visited.add(url.pathname)
  })
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  workerServer: [
    async ({}, use) => {
      // global-setup readied the template; workers only clone it.
      const server = await startFlowServer(templateUrl(), processSuffix())
      await use(server)
      await server.stop()
    },
    { scope: 'worker', timeout: 60_000 },
  ],

  emptyDatabase: [false, { option: true }],

  server: async ({ workerServer, emptyDatabase }, use) => {
    if (!emptyDatabase) return use(workerServer)
    const own = await startFlowServer(templateUrl(), `${processSuffix()}_t${++testsInWorker}`)
    await use(own)
    await own.stop()
  },

  baseURL: async ({ server }, use) => use(server.url),

  // One client address per test (10.x.y.z, unique within this worker).
  extraHTTPHeaders: async ({}, use, testInfo) => {
    const n = ++testsInWorker
    const ip = `10.${testInfo.parallelIndex % 250}.${Math.floor(n / 250) % 250}.${(n % 250) + 1}`
    await use({ 'x-forwarded-for': ip })
  },

  world: async ({ context, request, server }, use) => {
    await use({
      signIn: async (kind, name) => {
        const admin = kind === 'admin'
        const person = {
          name: name ?? (admin ? 'Test Admin' : 'Test Person'),
          email: admin ? TEST_ADMIN_EMAIL : newUserEmail(),
          password: TEST_PASSWORD,
        }
        // The admin is one row per database (ADMIN_EMAILS lists one address).
        await signUpOver(context, request, server, person, admin && server.adminExists)
        if (admin) server.adminExists = true
        return person
      },
      account: async (name = 'Test Person') => {
        const person = { name, email: newUserEmail(), password: TEST_PASSWORD }
        await signUpOver(null, request, server, person, false)
        return person
      },
    })
  },

  problems: [
    async ({ context, page, server }, use, testInfo) => {
      const origin = new URL(server.url).origin
      const seen: Array<{ kind: ProblemKind; text: string; url: string }> = []
      const allowed: Array<{ kind: ProblemKind; pattern: RegExp }> = []
      const visited = new Set<string>()
      const logStart = server.log().length

      attachVisits(page, visited, origin)
      context.on('page', (p) => attachVisits(p, visited, origin))
      context.on('weberror', (e) =>
        seen.push({ kind: 'pageerror', text: String(e.error()), url: e.page()?.url() ?? '' })
      )
      context.on('console', (m) => {
        if (m.type() === 'error')
          seen.push({ kind: 'console', text: m.text(), url: m.page()?.url() ?? '' })
      })
      context.on('response', (r) => {
        if (r.status() >= 500)
          seen.push({ kind: 'response', text: `${r.status()} ${r.url()}`, url: r.frame().url() })
      })
      context.on('requestfailed', (r) => {
        const failure = r.failure()?.errorText ?? 'failed'
        // A navigation or fetch the page itself abandoned is not a failure.
        if (failure.includes('ERR_ABORTED') || new URL(r.url()).origin !== origin) return
        seen.push({
          kind: 'requestfailed',
          text: `${failure} ${r.method()} ${r.url()}`,
          url: r.frame().url(),
        })
      })

      await use({
        allow: (kind, pattern) => {
          allowed.push({ kind, pattern })
          testInfo.annotations.push({ type: 'allows', description: `${kind} ${pattern}` })
        },
      })

      if (!page.isClosed()) {
        const overflow = await page
          .evaluate(() => {
            const root = document.documentElement
            return { scroll: root.scrollWidth, client: root.clientWidth }
          })
          .catch(() => null)
        if (overflow && overflow.scroll > overflow.client + 1) {
          seen.push({
            kind: 'overflow',
            text: `the page is ${overflow.scroll}px wide in a ${overflow.client}px viewport`,
            url: page.url(),
          })
        }
      }

      await testInfo.attach('visited', {
        body: JSON.stringify([...visited]),
        contentType: 'application/json',
      })
      const problems = seen.filter(
        (p) => !allowed.some((a) => a.kind === p.kind && a.pattern.test(p.text))
      )
      if (testInfo.status !== testInfo.expectedStatus || problems.length > 0) {
        await testInfo.attach('server output', {
          body: server.log().slice(logStart),
          contentType: 'text/plain',
        })
      }
      if (problems.length > 0) {
        throw new Error(
          `The flow saw ${problems.length} problem(s) nobody allowed:\n` +
            problems.map((p) => `  ${p.kind}: ${p.text}  (on ${p.url})`).join('\n') +
            '\nFix the cause, or if this flow provokes it on purpose: problems.allow(kind, /pattern/).'
        )
      }
    },
    { auto: true },
  ],
})
