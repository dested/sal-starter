// The environment tests run in, set before any server module is imported
// (server/env.ts parses process.env on import). Nothing comes from the root
// .env: under gate a real one sits next to the tests, and a test must never
// reach a paid or third-party service with a real key. So every key the .env
// defines is removed first, then exactly what the server needs is set.

import { rootEnv } from './db'
import { TEST_ADMIN_EMAIL } from './people'

export { TEST_ADMIN_EMAIL } from './people'

export const TEST_AUTH_URL = 'http://localhost:4780'

/** Removes every key the root .env defines (and DATABASE_URL) from process.env. */
export function scrubEnv(): void {
  for (const key of Object.keys(rootEnv())) delete process.env[key]
  delete process.env.DATABASE_URL
}

/** Exactly what server/env.ts needs, pointed at `databaseUrl` (the flows' servers start with this too). */
export function testEnv(databaseUrl: string, authUrl = TEST_AUTH_URL): Record<string, string> {
  return {
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET: 'api-tests-secret-at-least-32-characters!!',
    BETTER_AUTH_URL: authUrl,
    ADMIN_EMAILS: TEST_ADMIN_EMAIL,
    SIGNUP_ALLOWLIST: '',
  }
}

/** This process's environment = testEnv(databaseUrl), nothing from the root .env. */
export function useTestEnv(databaseUrl: string): void {
  scrubEnv()
  Object.assign(process.env, testEnv(databaseUrl))
}
