import { execFileSync } from 'node:child_process'
import { Client } from 'pg'
import { E2E_DATABASE_URL, withDatabase } from './db'

// Create the isolated test database if it's missing, bring it up to the
// committed migrations (the same `migrate deploy` production runs), then wipe
// it so sign-up uses a fresh fixed user and screenshots are byte-for-byte
// reproducible. Runs once per `playwright test`.
export default async function globalSetup() {
  // TRUNCATE below is destructive — refuse anything that isn't a *_test database.
  const dbName = new URL(E2E_DATABASE_URL).pathname.slice(1)
  if (!/^\w+_test$/.test(dbName)) {
    throw new Error(`E2E_DATABASE_URL must point at a *_test database, got "${dbName}"`)
  }
  const admin = new Client({ connectionString: withDatabase(E2E_DATABASE_URL, 'postgres') })
  await admin.connect()
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
  if (rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`)
  await admin.end()
  // The workspace's pinned Prisma CLI, never `bunx prisma` (npm latest is Prisma 8).
  execFileSync('bun', ['run', 'db:deploy'], {
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: 'inherit',
  })
  const client = new Client({ connectionString: E2E_DATABASE_URL })
  await client.connect()
  // Every app table, so a new model never leaks rows between runs.
  const { rows } = await client.query<{ name: string }>(
    "SELECT quote_ident(tablename) AS name FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'"
  )
  if (rows.length > 0) {
    await client.query(
      `TRUNCATE TABLE ${rows.map((r) => r.name).join(', ')} RESTART IDENTITY CASCADE`
    )
  }
  await client.end()
}
