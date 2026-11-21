// Every test file is exactly one of three kinds, named so the gate and the next
// agent know what it may touch:
//
//   *.rule.test.ts   bun:test, pure logic only (no database, network or server)   bun run test:rules
//   *.api.test.ts    bun:test, the real router/handlers, real Postgres, real IPC  bun run test:api
//   *.flow.spec.ts   Playwright, the built app in a real browser                  bun run test:flows
//
//   bun scripts/test-names.ts   exit 1 naming each misnamed file (test:rules runs it first)
//
// A top-level `flows/` folder is bx's (its own `<name>.flow.ts` replays), not ours: skipped.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { c } from './shell'

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'out',
  'release',
  'data',
  'generated',
  'ios',
  'android',
  'test-results',
  'playwright-report',
  '__screenshots__',
])

const GOOD = /\.(rule|api)\.test\.ts$|\.flow\.spec\.ts$/
// What bun:test or Playwright would pick up as a test file.
const LOOKS_LIKE_TEST = /([._-](test|spec)[._-])|\.(test|spec)\.[cm]?[jt]sx?$/

function walk(dir: string, root: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.claude') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      const bxFlows = entry.name === 'flows' && dir === root
      if (!SKIP_DIRS.has(entry.name) && !bxFlows) walk(path, root, out)
    } else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
      out.push(relative(root, path))
    }
  }
}

/** A file under an `e2e/` folder that drives Playwright's `test(…)` is a flow. */
function isPlaywrightTest(source: string): boolean {
  return (
    /from ['"](@playwright\/test|\.\/flow)['"]/.test(source) && /^\s*test(\.\w+)?\(/m.test(source)
  )
}

function suggestion(file: string, source: string): string {
  if (/@playwright\/test|from ['"]\.\/flow['"]/.test(source)) return '*.flow.spec.ts'
  if (/(prisma|\/router|\/trpc|\/auth|\/env)['"]|from ['"]pg['"]|createServer|fetch\(/.test(source))
    return '*.api.test.ts'
  return file.endsWith('x') ? '*.rule.test.ts (rules are pure logic in .ts)' : '*.rule.test.ts'
}

export function misnamedTests(root = '.'): Array<{ file: string; use: string }> {
  const files: string[] = []
  walk(root, root, files)
  const bad: Array<{ file: string; use: string }> = []
  for (const file of files) {
    if (GOOD.test(file)) continue
    const name = file.slice(file.lastIndexOf('/') + 1)
    const underE2e = /(^|\/)e2e\//.test(file)
    const looksLikeTest = LOOKS_LIKE_TEST.test(name)
    if (!looksLikeTest && !underE2e) continue
    const source = readFileSync(join(root, file), 'utf8')
    if (!looksLikeTest && !isPlaywrightTest(source)) continue
    bad.push({ file, use: suggestion(file, source) })
  }
  return bad
}

/** Prints the misnamed files and exits 1, or prints one green line. */
export function checkTestNames(root = '.'): void {
  const bad = misnamedTests(root)
  if (bad.length > 0) {
    console.error(c.red(c.bold(`${bad.length} test file(s) with a name the gate doesn't know:`)))
    for (const { file, use } of bad)
      console.error(`  ${c.red('•')} ${file}  → rename to ${c.bold(use)}`)
    console.error(
      c.dim(
        'Every test file is *.rule.test.ts (pure logic), *.api.test.ts (real router, Postgres or IPC) or *.flow.spec.ts (Playwright). CLAUDE.md → Testing.'
      )
    )
    process.exit(1)
  }
  console.log(c.green('✓ test names: every test file is a rule, api or flow test'))
}

if (import.meta.main) checkTestNames()
