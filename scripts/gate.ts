// gate.json: this repo's contract with `gate` (destedtui), the command that runs
// the four checks (types, rules, api, flows) on a clean copy of a commit before
// it may reach main. The template ships it in `block` mode; init keeps that.
// `sync` brings it into an older fork in `report` mode (runs and records, never
// blocks) and never changes a fork's mode after that. A fork without the web
// app has no database and no flows, so those entries go.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { format, resolveConfig } from 'prettier'
import { z } from 'zod'
import type { Project } from './project'

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
