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
//      `bun run add:mobile|add:desktop`. With mobile, the native-example package
//      (the template's shared-module demo) goes too, unless --native-example.
//   2. Renames the template everywhere (sal-starter / sal_starter / "Sal Starter",
//      ports 4780–4782) in git-tracked text files. Links to dested/sal-starter stay.
//   3. Writes the identity file, project.json: name, displayName, scheme,
//      bundleId + appId (com.dested.<scheme>), surfaces, apiPort, metroPort
//      (apiPort + 1), desktopPort (apiPort + 2), db. appleTeamId and easOwner are
//      kept (same team and Expo account for every fork); easProjectId resets.
//   4. Starts the fork's own updates.md (the template's task log is noise here;
//      decisions.md stays, its entries bind the fork too).
//   5. With web: writes a fresh root `.env` (new auth secret). Then sets the
//      `merge=ours` driver that keeps the fork's identity, look and logs on sync
//      (.gitattributes), and runs `bun install` to refresh the lockfile.
//   6. With mobile: creates the EAS project under project.json `easOwner`
//      (scripts/eas-setup.ts: easProjectId, APP_VARIANT per EAS environment, a
//      protected production channel). Never fails init: without eas-cli or a
//      login it prints the command to run later.
// Everything after step 1 is left uncommitted for you to review. Then the
// kickoff (.claude/skills/kickoff, `/kickoff` in Claude Code) sets the look.
// Until it does, dev shows a "Kickoff pending" ribbon and `bun run test` fails.
//
// Flags:
//   --mobile        keep the Expo app (apps/mobile)
//   --native-example  with --mobile: keep packages/native-example
//   --no-eas        with --mobile: skip the EAS project (later: bun run --cwd apps/mobile eas:setup)
//   --dry-run-eas   with --mobile: print the EAS commands instead of running them
//   --desktop       keep the Electron app (apps/desktop) next to web
//   --desktop-only  keep only the Electron app: no web server, database or auth
//   --port <n>      base port (default: derived from the name, 4100–7996). Never
//                   3000/3001/5173/5174/8000/8080/4200/5000. API n, Metro n + 1,
//                   desktop renderer n + 2, Playwright e2e n + 3.
//   --fresh-git     wipe git history and start a new repo. This severs the link
//                   to sal-starter: no `bun run sync`, no `add:*`.

import { spawnSync } from 'node:child_process'
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
const keepNativeExample = args.includes('--native-example')
const noEas = args.includes('--no-eas')
const dryRunEas = args.includes('--dry-run-eas')
const portFlagIndex = args.indexOf('--port')
const rawPort = portFlagIndex === -1 ? undefined : args[portFlagIndex + 1]
const rawName = args.find(
  (a, i) => !a.startsWith('--') && (portFlagIndex === -1 || i !== portFlagIndex + 1)
)

const usage =
  'Usage: bun run init <project-name> [--mobile [--native-example] [--no-eas | --dry-run-eas]] [--desktop | --desktop-only] [--port <n>] [--fresh-git]'
if (!rawName) fail(usage, 'project-name must be lowercase letters, numbers, and dashes.')
if (desktopOnly && (mobile || desktop)) {
  fail('--desktop-only keeps only the desktop app.', 'Drop --mobile/--desktop, or use --desktop.')
}
if (!mobile && (keepNativeExample || noEas || dryRunEas)) {
  fail('--native-example, --no-eas and --dry-run-eas only apply with --mobile.')
}
if (noEas && dryRunEas) fail('Pick one of --no-eas and --dry-run-eas.')

const name = rawName.trim()
if (!/^[a-z][a-z0-9-]*$/.test(name)) {
  fail(`Invalid name "${name}".`, 'Start with a letter; then lowercase letters, numbers, dashes.')
}
if (name === TEMPLATE_NAME) fail(`Pick a name other than "${TEMPLATE_NAME}".`)

