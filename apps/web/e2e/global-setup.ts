import { createClone, ensureTemplate } from '../test/db'

// The flows' database: a fresh clone of the test template (created and
// migrated with the committed migrations when missing or behind, the same
// `migrate deploy` production runs), so every run starts empty and screenshots
// are byte-for-byte reproducible. Runs once per `playwright test`.
export default async function globalSetup() {
  const template = await ensureTemplate()
  await createClone(template, 'e2e')
}
