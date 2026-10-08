// The one per-project identity file (`project.json` at the repo root), read and
// validated for the root scripts. app.config.ts validates the same shape for
// Expo; server/env.ts reads `apiPort` through a typed JSON import; the desktop
// app reads `desktopPort` and `appId`.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { z } from 'zod'

export const PROJECT_FILE = 'project.json'

export const SURFACES = ['web', 'mobile', 'desktop'] as const
export type Surface = (typeof SURFACES)[number]

/** The paths each optional surface owns. A fork without the surface has none of them. */
export const SURFACE_PATHS: Record<Surface, string[]> = {
  web: ['apps/web', 'drydock.yaml'],
  mobile: ['apps/mobile', 'packages/native-example'],
  desktop: ['apps/desktop', 'packages/trpc-ipc'],
}

export const projectSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  displayName: z.string().min(1),
  scheme: z.string().regex(/^[a-z][a-z0-9]*$/),
  bundleId: z.string().regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/),
  appId: z.string().regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/),
  surfaces: z.array(z.enum(SURFACES)).min(1),
  apiPort: z.number().int().min(1024).max(65533),
  metroPort: z.number().int().min(1025).max(65535),
  desktopPort: z.number().int().min(1026).max(65535),
  db: z.string().regex(/^[a-z][a-z0-9_]*$/),
  easProjectId: z.string().nullable(),
  appleTeamId: z.string().nullable(),
})

export type Project = z.infer<typeof projectSchema>

// Forks made before `surfaces`/`desktopPort`/`appId` existed: fill them in from
// what's on disk, once. `sync` writes the result back.
const legacySchema = projectSchema.extend({
  appId: projectSchema.shape.appId.optional(),
  surfaces: projectSchema.shape.surfaces.optional(),
  desktopPort: projectSchema.shape.desktopPort.optional(),
})

export function readProject(): Project {
  const raw: unknown = JSON.parse(readFileSync(PROJECT_FILE, 'utf8'))
  const legacy = legacySchema.parse(raw)
  return projectSchema.parse({
    ...legacy,
    appId: legacy.appId ?? legacy.bundleId,
    surfaces: legacy.surfaces ?? SURFACES.filter((s) => existsSync(`apps/${s}`)),
    desktopPort: legacy.desktopPort ?? legacy.apiPort + 2,
  })
}

export function writeProject(project: Project): void {
  writeFileSync(PROJECT_FILE, JSON.stringify(projectSchema.parse(project), null, 2) + '\n')
}

/** Paths of every surface this fork doesn't have (what `sync` keeps deleted). */
export function excludedPaths(project: Project): string[] {
  return SURFACES.filter((s) => !project.surfaces.includes(s)).flatMap((s) => SURFACE_PATHS[s])
}

/** Root package.json scripts that only make sense with a surface present. */
export const SURFACE_SCRIPTS: Record<Surface, Record<string, string>> = {
  web: {
    build: 'bun run --cwd apps/web build',
    start: 'bun run --cwd apps/web start',
    'start:local': 'bun run --cwd apps/web start:local',
    'test:e2e': 'bun run --cwd apps/web test:e2e',
    'test:e2e:ui': 'bun run --cwd apps/web test:e2e:ui',
    'test:e2e:update': 'bun run --cwd apps/web test:e2e:update',
    'db:generate': 'bun run --cwd apps/web db:generate',
    'db:migrate': 'bun run --cwd apps/web db:migrate',
    'db:migrate:create': 'bun run --cwd apps/web db:migrate:create',
    'db:deploy': 'bun run --cwd apps/web db:deploy',
    'db:studio': 'bun run --cwd apps/web db:studio',
  },
  mobile: {},
  desktop: {
    release: 'bun run --cwd apps/desktop release',
  },
}

const packageJsonSchema = z.looseObject({ scripts: z.record(z.string(), z.string()) })

/**
 * Rewrites the root package.json so its scripts match the fork's surfaces:
 * scripts of absent surfaces removed, scripts of present ones (re)added.
 * Returns true when the file changed.
 */
export function syncRootScripts(project: Project): boolean {
  const before = readFileSync('package.json', 'utf8')
  const pkg = packageJsonSchema.parse(JSON.parse(before))
  const scripts: Record<string, string> = {}
  const owned = new Map<string, Surface>()
  for (const s of SURFACES) for (const name of Object.keys(SURFACE_SCRIPTS[s])) owned.set(name, s)
  for (const [name, cmd] of Object.entries(pkg.scripts)) {
    const surface = owned.get(name)
    if (surface === undefined || project.surfaces.includes(surface)) scripts[name] = cmd
  }
  for (const s of project.surfaces) {
    for (const [name, cmd] of Object.entries(SURFACE_SCRIPTS[s])) scripts[name] ??= cmd
  }
  const after = JSON.stringify({ ...pkg, scripts }, null, 2) + '\n'
  if (after === before) return false
  writeFileSync('package.json', after)
  return true
}
