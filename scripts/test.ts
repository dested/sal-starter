// The root test runner: one kind of test across every workspace that has it,
// one workspace at a time, output unprefixed (each bun test summary stays
// whole, for people and for gate's parser). Stops at the first red workspace.
//
//   bun scripts/test.ts rules   names check, then every workspace's test:rules
//   bun scripts/test.ts api     every workspace's test:api
//
// `bun run test:rules` / `test:api` call this; `bun run test` is rules then api.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { z } from 'zod'
import { c } from './shell'
import { checkTestNames } from './test-names'

const kinds = ['rules', 'api'] as const
const kind = z.enum(kinds).safeParse(process.argv[2])
if (!kind.success) {
  console.error(`Usage: bun scripts/test.ts <${kinds.join('|')}>`)
  process.exit(2)
}
const script = `test:${kind.data}`

if (kind.data === 'rules') checkTestNames()

const pkgSchema = z.object({
  name: z.string(),
  scripts: z.record(z.string(), z.string()).optional(),
})

const workspaces = ['apps', 'packages']
  .filter((dir) => existsSync(dir))
  .flatMap((dir) => readdirSync(dir).map((name) => join(dir, name)))
  .filter((dir) => existsSync(join(dir, 'package.json')))
  .map((dir) => ({
    dir,
    pkg: pkgSchema.parse(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))),
  }))
  .filter(({ pkg }) => pkg.scripts?.[script] !== undefined)
  .sort((a, b) => a.dir.localeCompare(b.dir))

if (workspaces.length === 0) {
  console.error(c.red(`No workspace has a ${script} script: zero tests is a failure, not a pass.`))
  process.exit(1)
}

for (const { dir, pkg } of workspaces) {
  console.log(c.bold(`\n› ${pkg.name} ${script}`))
  const result = spawnSync('bun', ['run', script], { cwd: dir, stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(
      c.red(
        `\n✗ ${pkg.name} ${script} failed (exit ${result.status ?? 'signal'}). Rerun: bun run --cwd ${dir} ${script}`
      )
    )
    process.exit(result.status ?? 1)
  }
}
console.log(c.green(`\n✓ ${script}: ${workspaces.map((w) => w.pkg.name).join(', ')}`))
