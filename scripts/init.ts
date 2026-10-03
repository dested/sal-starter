// One-shot project initializer. After cloning the template:
//
//   git clone https://github.com/dested/sal-starter.git <name> && cd <name>
//   git remote rename origin upstream        # keeps `bun run sync` working
//   bun install && bun run init <name> [--mobile]
//
// What it does, in order:
//   1. Web-only (no --mobile): removes apps/mobile + packages/native-example in
//      its own commit, "init: web-only", so later syncs can recognise those
//      deletions. Bring mobile back any time with `bun run add:mobile`.
//   2. Renames the template everywhere (sal-starter / sal_starter / "Sal Starter",
//      port 4780) in git-tracked text files. Links to dested/sal-starter stay.
//   3. Writes the identity file, project.json: name, displayName, scheme,
//      bundleId (com.dested.<scheme>), apiPort, metroPort (apiPort + 1), db.
//      appleTeamId is kept (same team for every fork); easProjectId resets.
//   4. Writes a fresh root `.env` (new auth secret), sets the `merge=ours`
//      driver that keeps project.json/drydock.yaml yours on sync, and runs
//      `bun install` to refresh the lockfile.
// Everything after step 1 is left uncommitted for you to review.
//
// Flags:
//   --mobile      keep the Expo app (apps/mobile)
//   --port <n>    API port (default: derived from the name, 4100–7998). Never
//                 3000/3001/5173/5174/8000/8080/4200/5000. Metro gets n + 1.
//   --fresh-git   wipe git history and start a new repo. This severs the link
//                 to sal-starter: no `bun run sync`, no `add:mobile`.

import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { readProject, writeProject } from './project'
import { c, fail, git, MOBILE_PATHS, run } from './shell'

const TEMPLATE_NAME = 'sal-starter'
const TEMPLATE_PORT = 4780
const BANNED_PORTS = new Set([3000, 3001, 5173, 5174, 8000, 8080, 4200, 5000])

const args = process.argv.slice(2)
const mobile = args.includes('--mobile')
const freshGit = args.includes('--fresh-git')
const portFlagIndex = args.indexOf('--port')
const rawPort = portFlagIndex === -1 ? undefined : args[portFlagIndex + 1]
const rawName = args.find(
  (a, i) => !a.startsWith('--') && (portFlagIndex === -1 || i !== portFlagIndex + 1)
)

if (!rawName) {
  fail(
    'Usage: bun run init <project-name> [--mobile] [--port <n>] [--fresh-git]',
    'project-name must be lowercase letters, numbers, and dashes.'
  )
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

const portIsUsable = (p: number) => !BANNED_PORTS.has(p) && !BANNED_PORTS.has(p + 1)

// Deterministic per-name default so two clones never share a port by accident.
function portFromName(n: string): number {
  let hash = 0
  for (const ch of n) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  let port = 4100 + (hash % 3899)
  while (!portIsUsable(port) || port === TEMPLATE_PORT || port + 1 === TEMPLATE_PORT) port++
  return port
}

const apiPort = rawPort === undefined ? portFromName(name) : Number(rawPort)
if (!Number.isInteger(apiPort) || apiPort < 1024 || apiPort > 65534 || !portIsUsable(apiPort)) {
  fail(
    `Invalid --port "${rawPort ?? ''}".`,
    `Use an uncommon port 1024–65534 (Metro takes n + 1); never ${[...BANNED_PORTS].join('/')}.`
  )
}

const snake = name.replace(/-/g, '_') // db name / identifiers
const scheme = name.replace(/-/g, '') // URL scheme + bundle id segment
const title = name
  .split('-')
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  .join(' ')

// 1. Web-only: drop the mobile parts in their own commit.
if (!mobile) {
  const present = MOBILE_PATHS.filter((p) => existsSync(p))
  if (present.length > 0) {
    git('rm', '-r', '-q', ...present)
    // Re-resolve from scratch: Bun keeps @better-auth/expo's optional expo-*
    // peers (and the whole Expo/Metro tree behind them) once they're in the
    // lockfile, even after the workspace that needed them is gone.
    rmSync('bun.lock')
    run('bun', 'install')
    git('add', 'bun.lock')
    git(
      'commit',
      '-q',
      '-m',
      'init: web-only',
      '-m',
      'Bring the Expo app back with `bun run add:mobile`.'
    )
    console.log(
      `  ${c.green('removed')} ${c.dim(present.join(', '))} ${c.dim('(commit "init: web-only")')}`
    )
  }
}

// 2. Rename. Order matters: most specific first. `dested/sal-starter` (the
// upstream repo) is left alone so docs and scripts keep pointing at it.
const replacements: Array<[RegExp, string]> = [
  [/(?<!dested\/)sal-starter/g, name],
  [/sal_starter/g, snake],
  [/Sal Starter/g, title],
  [/\bsalstarter\b/g, scheme],
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
writeProject({
  ...current,
  name,
  displayName: title,
  scheme,
  bundleId: `com.dested.${scheme}`,
  apiPort,
  metroPort: apiPort + 1,
  db: snake,
  easProjectId: null,
})
console.log(`  ${c.green('wrote')}   project.json`)

// 4. Local env, merge driver, lockfile.
if (existsSync('.env')) {
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

console.log()
console.log(c.bold(c.green(`✓ Initialized ${title} (${name})${mobile ? ' with mobile' : ''}`)))
console.log(
  `  ${changed} file(s) updated. API ${c.bold(String(apiPort))}` +
    (mobile ? `, Metro ${c.bold(String(apiPort + 1))}` : '') +
    ' (record them in cliffnotes.md).'
)
console.log()
console.log(c.bold('Next steps:'))
console.log(`  ${c.dim('1.')} git diff && git commit -am "init ${name}"`)
console.log(
  `  ${c.dim('2.')} createdb ${snake}              ${c.dim('# or point .env at any Postgres')}`
)
console.log(`  ${c.dim('3.')} bun run db:migrate           ${c.dim('# applies prisma/migrations')}`)
console.log(
  `  ${c.dim('4.')} bun run dev                  ${c.dim(`# → http://localhost:${apiPort}`)}`
)
if (mobile) {
  console.log(
    `  ${c.dim('5.')} cd apps/mobile && eas init   ${c.dim('# then put the id in project.json easProjectId')}`
  )
}
console.log()
