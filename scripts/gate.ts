// gate.json: this repo's contract with `gate` (destedtui), the command that runs
// the four checks (types, rules, api, flows) on a clean copy of a commit before
// it may reach main. The template ships it in `block` mode; init keeps that.
// `sync` brings it into an older fork in `report` mode (runs and records, never
// blocks) and never changes a fork's mode after that. A fork without the web
// app has no database and no flows, so those entries go.
//
//   bun scripts/gate.ts --keep-mode   mid-merge only: gate.json gets the fork's
//                                     mode from HEAD (report if HEAD had none)
//
// The root `postinstall` runs --keep-mode, because a fork's first sync runs the
// fork's OLD sync.ts: `bun install` after the merge is the only new code it runs.
// Outside a merge (a clean copy, a deploy, a fresh clone) it does nothing.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { format, resolveConfig } from 'prettier'
import { z } from 'zod'
import { readProject, type Project } from './project'

export const GATE_FILE = 'gate.json'

export const gateMode = z.enum(['report', 'block'])
export type GateMode = z.infer<typeof gateMode>

// Only the fields these scripts change are typed; the rest passes through.
const gateSchema = z.looseObject({
  version: z.literal(1),
  mode: gateMode,
  databases: z.array(z.unknown()).optional(),
  checks: z.array(z.looseObject({ name: z.string() })),
  probe: z
    .looseObject({
      include: z.array(z.string()),
      exclude: z.array(z.looseObject({ path: z.string(), why: z.string() })).optional(),
    })
    .optional(),
})
export type Gate = z.infer<typeof gateSchema>

export function parseGate(text: string): Gate {
  return gateSchema.parse(JSON.parse(text))
}

export function readGate(): Gate | null {
  return existsSync(GATE_FILE) ? parseGate(readFileSync(GATE_FILE, 'utf8')) : null
}

export async function writeGate(gate: Gate): Promise<void> {
  const text = await format(JSON.stringify(gate), {
    ...(await resolveConfig(GATE_FILE)),
    parser: 'json',
  })
  writeFileSync(GATE_FILE, text)
}

/** The gate for this fork's surfaces: without web, no database, no flows, no web probe paths. */
export function gateForSurfaces(gate: Gate, project: Project): Gate {
  if (project.surfaces.includes('web')) return gate
  const probe = project.surfaces.includes('desktop')
    ? { include: ['apps/desktop/src/main/**/*.ts'], exclude: [] }
    : undefined
  const { probe: _web, ...rest } = gate
  return {
    ...rest,
    databases: [],
    checks: gate.checks.filter((check) => check.name !== 'flows'),
    ...(probe ? { probe } : {}),
  }
}

function gitOk(...args: string[]): boolean {
  return spawnSync('git', args, { stdio: 'ignore' }).status === 0
}

/**
 * During a merge (`bun run sync`): gate.json keeps the mode this fork had at
 * HEAD, or becomes `report` when the fork had no gate.json, and is fitted to
 * the fork's surfaces, and staged. Returns what it did, or null when there was
 * nothing to do.
 */
export async function keepForkMode(): Promise<string | null> {
  if (!existsSync(GATE_FILE) || !gitOk('rev-parse', '-q', '--verify', 'MERGE_HEAD')) return null
  // A conflicted gate.json is the person's to resolve; run again after (bun install).
  if (spawnSync('git', ['ls-files', '-u', '--', GATE_FILE], { encoding: 'utf8' }).stdout !== '')
    return null
  const gate = readGate()
  if (gate === null) return null
  const before = gitOk('cat-file', '-e', `HEAD:${GATE_FILE}`)
    ? parseGate(spawnSync('git', ['show', `HEAD:${GATE_FILE}`], { encoding: 'utf8' }).stdout).mode
    : null
  const mode = before ?? 'report'
  const next = gateForSurfaces({ ...gate, mode }, readProject())
  if (JSON.stringify(next) === JSON.stringify(gate)) return null
  await writeGate(next)
  // Staged with the merge, so the commit that ends it carries this mode.
  spawnSync('git', ['add', '--', GATE_FILE], { stdio: 'ignore' })
  return before
    ? `kept ${GATE_FILE} mode ${mode}`
    : `added ${GATE_FILE} in mode report: gate runs and records, never blocks; set "block" once the four checks pass`
}

if (import.meta.main) {
  if (process.argv.includes('--keep-mode')) {
    try {
      const did = await keepForkMode()
      if (did) console.log(`gate: ${did}`)
    } catch (error) {
      // Never fail an install over this; sync.ts does the same step itself.
      console.warn(
        `gate: could not fit gate.json (${error instanceof Error ? error.message : String(error)})`
      )
    }
  } else {
    console.log(
      "Usage: bun scripts/gate.ts --keep-mode   (mid-merge: keep the fork's gate.json mode)"
    )
  }
}
