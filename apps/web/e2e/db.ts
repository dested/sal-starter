import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { databaseName, templateUrl, withDatabase } from '../test/db'

// The e2e port and database come from project.json and the test template
// (test/db.ts), so two forks' suites never share a server (reuseExistingServer)
// or a database.
const project = z
  .object({ apiPort: z.number().int() })
  .parse(JSON.parse(readFileSync(new URL('../../../project.json', import.meta.url), 'utf8')))

/** apiPort + 3: next to the API (n), Metro (n + 1) and the desktop renderer (n + 2). */
export const E2E_PORT = project.apiPort + 3

const TEMPLATE_URL = templateUrl()

// The flows' own database, never your dev DB and never the template itself:
// `<template>_e2e`, cloned fresh from the migrated, empty test template by
// global-setup on every run (the server only connects once a test runs).
export const E2E_DATABASE_URL = withDatabase(TEMPLATE_URL, `${databaseName(TEMPLATE_URL)}_e2e`)