const current = readProject()
if (current.name !== TEMPLATE_NAME) {
  fail(`Already initialized as "${current.name}" (project.json).`, 'init runs once per clone.')
}
const templateSha = git('rev-parse', '--short', 'HEAD')

const surfaces: Surface[] = desktopOnly
  ? ['desktop']
  : SURFACES.filter(
      (s) => s === 'web' || (s === 'mobile' && mobile) || (s === 'desktop' && desktop)
    )

// The base port and the three above it (Metro, desktop renderer, e2e) must all be usable.
const portBlock = (p: number) => [p, p + 1, p + 2, p + 3]
const portIsUsable = (p: number) => portBlock(p).every((q) => !BANNED_PORTS.has(q))
const templatePorts = new Set(portBlock(TEMPLATE_PORT))
const clashesWithTemplate = (p: number) => portBlock(p).some((q) => templatePorts.has(q))

// Deterministic per-name default so two clones never share a port by accident.
function portFromName(n: string): number {
  let hash = 0
  for (const ch of n) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  let port = 4100 + (hash % 3897)
  while (!portIsUsable(port) || clashesWithTemplate(port)) port++
  return port
}

const apiPort = rawPort === undefined ? portFromName(name) : Number(rawPort)
if (!Number.isInteger(apiPort) || apiPort < 1024 || apiPort > 65532 || !portIsUsable(apiPort)) {
  fail(
    `Invalid --port "${rawPort ?? ''}".`,
    `Use an uncommon port 1024–65532 (n + 1 to n + 3 are taken too); never ${[...BANNED_PORTS].join('/')}.`
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
  // The template's own look is a placeholder; a fork has none until its kickoff.
  look: null,
}

// A desktop-only project has no server: no database or auth variables.
function dropServerEnv(): void {
  writeFileSync(
    '.env.example',
    '# Desktop-only: no server, database or auth. Put API keys the main process reads here.\n'
  )
}

// The native-example demo (packages/native-example) is wired into the mobile
// app in these places; a fork with mobile drops all of it unless
// --native-example. Checked before anything is deleted, so a template edit
// that moves one fails here, not halfway through.
const NATIVE_EXAMPLE_PATHS = [
  'packages/native-example',
  'apps/mobile/src/components/native-example-row.tsx',
]
const NATIVE_EXAMPLE_EDITS: Array<[string, RegExp]> = [
  ['apps/mobile/package.json', /^[ \t]*"@app\/native-example": "workspace:\*",\n/m],
  ['apps/mobile/app.config.ts', /^[ \t]*'@app\/native-example',\n/m],
  [
    'apps/mobile/src/screens/home.tsx',
    /^import \{ NativeExampleRow \} from '~\/components\/native-example-row'\n/m,
  ],
  ['apps/mobile/src/screens/home.tsx', /^[ \t]*<NativeExampleRow \/>\n/m],
]
const dropNativeExample = surfaces.includes('mobile') && !keepNativeExample
if (dropNativeExample) {
  for (const [file, re] of NATIVE_EXAMPLE_EDITS) {
    if (!re.test(readFileSync(file, 'utf8'))) {
      fail(
        `init: ${file} no longer matches ${re}.`,
        'Update NATIVE_EXAMPLE_EDITS in scripts/init.ts to the template, or pass --native-example.'
      )
    }
  }
}

// 1. Drop the surfaces this project doesn't have (and the native-example demo),
// in their own commit.
const dropped = SURFACES.filter((s) => !surfaces.includes(s))
const present = [
  ...dropped.flatMap((s) => SURFACE_PATHS[s]),
  ...(dropNativeExample ? NATIVE_EXAMPLE_PATHS : []),
].filter((p) => existsSync(p))
if (present.length > 0) {
  git('rm', '-r', '-q', ...present)
  // git rm leaves ignored files (node_modules, build output, generated code).
  for (const p of present) rmSync(p, { recursive: true, force: true })
  syncRootScripts(next)
  if (!surfaces.includes('web')) dropServerEnv()
  const edited = new Set<string>()
  if (dropNativeExample) {
    for (const [file, re] of NATIVE_EXAMPLE_EDITS) {
      writeFileSync(file, readFileSync(file, 'utf8').replace(re, ''))
      edited.add(file)
    }
  }
  // Dropping mobile: re-resolve from scratch, because Bun keeps optional peers
  // (@better-auth/expo's expo-* tree) in the lockfile once they're there, even
  // after the workspace that needed them is gone. Keeping mobile: never
  // re-resolve, the template's lock is the proven Expo tree (on SDK 57 a fresh
  // resolve hoisted lru-cache 11 over Babel's 5 and Metro died); a plain
  // install prunes.
  if (dropped.includes('mobile')) rmSync('bun.lock')
  run('bun', 'install')
  git('add', 'bun.lock', 'package.json', '.env.example', ...edited)
  const label =
    (desktopOnly ? 'desktop-only' : surfaces.length === 1 ? 'web-only' : surfaces.join(' + ')) +
    (dropNativeExample ? ' (no native-example)' : '')
  const restore = dropped.filter((s) => s !== 'web').map((s) => `bun run add:${s}`)
  const body = [
    ...(restore.length > 0
      ? ['-m', `Bring a dropped app back with \`${restore.join('` or `')}\`.`]
      : []),
    ...(dropNativeExample
      ? ['-m', 'packages/native-example dropped (`init --native-example` keeps it).']
      : []),
  ]
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
  [new RegExp(`\\b${TEMPLATE_PORT + 3}\\b`, 'g'), String(apiPort + 3)],
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

// 4. The fork's own task log.
writeFileSync(
  'updates.md',
  [
    `# ${name} — Updates`,
    '',
    '> Terse, newest-first log: what was asked → what was done. One entry per finished task.',
    '',
    `## ${new Date().toISOString().slice(0, 10)} — init from sal-starter`,
    '',
    `Ran \`bun run init ${args.join(' ')}\` on dested/sal-starter ${templateSha} (${surfaces.join(' + ')}). Next: the kickoff (look, \`/\`, icon).`,
    'Touched: everything `init` renames, project.json, updates.md',
    '',
  ].join('\n')
)
console.log(
  `  ${c.green('wrote')}   updates.md ${c.dim('(fresh log; the template keeps its own)')}`
)

// 5. Local env, merge driver, lockfile.
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

// The `merge=ours` entries in .gitattributes (project.json, drydock.yaml, the
// look, the logs) need this driver; without it git silently does a normal merge.
git('config', 'merge.ours.driver', 'true')
run('bun', 'install')

// 6. The EAS project (mobile). Its own script, so it can run again later.
const EAS_LATER = 'bun run --cwd apps/mobile eas:setup'
let easPending = false
if (surfaces.includes('mobile')) {
  if (noEas) {
    easPending = true
    console.log(`  ${c.dim('skipped')} EAS project ${c.dim(`(--no-eas; later: ${EAS_LATER})`)}`)
  } else {
    const easArgs = ['scripts/eas-setup.ts', ...(dryRunEas ? ['--dry-run'] : [])]
    const eas = spawnSync('bun', easArgs, { stdio: 'inherit' })
    // 0 done or dry run; anything else (2 skipped, 1 failed) leaves it for later.
    easPending = dryRunEas || eas.status !== 0
  }
}

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
steps.push(['/kickoff in Claude Code', '# the look, `/`, icon: before any feature work'])
if (easPending) steps.push([EAS_LATER, '# the EAS project: easProjectId, APP_VARIANT, channels'])
if (surfaces.includes('desktop')) steps.push(['bun run release', '# unpacked build in release/'])
steps.forEach(([cmd, note], i) =>
  console.log(`  ${c.dim(`${i + 1}.`)} ${cmd.padEnd(30)}${c.dim(note)}`)
)
console.log()
