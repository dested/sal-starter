// How tests make people: the same addresses and password for API tests
// (test/callers.ts, through better-auth's server API) and browser flows
// (e2e/flow.ts `world`, through the app's /api/auth over HTTP). No server import:
// browser flows load this in Playwright's Node workers.

import { randomUUID } from 'node:crypto'

/** The one address ADMIN_EMAILS lists in tests (asAdmin / world.signIn('admin')). */
export const TEST_ADMIN_EMAIL = 'admin@test.local'

export const TEST_PASSWORD = 'test-password-1234'

/** A new address per person, so tests never share a user row. */
export const newUserEmail = (): string => `user-${randomUUID()}@test.local`
