import { deserializeSsrState, isSuperJSONResult } from '../src/lib/ssr-state'
import { expect, test } from './flow'

const EIGHT = 'abcd1234'

test('auth/sign-up · an 8-character password signs a new person up onto their dashboard', async ({
  page,
}) => {
  // Check: after signing up, /dashboard with the new person's name as the heading.
  await page.goto('/sign-up')
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible()
  await expect(page).toHaveScreenshot('sign-up.png', { fullPage: true })
  await page.getByLabel('Name').fill('Ada Lovelace')
  await page.getByLabel('Email').fill(`ada-${Date.now()}@example.com`)
  await page.getByLabel('Password').fill(EIGHT)
  await page.getByRole('button', { name: 'Sign up' }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard')
  await expect(page.getByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeVisible()
})

test('auth/sign-up-short-password · a 7-character password is refused in the form', async ({
  page,
}) => {
  // Check: the form won't send a 7-character password; nobody is signed up.
  let sent = 0
  page.on('request', (r) => {
    if (r.url().includes('/api/auth/sign-up')) sent++
  })
  await page.goto('/sign-up')
  await page.getByLabel('Name').fill('Short Pass')
  await page.getByLabel('Email').fill(`short-${Date.now()}@example.com`)
  await page.getByLabel('Password').fill(EIGHT.slice(0, 7))
  await page.getByRole('button', { name: 'Sign up' }).click()
  const password = page.getByLabel('Password')
  expect(await password.evaluate((el: HTMLInputElement) => el.validity.tooShort)).toBe(true)
  await expect(page).toHaveURL(/\/sign-up$/)
  expect(sent).toBe(0)
})

test('auth/sign-up-next · signing up from a protected page lands back on it', async ({ page }) => {
  // Check: sign-up started from /dashboard's redirect ends on /dashboard.
  await page.goto('/dashboard')
  await page.waitForURL('**/sign-in?next=%2Fdashboard')
  await page.getByRole('link', { name: 'Create an account' }).click()
  await page.waitForURL('**/sign-up?next=%2Fdashboard')
  await page.getByLabel('Name').fill('Grace Hopper')
  await page.getByLabel('Email').fill(`grace-${Date.now()}@example.com`)
  await page.getByLabel('Password').fill(EIGHT)
  await page.getByRole('button', { name: 'Sign up' }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard')
  await expect(page.getByRole('heading', { level: 1, name: 'Grace Hopper' })).toBeVisible()
})

test('auth/protected-redirect · a signed-out visit to the dashboard asks to sign in first', async ({
  page,
}) => {
  // Check: /dashboard signed out lands on /sign-in?next=/dashboard.
  await page.goto('/dashboard')
  await page.waitForURL('**/sign-in?next=%2Fdashboard')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('auth/sign-in-next · signing in returns to the page and query asked for', async ({
  page,
  world,
}) => {
  // Check: sign-in from /dashboard?tab=posts ends on /dashboard?tab=posts.
  const person = await world.account('Linus')
  await page.goto('/dashboard?tab=posts')
  await page.waitForURL('**/sign-in?next=%2Fdashboard%3Ftab%3Dposts')
  await page.getByLabel('Email').fill(person.email)
  await page.getByLabel('Password').fill(person.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard' && url.search === '?tab=posts')
  await expect(page.getByRole('heading', { level: 1, name: 'Linus' })).toBeVisible()
})

test('auth/off-site-next · an off-site ?next= is ignored', async ({ page, baseURL }) => {
  // Check: signing up with ?next=//evil.example stays on this site's /dashboard.
  await page.goto('/sign-up?next=//evil.example')
  await page.getByLabel('Name').fill('Mallory')
  await page.getByLabel('Email').fill(`mallory-${Date.now()}@example.com`)
  await page.getByLabel('Password').fill(EIGHT)
  await page.getByRole('button', { name: 'Sign up' }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard')
  expect(page.url()).toBe(`${baseURL}/dashboard`)
  await expect(page.getByRole('heading', { level: 1, name: 'Mallory' })).toBeVisible()
})

test('auth/sign-out · signing out lands home, and Back does not reopen the dashboard', async ({
  page,
  world,
}) => {
  // Check: after sign-out and Back, still on home, signed out.
  await world.signIn('user', 'Leaving Soon')
  await page.goto('/')
  await page.getByRole('navigation').getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Leaving Soon' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
})

test('auth/dashboard-ssr · a hard load of the dashboard hands React Query a real Date', async ({
  page,
  world,
}) => {
  // Check: me.createdAt in the server-rendered state deserializes to a Date.
  const person = await world.signIn('user', 'Date Keeper')
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { level: 1, name: person.name })).toBeVisible()
  const payload: unknown = await page.evaluate(() => window.__SSR_STATE__)
  expect(isSuperJSONResult(payload)).toBe(true)
  const state = deserializeSsrState(isSuperJSONResult(payload) ? payload : undefined)
  const me = state?.queries
    .map((q) => q.state.data)
    .find((d) => typeof d === 'object' && d !== null && 'email' in d && d.email === person.email)
  expect(typeof me === 'object' && me !== null && 'createdAt' in me && me.createdAt).toBeInstanceOf(
    Date
  )
})

// A failed session check on a client navigation says nothing about the
// session: one retry, then the error screen (src/lib/router-context.ts).
test('auth/session-check-retry · one failed session check on a navigation still loads the page', async ({
  page,
  world,
  problems,
}) => {
  // Check: the dashboard loads after the first get-session fails.
  problems.allow('response', /\/api\/auth\/get-session/)
  problems.allow('console', /status of 500/)
  const person = await world.signIn('user', 'Patient Person')
  await page.goto('/')
  let calls = 0
  await page.route('**/api/auth/get-session*', async (route) => {
    calls++
    if (calls === 1) await route.fulfill({ status: 500, body: '{}' })
    else await route.continue()
  })
  await page.getByRole('navigation').getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByRole('heading', { level: 1, name: person.name })).toBeVisible()
  expect(calls).toBe(2)
})

test('auth/session-check-error · a session check that keeps failing shows the error with its status', async ({
  page,
  world,
  problems,
}) => {
  // Check: "Couldn't check your session (500)" after exactly one retry.
  problems.allow('response', /\/api\/auth\/get-session/)
  problems.allow('console', /status of 500/)
  await world.signIn('user')
  await page.goto('/')
  let calls = 0
  await page.route('**/api/auth/get-session*', async (route) => {
    calls++
    await route.fulfill({ status: 500, body: '{}' })
  })
  await page.getByRole('navigation').getByRole('link', { name: 'Dashboard' }).click()
  await expect(
    page.getByText("Couldn't check your session (500). Reload to try again.")
  ).toBeVisible()
  expect(calls).toBe(2)
})
