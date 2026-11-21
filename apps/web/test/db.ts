// Test databases: one migrated, empty template, and a throwaway clone of it per
// test process (`CREATE DATABASE … TEMPLATE`, well under a second). Shared by
// the API tests (test/preload.api.ts) and the browser flows (e2e/global-setup.ts).
// Runs under Bun and under Node (Playwright), so it uses `pg`, not Bun APIs.
//
// The template:
//   - under gate (GATE=1): the DATABASE_URL gate hands over, already migrated,
//     empty and with no connections. Never written to here.
//   - otherwise: `<project.json db>_test` on the server and credentials of the
//     shell's DATABASE_URL, else the root .env's (only that address is read
//     from .env). Created when missing, migrated (`bun run db:deploy`) when
//     behind, rebuilt when its history isn't the committed one, emptied when a
//     row is left. E2E_DATABASE_URL overrides it (the name must end in _test).
// Clones are `<template>_<suffix>`. Nothing connects to the template but this
// file, and only to make or check it.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { Client } from 'pg'
import { z } from 'zod'

const WEB_DIR = fileURLToPath(new URL('..', import.meta.url))
const ROOT_ENV = new URL('../../../.env', import.meta.url)
const MIGRATIONS = new URL('../prisma/migrations/', import.meta.url)

const project = z
  .object({ db: z.string() })
  .parse(JSON.parse(readFileSync(new URL('../../../project.json', import.meta.url), 'utf8')))

/** The same server and credentials, another database. */
export function withDatabase(url: string, db: string): string {
  const next = new URL(url)
  next.pathname = `/${db}`
  return next.toString()
}

export function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1))
}

/** The root .env as key/values ({} when there is none). Never printed. */
export function rootEnv(): Record<string, string | undefined> {
  return existsSync(ROOT_ENV) ? parseEnv(readFileSync(ROOT_ENV, 'utf8')) : {}
}

export const underGate = (): boolean => process.env.GATE === '1'

/** The template database's URL. Sync, so Playwright's config can read it. */
export function templateUrl(): string {
  if (underGate()) {
    const url = process.env.DATABASE_URL
    if (!url)
      throw new Error('GATE=1 but DATABASE_URL is unset: gate hands the template over in it.')
    return url
  }
  const override = process.env.E2E_DATABASE_URL
  if (override) return override
  const server = process.env.DATABASE_URL ?? rootEnv().DATABASE_URL
  if (!server) {
    throw new Error(
      'No DATABASE_URL in the shell or the root .env: the tests need its Postgres server (they use <db>_test on it, never the dev DB). Copy .env.example to .env.'
    )
  }
  return withDatabase(server, `${project.db}_test`)
}

/**
 * The one guard every create, drop and truncate goes through: only the test
 * template (`*_test`, or gate's `gate_*`) and its clones (`<template>_<suffix>`).
 * `clone` actions refuse the template itself.
 */
