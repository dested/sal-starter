// The one per-project identity file (`project.json` at the repo root), read and
// validated for the root scripts. app.config.ts validates the same shape for
// Expo; server/env.ts reads `apiPort` through a typed JSON import.

import { readFileSync, writeFileSync } from 'node:fs'
import { z } from 'zod'

export const PROJECT_FILE = 'project.json'

export const projectSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  displayName: z.string().min(1),
  scheme: z.string().regex(/^[a-z][a-z0-9]*$/),
  bundleId: z.string().regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/),
  apiPort: z.number().int().min(1024).max(65534),
  metroPort: z.number().int().min(1025).max(65535),
  db: z.string().regex(/^[a-z][a-z0-9_]*$/),
  easProjectId: z.string().nullable(),
  appleTeamId: z.string().nullable(),
})

export type Project = z.infer<typeof projectSchema>

export function readProject(): Project {
  const raw: unknown = JSON.parse(readFileSync(PROJECT_FILE, 'utf8'))
  return projectSchema.parse(raw)
}

export function writeProject(project: Project): void {
  writeFileSync(PROJECT_FILE, JSON.stringify(projectSchema.parse(project), null, 2) + '\n')
}
