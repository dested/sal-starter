// Router-wide checks: every procedure has an API test, and the committed access
// table (server/router.access.md) is what the router's tags say.
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { appRouter } from '../server/router'
import { accessTable, committedAccessTable, procedures } from './access-table'

const WEB = fileURLToPath(new URL('..', import.meta.url))
const SKIP = new Set(['node_modules', 'dist', 'generated', 'e2e', 'public'])

function apiTestFiles(dir = WEB): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory())
      return SKIP.has(entry.name) || entry.name.startsWith('.')
        ? []
        : apiTestFiles(join(dir, entry.name))
    return entry.name.endsWith('.api.test.ts') ? [join(dir, entry.name)] : []
  })
}

/** Paths named by a `describe('<path>', …)` in some *.api.test.ts. */
function describedPaths(): Set<string> {
  const found = new Set<string>()
  for (const file of apiTestFiles()) {
    for (const match of readFileSync(file, 'utf8').matchAll(/\bdescribe\(\s*(['"`])([^'"`]+)\1/g)) {
      if (match[2] !== undefined) found.add(match[2])
    }
  }
  return found
}

describe('every procedure has an API test', () => {
  test('a describe block named after each path in appRouter', () => {
    const described = describedPaths()
    const missing = procedures(appRouter)
      .map((p) => p.path)
      .filter((path) => !described.has(path))
    if (missing.length > 0) {
      throw new Error(
        `No API test for: ${missing.join(', ')}.\nAdd describe('<path>', …) to a *.api.test.ts (see server/router.api.test.ts): what it returns, what it writes, what it rejects.`
      )
    }
    expect(missing).toEqual([])
  })

  test('finds the API test files it scans', () => {
    expect(apiTestFiles().map((f) => relative(WEB, f))).toContain('test/procedures.api.test.ts')
  })
})

describe('access table', () => {
  test('server/router.access.md matches the router', () => {
    const generated = accessTable(appRouter)
    const committed = committedAccessTable()
    if (committed !== generated) {
      const was = new Set((committed ?? '').split('\n'))
      const now = new Set(generated.split('\n'))
      const diff = [
        ...[...was].filter((l) => !now.has(l)).map((l) => `- ${l}`),
        ...[...now].filter((l) => !was.has(l)).map((l) => `+ ${l}`),
      ]
      throw new Error(
        `server/router.access.md is ${committed === null ? 'missing' : 'out of date'}. Run \`bun run access:table\`, and say in the commit what permission changed and why.\n${diff.join('\n')}`
      )
    }
    expect(committed).toBe(generated)
  })
})
