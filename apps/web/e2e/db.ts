import { readFileSync } from 'node:fs'
import { z } from 'zod'

// The e2e port and test database come from project.json, so two forks' suites
// never share a server (reuseExistingServer) or a database.
const project = z
  .object({ apiPort: z.number().int(), db: z.string() })
  .parse(JSON.parse(readFileSync(new URL('../../../project.json', import.meta.url), 'utf8')))

/** apiPort + 3: next to the API (n), Metro (n + 1) and the desktop renderer (n + 2). */
export const E2E_PORT = project.apiPort + 3

// The isolated e2e database — never your dev DB. Override with E2E_DATABASE_URL.
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? `postgres://postgres:postgres@localhost:5432/${project.db}_test`
