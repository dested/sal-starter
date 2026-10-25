import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { z } from 'zod'

// The e2e port and test database come from project.json, so two forks' suites
// never share a server (reuseExistingServer) or a database.
const project = z
  .object({ apiPort: z.number().int(), db: z.string() })
  .parse(JSON.parse(readFileSync(new URL('../../../project.json', import.meta.url), 'utf8')))

/** apiPort + 3: next to the API (n), Metro (n + 1) and the desktop renderer (n + 2). */
export const E2E_PORT = project.apiPort + 3

/** The dev DATABASE_URL: the shell's, else the root .env's (Playwright runs on Node, which skips .env). */
function devDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    return parseEnv(readFileSync(new URL('../../../.env', import.meta.url), 'utf8')).DATABASE_URL
  } catch {
    return undefined
  }
}

/** The same server and credentials, another database. */
export function withDatabase(url: string, db: string): string {
  const next = new URL(url)
  next.pathname = `/${db}`
  return next.toString()
}

// The isolated e2e database, never your dev DB: the dev DATABASE_URL's server
// and credentials with the database swapped for `<project.json db>_test`.
// global-setup creates it on first run. Override with E2E_DATABASE_URL.
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  withDatabase(
    devDatabaseUrl() ?? 'postgres://postgres:postgres@localhost:5432/postgres',
    `${project.db}_test`
  )
