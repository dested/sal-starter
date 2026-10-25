// `bun run add:<recipe>`: add an optional server slot to this fork.
//
//   bun run add:ai      server/ai/claude.ts: Anthropic client, AI_FAKE, zod output, caching, cost log
//   bun run add:ws      WebSocket upgrades on the http server + tRPC subscriptions over wsLink
//   bun run add:jobs    Postgres job queue: job table, SKIP LOCKED claims, retries, graceful stop
//
//   bun recipes/add.ts <recipe> [--dry-run] [--no-check]
//   bun recipes/add.ts --help | <recipe> --help
//
// It copies the recipe's files, installs its dependencies into apps/web, makes
// its edits, formats what it touched and typechecks apps/web. Nothing is
// committed. Running it twice is safe: what's there already is skipped.

import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readProject } from '../scripts/project'
import { c, fail, run } from '../scripts/shell'
import { applyFiles, describePlan, plan, type Recipe } from './lib'
import ai from './ai/recipe'
import jobs from './jobs/recipe'
import ws from './ws/recipe'

const RECIPES: Record<string, (root: string) => Recipe> = { ai, ws, jobs }

const recipesDir = dirname(fileURLToPath(import.meta.url))
const root = dirname(recipesDir)

const args = process.argv.slice(2)
const name = args.find((a) => !a.startsWith('--'))
const help = args.includes('--help') || args.includes('-h')
const dryRun = args.includes('--dry-run')
const check = !args.includes('--no-check')

function usage(): string {
  const list = Object.entries(RECIPES)
    .map(([key, make]) => `  ${c.bold(`add:${key}`.padEnd(10))} ${make(root).summary}`)
    .join('\n')
  return `Usage: bun run add:<recipe> [--dry-run] [--no-check]\n\n${list}\n\n${c.dim('bun run add:<recipe> --help for what each one adds')}`
}

if (name === undefined) {
  if (help) {
    console.log(usage())
    process.exit(0)
  }
  fail(usage())
}
const make = RECIPES[name]
if (make === undefined) fail(`Unknown recipe "${name}".\n\n${usage()}`)
const recipe = make(root)

if (help) {
  console.log(`${c.bold(`add:${recipe.name}`)}: ${recipe.summary}\n\n${recipe.details}\n`)
  console.log(c.bold('On this repo it would:'))
  console.log(describePlan(recipe, plan(recipe, root, recipesDir)))
  process.exit(0)
}

if (!readProject().surfaces.includes('web') || !existsSync(join(root, 'apps/web'))) {
  fail(`add:${recipe.name} adds to apps/web, and this project has no web surface.`)
}

const p = plan(recipe, root, recipesDir)
console.log(c.bold(`add:${recipe.name}`))
console.log(describePlan(recipe, p))

if (p.blocked.length > 0) {
  console.error()
  for (const e of p.blocked) {
    console.error(c.red(`${e.file}: can't find where "${e.what}" goes (the file was rewritten?).`))
    console.error(c.dim(e.manual.replace(/^/gm, '  ')))
  }
  fail('Nothing was changed.', 'Make the edits above by hand, then run it again.')
}
if (dryRun) process.exit(0)

const nothing = p.copies.length + p.installs.length + p.edits.length === 0
const touched = applyFiles(p, root)
for (const deps of [p.installs.filter((d) => !d.dev), p.installs.filter((d) => d.dev)]) {
  if (deps.length === 0) continue
  const specs = deps.map((d) => `${d.name}@${d.range}`)
  run('bun', 'add', '--cwd', 'apps/web', ...(deps[0]?.dev ? ['--dev'] : []), ...specs)
}
if (!nothing) for (const cmd of recipe.after ?? []) run(cmd[0] ?? 'true', ...cmd.slice(1))
const formattable = touched.filter((f) => /\.(ts|tsx|json)$/.test(f))
if (formattable.length > 0)
  run('bunx', 'prettier', '--log-level', 'warn', '--write', ...formattable)
if (check && !nothing) run('bun', 'run', '--cwd', 'apps/web', 'typecheck')

console.log()
console.log(
  c.bold(c.green(nothing ? `✓ ${recipe.name} was already in place.` : `✓ ${recipe.name} added.`))
)
for (const line of recipe.next) console.log(`  ${line}`)
if (!nothing) console.log(c.dim('  Review the diff and commit it; nothing was committed.'))
