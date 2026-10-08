// One-shot project initializer. After cloning the template:
//
//   git clone https://github.com/dested/sal-starter.git <name> && cd <name>
//   git remote rename origin upstream        # keeps `bun run sync` working
//   bun install && bun run init <name> [--mobile] [--desktop | --desktop-only]
//
// What it does, in order:
//   1. Drops the surfaces you didn't ask for (apps/mobile + packages/native-example,
//      apps/desktop + packages/trpc-ipc, or for --desktop-only apps/web + mobile +
//      drydock.yaml) with their root scripts, in its own commit ("init: web-only",
//      "init: desktop-only", …) so later syncs keep them deleted, and refreshes
//      bun.lock (from scratch when mobile goes). Bring one back with
//      `bun run add:mobile|add:desktop`.
//   2. Renames the template everywhere (sal-starter / sal_starter / "Sal Starter",
//      ports 4780–4782) in git-tracked text files. Links to dested/sal-starter stay.
//   3. Writes the identity file, project.json: name, displayName, scheme,
//      bundleId + appId (com.dested.<scheme>), surfaces, apiPort, metroPort
//      (apiPort + 1), desktopPort (apiPort + 2), db. appleTeamId is kept (same
//      team for every fork); easProjectId resets.
//   4. With web: writes a fresh root `.env` (new auth secret). Then sets the
//      `merge=ours` driver that keeps project.json/drydock.yaml yours on sync,
//      and runs `bun install` to refresh the lockfile.
// Everything after step 1 is left uncommitted for you to review.
//
// Flags:
//   --mobile        keep the Expo app (apps/mobile)
//   --desktop       keep the Electron app (apps/desktop) next to web
//   --desktop-only  keep only the Electron app: no web server, database or auth
//   --port <n>      base port (default: derived from the name, 4100–7997). Never
//                   3000/3001/5173/5174/8000/8080/4200/5000. API n, Metro n + 1,
//                   desktop renderer n + 2.
//   --fresh-git     wipe git history and start a new repo. This severs the link
//                   to sal-starter: no `bun run sync`, no `add:*`.

import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import {
  readProject,
  SURFACE_PATHS,
  SURFACES,
  syncRootScripts,
  writeProject,
  type Project,
  type Surface,
} from './project'
import { c, fail, git, run } from './shell'

const TEMPLATE_NAME = 'sal-starter'
const TEMPLATE_PORT = 4780
const BANNED_PORTS = new Set([3000, 3001, 5173, 5174, 8000, 8080, 4200, 5000])

const args = process.argv.slice(2)
const mobile = args.includes('--mobile')
const desktop = args.includes('--desktop')
const desktopOnly = args.includes('--desktop-only')
const freshGit = args.includes('--fresh-git')
const portFlagIndex = args.indexOf('--port')
const rawPort = portFlagIndex === -1 ? undefined : args[portFlagIndex + 1]
const rawName = args.find(
  (a, i) => !a.startsWith('--') && (portFlagIndex === -1 || i !== portFlagIndex + 1)
)

const usage =
  'Usage: bun run init <project-name> [--mobile] [--desktop | --desktop-only] [--port <n>] [--fresh-git]'
if (!rawName) fail(usage, 'project-name must be lowercase letters, numbers, and dashes.')
if (desktopOnly && (mobile || desktop)) {
  fail('--desktop-only keeps only the desktop app.', 'Drop --mobile/--desktop, or use --desktop.')
}

const name = rawName.trim()
if (!/^[a-z][a-z0-9-]*$/.test(name)) {
  fail(`Invalid name "${name}".`, 'Start with a letter; then lowercase letters, numbers, dashes.')
}
if (name === TEMPLATE_NAME) fail(`Pick a name other than "${TEMPLATE_NAME}".`)

const current = readProject()
if (current.name !== TEMPLATE_NAME) {
  fail(`Already initialized as "${current.name}" (project.json).`, 'init runs once per clone.')
}

const surfaces: Surface[] = desktopOnly
  ? ['desktop']
  : SURFACES.filter(
      (s) => s === 'web' || (s === 'mobile' && mobile) || (s === 'desktop' && desktop)
    )

