// `bun run test:api` preload: a fresh clone of the test template for this
// process, the test environment pointed at it, and the clone dropped at the end.
// Runs before any test file imports a server module.
import { afterAll } from 'bun:test'
import { createClone, dropClone, ensureTemplate, processSuffix, sweepClones } from './db'
import { useTestEnv } from './env'

const template = await ensureTemplate()
await sweepClones(template)
const clone = await createClone(template, processSuffix())
useTestEnv(clone)

afterAll(async () => {
  // Close the app's pool first, so the drop doesn't kill live connections under it.
  await globalThis.__prisma?.$disconnect()
  await dropClone(template, clone)
})
