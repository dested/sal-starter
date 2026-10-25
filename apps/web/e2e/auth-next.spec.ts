import { expect, test } from '@playwright/test'

// ?next= round trip: a signed-out visit to a protected page goes to sign-in
// carrying the page, and signing in (or up) lands back on it.
const PASSWORD = 'password123'
const email = (who: string) => `${who}-${Date.now()}@example.com`

test('signed-out /dashboard → sign up → back to /dashboard', async ({ page }) => {
  await page.goto('/dashboard')
  await page.waitForURL('**/sign-in?next=%2Fdashboard')

  // The cross link keeps ?next= so a new visitor can sign up instead.
  await page.getByRole('link', { name: 'Create an account' }).click()
  await page.waitForURL('**/sign-up?next=%2Fdashboard')
  await page.getByLabel('Name').fill('Grace Hopper')
  await page.getByLabel('Email').fill(email('grace'))
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign up' }).click()

  await page.waitForURL((url) => url.pathname === '/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('sign-in returns to the page and query it was asked for', async ({ page, request }) => {
  // The account comes from the API (`request` has its own cookie jar), so the page is signed out.
  const user = email('linus')
  const res = await request.post('/api/auth/sign-up/email', {
    data: { name: 'Linus', email: user, password: PASSWORD },
  })
  expect(res.ok()).toBe(true)

  await page.goto('/dashboard?tab=posts')
  await page.waitForURL('**/sign-in?next=%2Fdashboard%3Ftab%3Dposts')
  await page.getByLabel('Email').fill(user)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await page.waitForURL((url) => url.pathname === '/dashboard' && url.search === '?tab=posts')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('an off-site ?next= is ignored', async ({ page, baseURL }) => {
  await page.goto('/sign-up?next=//evil.example')
  await page.getByLabel('Name').fill('Mallory')
  await page.getByLabel('Email').fill(email('mallory'))
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign up' }).click()

  await page.waitForURL((url) => url.pathname === '/dashboard')
  expect(page.url()).toBe(`${baseURL}/dashboard`)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})