// The base port and the two above it (Metro, desktop renderer) must all be usable.
const portIsUsable = (p: number) => [p, p + 1, p + 2].every((q) => !BANNED_PORTS.has(q))
const templatePorts = new Set([TEMPLATE_PORT, TEMPLATE_PORT + 1, TEMPLATE_PORT + 2])
const clashesWithTemplate = (p: number) => [p, p + 1, p + 2].some((q) => templatePorts.has(q))

// Deterministic per-name default so two clones never share a port by accident.
function portFromName(n: string): number {
  let hash = 0
  for (const ch of n) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  let port = 4100 + (hash % 3898)
  while (!portIsUsable(port) || clashesWithTemplate(port)) port++
  return port
}

const apiPort = rawPort === undefined ? portFromName(name) : Number(rawPort)
if (!Number.isInteger(apiPort) || apiPort < 1024 || apiPort > 65533 || !portIsUsable(apiPort)) {
  fail(
    `Invalid --port "${rawPort ?? ''}".`,
    `Use an uncommon port 1024–65533 (n + 1 and n + 2 are taken too); never ${[...BANNED_PORTS].join('/')}.`
  )
}

const snake = name.replace(/-/g, '_') // db name / identifiers
const scheme = name.replace(/-/g, '') // URL scheme + bundle id segment
const title = name
  .split('-')
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  .join(' ')

const next: Project = {
  ...current,
  name,
  displayName: title,
  scheme,
  bundleId: `com.dested.${scheme}`,
  appId: `com.dested.${scheme}`,
  surfaces,
  apiPort,
  metroPort: apiPort + 1,
  desktopPort: apiPort + 2,
  db: snake,
  easProjectId: null,
}

// A desktop-only project has no server: no database or auth variables.
function dropServerEnv(): void {
  writeFileSync(
    '.env.example',
    '# Desktop-only: no server, database or auth. Put API keys the main process reads here.\n'
  )
}

// 1. Drop the surfaces this project doesn't have, in their own commit.
const dropped = SURFACES.filter((s) => !surfaces.includes(s))
const present = dropped.flatMap((s) => SURFACE_PATHS[s]).filter((p) => existsSync(p))
if (present.length > 0) {
  git('rm', '-r', '-q', ...present)
  // git rm leaves ignored files (node_modules, build output, generated code).
  for (const p of present) rmSync(p, { recursive: true, force: true })
  syncRootScripts(next)
  if (!surfaces.includes('web')) dropServerEnv()
  // Dropping mobile: re-resolve from scratch, because Bun keeps optional peers
  // (@better-auth/expo's expo-* tree) in the lockfile once they're there, even
  // after the workspace that needed them is gone. Keeping mobile: never
  // re-resolve, the template's lock is the proven Expo tree (a fresh resolve
  // hoists lru-cache 11 over Babel's 5 and Metro dies); a plain install prunes.
  if (dropped.includes('mobile')) rmSync('bun.lock')
  run('bun', 'install')
  git('add', 'bun.lock', 'package.json', '.env.example')
  const label = desktopOnly
    ? 'desktop-only'
    : surfaces.length === 1
      ? 'web-only'
      : surfaces.join(' + ')
  const restore = dropped.filter((s) => s !== 'web').map((s) => `bun run add:${s}`)
  const body =
    restore.length > 0 ? ['-m', `Bring a dropped app back with \`${restore.join('` or `')}\`.`] : []
  git('commit', '-q', '-m', `init: ${label}`, ...body)
  console.log(
    `  ${c.green('removed')} ${c.dim(present.join(', '))} ${c.dim(`(commit "init: ${label}")`)}`
  )
}

// 2. Rename. Order matters: most specific first. `dested/sal-starter` (the
// upstream repo) is left alone so docs and scripts keep pointing at it.
const replacements: Array<[RegExp, string]> = [
  [/(?<!dested\/)sal-starter/g, name],
  [/sal_starter/g, snake],
  [/Sal Starter/g, title],
  [/\bsalstarter\b/g, scheme],
  [new RegExp(`\\b${TEMPLATE_PORT + 2}\\b`, 'g'), String(apiPort + 2)],
  [new RegExp(`\\b${TEMPLATE_PORT + 1}\\b`, 'g'), String(apiPort + 1)],
  [new RegExp(`\\b${TEMPLATE_PORT}\\b`, 'g'), String(apiPort)],
]

