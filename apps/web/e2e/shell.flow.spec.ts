import project from '../../../project.json' with { type: 'json' }
import { expect, test } from './flow'

test('shell/home · the home page shows the product name', async ({ page }) => {
  // Check: the home page's heading is the product's name.
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: project.displayName })).toBeVisible()
  await expect(page).toHaveScreenshot('home.png', { fullPage: true })
})

test('shell/not-found · an unknown page shows the 404 screen with a 404 status', async ({
  page,
  problems,
}) => {
  // Check: the 404 screen, served with status 404.
  // Chrome logs the document's own 404 as a failed resource load.
  problems.allow('console', /status of 404 \(Not Found\)/)
  const res = await page.goto('/this-page-does-not-exist')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible()
  await expect(page).toHaveScreenshot('not-found.png', { fullPage: true })
})

test('shell/not-found-asset · an asset-looking path 404s without the app', async ({ request }) => {
  // Check: a missing file answers a plain 404, never the rendered app.
  const res = await request.get('/logo-that-does-not-exist.png')
  expect(res.status()).toBe(404)
  expect(res.headers()['content-type']).toContain('text/plain')
  expect(await res.text()).toBe('Not found')
})

test('shell/dashboard · the nav link opens the dashboard', async ({ page, world }) => {
  // Check: the dashboard's heading is the signed-in person's name.
  const person = await world.signIn('user', 'Nav Walker')
  await page.goto('/')
  await page.getByRole('navigation').getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByRole('heading', { level: 1, name: person.name })).toBeVisible()
})