export function assertTestDatabase(
  name: string,
  template: string,
  kind: 'template' | 'clone'
): void {
  const templateOk = /^\w+_test$/.test(template) || /^gate_\w+$/.test(template)
  if (!templateOk) {
    throw new Error(
      `Refusing: "${template}" is not a test template (a *_test database, or gate's gate_*).`
    )
  }
  const ok =
    kind === 'template'
      ? name === template
      : name.startsWith(`${template}_`) && /^\w+$/.test(name) && name.length <= 63
  if (!ok) throw new Error(`Refusing to touch "${name}": not the test ${kind} of "${template}".`)
}

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`

async function withServer<T>(url: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: withDatabase(url, 'postgres') })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

async function withDb<T>(url: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

/** The committed migrations, in order, with Prisma's checksum (sha256 of migration.sql). */
function committedMigrations(): Array<{ name: string; checksum: string }> {
  return readdirSync(MIGRATIONS)
    .filter((d) => /^\d{14}_/.test(d))
    .sort()
    .map((name) => ({
      name,
      checksum: createHash('sha256')
        .update(readFileSync(new URL(`${name}/migration.sql`, MIGRATIONS)))
        .digest('hex'),
    }))
}

type TemplateState = 'current' | 'behind' | 'diverged'

async function templateState(url: string): Promise<TemplateState> {
  return withDb(url, async (client) => {
    const table = await client.query("SELECT to_regclass('public._prisma_migrations') AS t")
    if (table.rows[0]?.t === null) return 'behind'
    const applied = await client.query<{ name: string; checksum: string }>(
      'SELECT migration_name AS name, checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name'
    )
    const committed = committedMigrations()
    for (const [i, row] of applied.rows.entries()) {
      const mine = committed[i]
      if (mine === undefined || mine.name !== row.name || mine.checksum !== row.checksum)
        return 'diverged'
    }
    return applied.rows.length === committed.length ? 'current' : 'behind'
  })
}

/** Every app table, emptied. Only ever the template outside gate (left rows from an old run). */
async function emptyTemplate(url: string, template: string): Promise<void> {
  assertTestDatabase(databaseName(url), template, 'template')
  await withDb(url, async (client) => {
    const { rows } = await client.query<{ name: string }>(
      "SELECT quote_ident(tablename) AS name FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'"
    )
    if (rows.length === 0) return
    const { rows: left } = await client.query<{ found: boolean }>(
      `SELECT EXISTS (${rows.map((r) => `SELECT 1 FROM ${r.name}`).join(' UNION ALL ')}) AS found`
    )
    if (left[0]?.found) {
      await client.query(
        `TRUNCATE TABLE ${rows.map((r) => r.name).join(', ')} RESTART IDENTITY CASCADE`
      )
    }
  })
}

function migrate(url: string): void {
  // The workspace's pinned Prisma CLI, never `bunx prisma` (npm latest is Prisma 8).
  execFileSync('bun', ['run', 'db:deploy'], {
    cwd: WEB_DIR,
    env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
}

/**
 * The template, ready to clone: migrated, empty, no connections. Under gate
 * that's gate's promise, so this only returns the URL.
 */
export async function ensureTemplate(): Promise<string> {
  const url = templateUrl()
  if (underGate()) return url
  const name = databaseName(url)
  assertTestDatabase(name, name, 'template')
  const exists = await withServer(url, async (client) => {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    return rowCount !== 0
  })
  const state = exists ? await templateState(url) : 'behind'
  if (state === 'diverged') {
    // Another branch's migrations (or an edited one): start over from empty.
    await withServer(url, (client) => client.query(`DROP DATABASE ${quote(name)} WITH (FORCE)`))
  }
  if (!exists || state === 'diverged') {
    await withServer(url, (client) => client.query(`CREATE DATABASE ${quote(name)}`))
  }
  if (state !== 'current') migrate(url)
  await emptyTemplate(url, name)
  return url
}

/** `<template>_<suffix>`, made fresh from the template (an old one is dropped first). */
export async function createClone(template: string, suffix: string): Promise<string> {
  const templateName = databaseName(template)
  const name = `${templateName}_${suffix}`
  assertTestDatabase(name, templateName, 'clone')
  await withServer(template, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS ${quote(name)} WITH (FORCE)`)
    // Another process may be finishing with the template (a migrate, a clone):
    // Postgres refuses a busy template, so wait it out briefly.
    for (let attempt = 1; ; attempt++) {
      try {
        await client.query(`CREATE DATABASE ${quote(name)} TEMPLATE ${quote(templateName)}`)
        return
      } catch (error) {
        const busy = error instanceof Error && /being accessed by other users/.test(error.message)
        if (!busy || attempt === 20) throw error
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }
  })
  return withDatabase(template, name)
}

export async function dropClone(template: string, cloneUrl: string): Promise<void> {
  const templateName = databaseName(template)
  const name = databaseName(cloneUrl)
  assertTestDatabase(name, templateName, 'clone')
  await withServer(template, (client) =>
    client.query(`DROP DATABASE IF EXISTS ${quote(name)} WITH (FORCE)`)
  )
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error instanceof Error && 'code' in error && error.code === 'EPERM'
  }
}

/** The clone name for this process: `<template>_p<pid>`, so a sweep can tell a dead owner. */
export const processSuffix = (): string => `p${process.pid}`

/** Drops `<template>_p<pid>[_<more>]` clones whose process is gone (a crashed or killed run). */
export async function sweepClones(template: string): Promise<string[]> {
  const templateName = databaseName(template)
  return withServer(template, async (client) => {
    const { rows } = await client.query<{ datname: string }>(
      'SELECT datname FROM pg_database WHERE starts_with(datname, $1)',
      [`${templateName}_p`]
    )
    // `<template>_p<pid>` and `<template>_p<pid>_<more>` (a flow's own server).
    const dead = rows
      .map((r) => r.datname)
      .filter((n) => {
        const pid = /^_p(\d+)(_\w+)?$/.exec(n.slice(templateName.length))?.[1]
        return pid !== undefined && !alive(Number(pid))
      })
    for (const name of dead) {
      assertTestDatabase(name, templateName, 'clone')
      await client.query(`DROP DATABASE IF EXISTS ${quote(name)} WITH (FORCE)`)
    }
    return dead
  })
}