// Only git-tracked text files; never the lockfile, the scripts themselves,
// binaries, or project.json (rewritten structurally below).
const SKIP = new Set(['bun.lock', 'project.json'])
const isSkipped = (f: string) =>
  SKIP.has(f) || f.startsWith('scripts/') || /\.(png|jpe?g|gif|ico|svg|webp)$/.test(f)

const tracked = git('ls-files')
  .split('\n')
  .filter(Boolean)
  .filter((f) => !isSkipped(f) && existsSync(f))

let changed = 0
for (const file of tracked) {
  const before = readFileSync(file, 'utf8')
  let after = before
  for (const [re, to] of replacements) after = after.replace(re, to)
  if (after !== before) {
    writeFileSync(file, after)
    changed++
    console.log(`  ${c.green('renamed')} ${c.dim(file)}`)
  }
}

// 3. Identity.
writeProject(next)
console.log(`  ${c.green('wrote')}   project.json`)

// 4. Local env, merge driver, lockfile.
if (!surfaces.includes('web')) {
  console.log(`  ${c.dim('skipped')} .env ${c.dim('(no web server)')}`)
} else if (existsSync('.env')) {
  console.log(`  ${c.dim('kept')}    .env (already exists)`)
} else {
  const secret = randomBytes(32).toString('base64')
  writeFileSync(
    '.env',
    [
      `PORT=${apiPort}`,
      `DATABASE_URL=postgres://postgres:postgres@localhost:5432/${snake}`,
      `BETTER_AUTH_SECRET=${secret}`,
      `BETTER_AUTH_URL=http://localhost:${apiPort}`,
      '',
    ].join('\n')
  )
  console.log(`  ${c.green('wrote')}   .env ${c.dim('(fresh BETTER_AUTH_SECRET)')}`)
}

if (freshGit) {
  rmSync('.git', { recursive: true, force: true })
  git('init', '-q')
  console.log(`  ${c.green('reset')}   git history (new repo; upstream link severed)`)
}

// `project.json merge=ours` / `drydock.yaml merge=ours` in .gitattributes need
// this driver; without it git silently does a normal merge.
git('config', 'merge.ours.driver', 'true')
run('bun', 'install')

const ports = [
  surfaces.includes('web') ? `API ${c.bold(String(apiPort))}` : null,
  surfaces.includes('mobile') ? `Metro ${c.bold(String(apiPort + 1))}` : null,
  surfaces.includes('desktop') ? `desktop renderer ${c.bold(String(apiPort + 2))}` : null,
].filter((p) => p !== null)

console.log()
console.log(c.bold(c.green(`✓ Initialized ${title} (${name}): ${surfaces.join(' + ')}`)))
console.log(`  ${changed} file(s) updated. ${ports.join(', ')} (record them in cliffnotes.md).`)
console.log()
console.log(c.bold('Next steps:'))
const steps: Array<[string, string]> = [[`git diff && git commit -am "init ${name}"`, '']]
if (surfaces.includes('web')) {
  steps.push([`createdb ${snake}`, '# or point .env at any Postgres'])
  steps.push(['bun run db:migrate', '# applies prisma/migrations'])
}
steps.push([
  'bun run dev',
  surfaces.includes('web') ? `# → http://localhost:${apiPort}` : '# opens the desktop window',
])
if (surfaces.includes('mobile')) {
  steps.push(['cd apps/mobile && eas init', '# then put the id in project.json easProjectId'])
}
if (surfaces.includes('desktop')) steps.push(['bun run release', '# unpacked build in release/'])
steps.forEach(([cmd, note], i) =>
  console.log(`  ${c.dim(`${i + 1}.`)} ${cmd.padEnd(30)}${c.dim(note)}`)
)
console.log()
