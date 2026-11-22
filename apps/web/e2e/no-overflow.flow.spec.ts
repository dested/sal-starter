import { routes } from '../src/app/routes'
import { expect, test } from './flow'
import { overflowsAt, WIDTHS } from './overflow'
import { NOT_FOUND, screenFor, screens } from './screens'

// Nothing runs off its page or out of its box, on any page, at any width from a small phone to a
// wide desktop (e2e/overflow.ts says what counts and lists the widths). A failure names the path,
// the width, the element and by how much, with a still of that width attached
// (`bunx playwright show-report` in apps/web).

type Visitor = 'anon' | 'user' | 'admin'

// Every page, once: a new route gets a line here (a `:param` route with a real path), or the
// first test fails naming it. `as` is who loads it: signed out, a fresh person or the admin.
const PAGES: ReadonlyArray<{ path: string; as: Visitor }> = [
  { path: '/', as: 'anon' },
  { path: '/sign-in', as: 'anon' },
  { path: '/sign-up', as: 'anon' },
  { path: '/dashboard', as: 'user' },
  { path: '/this-page-does-not-exist', as: 'anon' },
]

test.describe.configure({ timeout: 120_000 })

test('layout/no-overflow-list · every screen is in the overflow check', async () => {
  // Check: each route in src/app/routes.tsx, and the 404, has a path in PAGES.
  const listed = new Set(PAGES.map((p) => screenFor(routes, p.path)))
  const missing = [...screens(routes), NOT_FOUND].filter((s) => !listed.has(s))
  expect(
    missing,
    `add these to PAGES in e2e/no-overflow.flow.spec.ts: ${missing.join(', ')}`
  ).toEqual([])
})

const WHO: Record<Visitor, string> = {
  anon: 'signed out',
  user: 'a signed-in person',
  admin: 'the admin',
}

for (const as of ['anon', 'user', 'admin'] as const) {
  const paths = PAGES.filter((p) => p.as === as).map((p) => p.path)
  if (paths.length === 0) continue
  test(`layout/no-overflow · pages for ${WHO[as]} fit every width from ${WIDTHS[0]} to ${WIDTHS[WIDTHS.length - 1]}px`, async ({
    page,
    world,
    problems,
  }, testInfo) => {
    // Check: no page scrolls sideways and no text sticks out of its box, at every width.
    // Chrome logs the 404 page's own status as a failed resource load.
    problems.allow('console', /status of 404 \(Not Found\)/)
    if (as !== 'anon') await world.signIn(as)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const found: string[] = []
    for (const path of paths) {
      await page.goto(path)
      // A redirect would quietly measure some other page.
      expect(new URL(page.url()).pathname, `${path} redirected`).toBe(path)
      found.push(...(await overflowsAt(page, path, testInfo)))
    }
    expect(found, found.join('\n')).toEqual([])
  })
}
