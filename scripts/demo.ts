// The Post demo: the template's working example of a table, a tRPC router, an
// SSR-prefetched page and an e2e flow. It exists to be read, then deleted; nine
// forks shipped it to production. So in a fork (any project not named
// sal-starter) the build and `bun run test` fail while it's present, and one
// command removes it.
//
//   bun run demo:drop           delete the demo everywhere, write the drop migration
//   bun run demo:drop --check   exit 1 if the demo is still here (what the gates call)
//   bun run demo:drop --dry-run list what would change
//
// What counts as demo: the files in DEMO_FILES, every line ending in a `demo`
// comment marker (`// demo`, `{/* demo */}`), and every `demo:start` …
// `demo:end` block, markers included.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readProject } from './project'
import { c, fail, run } from './shell'

/** The marker file: while it exists, the demo is present. */
export const DEMO_MARKER = 'apps/web/server/demo.ts'

const DEMO_FILES = [
  DEMO_MARKER,
  'apps/web/server/demo.test.ts',
  'apps/web/src/components/demo/posts-demo.tsx',
  'apps/web/src/components/demo/template-demo-bar.tsx',
  'apps/web/e2e/demo.spec.ts',
  'apps/mobile/src/components/demo/posts-demo.tsx',
]

const DEMO_DIRS = ['apps/web/src/components/demo', 'apps/mobile/src/components/demo']

/** Files carrying `demo` line markers. Missing ones (a fork without mobile) are skipped. */
const MARKED_FILES = [
  'apps/web/server/router.ts',
  'apps/web/prisma/schema.prisma',
  'apps/web/src/app/dashboard.tsx',
  'apps/web/src/app/routes.tsx',
  'apps/web/e2e/global-setup.ts',
  'apps/mobile/src/screens/home.tsx',
]

const MIGRATIONS = 'apps/web/prisma/migrations'

const LINE_MARKER = /\s*(\/\/ demo|\{\/\* demo \*\/\})\s*$/
const BLOCK_START = /^\s*(\/\/|\{\/\*) demo:start\b/
const BLOCK_END = /^\s*(\/\/|\{\/\*) demo:end\b/

export function stripDemo(source: string): string {
  const out: string[] = []
  let inBlock = false
  for (const line of source.split('\n')) {
    if (BLOCK_START.test(line)) inBlock = true
    else if (BLOCK_END.test(line)) inBlock = false
    else if (!inBlock && !LINE_MARKER.test(line)) out.push(line)
  }
  if (inBlock) throw new Error('unterminated demo:start block')
  return out.join('\n')
}

export function demoPresent(root = '.'): boolean {
  return existsSync(join(root, DEMO_MARKER))
}

function migrationStamp(now: Date): string {
  return now.toISOString().replace(/\D/g, '').slice(0, 14)
}

function drop(dryRun: boolean): void {
  if (!demoPresent()) {
    console.log(c.green('The Post demo is already gone.'))
    return
  }
  const changes: string[] = []
  for (const file of DEMO_FILES) {
    if (!existsSync(file)) continue
    changes.push(`delete ${file}`)
    if (!dryRun) rmSync(file)
  }
  for (const file of MARKED_FILES) {
    if (!existsSync(file)) continue
    const before = readFileSync(file, 'utf8')
    const after = stripDemo(before)
    if (after === before) continue
    changes.push(`strip  ${file}`)
    if (!dryRun) writeFileSync(file, after)
  }
  for (const dir of DEMO_DIRS) {
    if (!dryRun && existsSync(dir) && readdirSync(dir).length === 0)
      rmSync(dir, { recursive: true })
  }
  const migration = join(MIGRATIONS, `${migrationStamp(new Date())}_drop_post_demo`)
  changes.push(`write  ${migration}/migration.sql`)
  if (!dryRun) {
    mkdirSync(migration, { recursive: true })
    writeFileSync(
      join(migration, 'migration.sql'),
      '-- The template Post demo (bun run demo:drop).\nDROP TABLE IF EXISTS "post";\n'
    )
  }
  for (const line of changes) console.log(`  ${line}`)
  if (dryRun) return
  run('bun', 'run', 'db:generate')
  console.log(c.green('\nThe Post demo is gone.'))
  console.log(
    `Next: ${c.bold('bun run db:deploy')} (applies the drop to your dev DB), then ${c.bold('bun run typecheck')} and ${c.bold('bun run test:e2e:update')}.`
  )
}

function check(): void {
  if (!demoPresent()) return
  if (readProject().name === 'sal-starter') return
  fail(
    'The template Post demo is still here: it must not ship.',
    'Run `bun run demo:drop` (deletes it and writes the drop migration), or build your first feature over it and then drop it.'
  )
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log(readFileSync(import.meta.path, 'utf8').split('\n\n')[1] ?? '')
  } else if (args.includes('--check')) {
    check()
  } else {
    drop(args.includes('--dry-run'))
  }
}
