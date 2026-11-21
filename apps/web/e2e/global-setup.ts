import { ensureTemplate, sweepClones } from '../test/db'
import { assertBuilt } from './server'

// Once per `playwright test`, before any worker: the production build exists,
// and the test template is migrated and empty (created when missing, the same
// `migrate deploy` production runs). Workers then only clone it.
export default async function globalSetup() {
  assertBuilt()
  const template = await ensureTemplate()
  await sweepClones(template)
}
