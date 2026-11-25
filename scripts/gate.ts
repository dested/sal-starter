// gate.json: this repo's contract with `gate` (the testing-standard repo,
// gate/), the command that runs the four checks (types, rules, api, flows) on
// a clean copy of a commit and reports. Every repo runs it in `report` mode (Sal, 2026-11-20: nothing is
// gated): it records each run and never blocks a push. A fork without the web
// app has no database and no flows, so those entries go.
//
//   bun scripts/gate.ts --fit   gate.json in report mode, fitted to this fork's
//                               surfaces (sync does this; run it once in a fork
//                               whose sync.ts predates it)

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { format, resolveConfig } from 'prettier'
import { z } from 'zod'
import { readProject, type Project } from './project'

export const GATE_FILE = 'gate.json'

export const gateMode = z.enum(['report', 'block'])
export type GateMode = z.infer<typeof gateMode>

// Validated on read; only the fields these scripts change are typed. Edits are
// made on the file's own JSON object, so its key order (and diffs) stay put.
const gateSchema = z.looseObject({
  version: z.literal(1),
  mode: gateMode,
  databases: z.array(z.unknown()).optional(),
  checks: z.array(z.looseObject({ name: z.string() })),
})
const jsonObject = z.record(z.string(), z.unknown())

/** gate.json as written (key order kept), checked against the fields scripts rely on. */
export type GateFile = {
  raw: Record<string, unknown>
  mode: GateMode
  checks: Array<{ name: string }>
}

export function parseGate(text: string): GateFile {
  const raw = jsonObject.parse(JSON.parse(text))
  const { mode, checks } = gateSchema.parse(raw)
  return { raw, mode, checks }
}

export function readGate(): GateFile | null {
  return existsSync(GATE_FILE) ? parseGate(readFileSync(GATE_FILE, 'utf8')) : null
}

export async function writeGate(raw: Record<string, unknown>): Promise<void> {
  const text = await format(JSON.stringify(raw), {
    ...(await resolveConfig(GATE_FILE)),
    parser: 'json',
  })
  writeFileSync(GATE_FILE, text)
}

/** The gate for this fork's surfaces: without web, no database, no flows, no web probe paths. */
export function gateForSurfaces(gate: GateFile, project: Project): Record<string, unknown> {
  if (project.surfaces.includes('web')) return gate.raw
  const { probe: _web, ...rest } = gate.raw
  const setup = z.array(z.string()).optional().parse(gate.raw.setup)
  return {
    ...rest,
    // The Prisma client is web's (`db:generate` doesn't exist without it).
    ...(setup ? { setup: setup.filter((step) => !step.includes('db:generate')) } : {}),
    databases: [],
    checks: gate.checks.filter((c) => c.name !== 'flows'),
    ...(project.surfaces.includes('desktop')
      ? { probe: { include: ['apps/desktop/src/main/**/*.ts'], exclude: [] } }
      : {}),
  }
}

function gitOk(...args: string[]): boolean {
  return spawnSync('git', args, { stdio: 'ignore' }).status === 0
}

/**
 * gate.json in report mode and fitted to this fork's surfaces. Mid-merge
 * (`bun run sync`) the result is staged, so the commit that ends the merge
 * carries it. Returns what it changed, or null when there was nothing to do
 * (no gate.json, or a conflicted one: that is the person's to resolve first).
 */
export async function fitForkGate(): Promise<string | null> {
  if (!existsSync(GATE_FILE)) return null
  if (spawnSync('git', ['ls-files', '-u', '--', GATE_FILE], { encoding: 'utf8' }).stdout !== '')
    return null
  const gate = readGate()
  if (gate === null) return null
  const next = gateForSurfaces({ ...gate, raw: { ...gate.raw, mode: 'report' } }, readProject())
  if (JSON.stringify(next) === JSON.stringify(gate.raw)) return null
  await writeGate(next)
  if (gitOk('rev-parse', '-q', '--verify', 'MERGE_HEAD'))
    spawnSync('git', ['add', '--', GATE_FILE], { stdio: 'ignore' })
  return gate.mode === 'report'
    ? `fitted ${GATE_FILE} to this fork's surfaces`
    : `${GATE_FILE} is in report mode now: gate runs the checks and reports, it never blocks a push`
}

if (import.meta.main) {
  if (process.argv.includes('--fit')) {
    const did = await fitForkGate()
    console.log(did ? `gate: ${did}` : `gate: ${GATE_FILE} already fits`)
  } else {
    console.log(
      'Usage: bun scripts/gate.ts --fit   (gate.json in report mode, fitted to this fork)'
    )
    process.exit(process.argv.includes('--help') ? 0 : 2)
  }
}
