// demo: the template Post demo's flows; deleted by `bun run demo:drop`.
import { expect, test, type World } from './flow'

// posts.create is for signed-in people.
const asWriter = (world: World) => world.signIn('user', 'Demo Writer')

test('demo/posts-create · a new post shows in the list, before and after a reload', async ({
  page,
  world,
}, testInfo) => {
  // Check: the post's content is listed, and still is after a server render.
  const content = `First post from ${testInfo.testId}`
  await asWriter(world)
  await page.goto('/dashboard')
  await expect(page.getByText('Template demo · delete before shipping')).toBeVisible()
  await page.getByLabel('Title').fill('Hello world')
  await page.getByLabel('Content').fill(content)
  await page.getByRole('button', { name: 'Post' }).click()
  await expect(page.getByText(content)).toBeVisible()
  await expect(page.getByText('Loading…')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText(content)).toBeVisible()
  await expect(page.getByText('Loading…')).toHaveCount(0)
})

test.describe('on an empty database', () => {
  test.use({ emptyDatabase: true })

  test('demo/posts-empty · "No posts yet" until the first post, never "Loading…" once loaded', async ({
    page,
    world,
  }) => {
    // Check: "No posts yet" shows on an empty list and is gone after one post.
    await asWriter(world)
    await page.goto('/dashboard')
    await expect(page.getByText('No posts yet')).toBeVisible()
    await expect(page.getByText('Loading…')).toHaveCount(0)
    await page.getByLabel('Title').fill('The first')
    await page.getByLabel('Content').fill('Nothing here before me.')
    await page.getByRole('button', { name: 'Post' }).click()
    await expect(page.getByText('Nothing here before me.')).toBeVisible()
    await expect(page.getByText('No posts yet')).toHaveCount(0)
    await expect(page.getByText('Loading…')).toHaveCount(0)
  })
})
