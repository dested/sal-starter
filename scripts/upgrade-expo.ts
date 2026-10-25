// Upgrade Expo in this repo (the template or any fork), inside the 3-day
// release-age window (bunfig.toml minimumReleaseAge):
//
//   bun run upgrade:expo              newest patch of the current SDK
//   bun run upgrade:expo --sdk 59     a major (read .claude/skills/upgrade-expo first)
//   bun run upgrade:expo --check      report only: target, what's still blocked, what would change
//   bun run upgrade:expo --json       one JSON result on stdout (logs go to stderr)
//
// It picks the newest `expo` of the SDK that is older than the release age and
// whose companion versions (expo's bundledNativeModules.json) are installable
// too, lists the newer releases still blocked and when they clear, then:
// aligns the root catalog's react / react-dom / @types/react(-dom) to the SDK's
// React, bumps `expo` in every workspace that has it, runs
// `EXPO_OFFLINE=1 expo install --fix` (react-native and every Expo-managed
// package), keeps `catalog:` references, checks Uniwind's RN floor, runs
// doctor + the mobile typecheck, and compares the fingerprint before and after:
// "native changed: rebuild the dev client" or "JS-only: hot reload is enough".
//
// Exit codes: 0 up to date or upgraded · 3 (--check) an upgrade is available now ·
// 1 failed (network, install, typecheck).

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { readProject } from './project'
import { c, git } from './shell'

const MOBILE = 'apps/mobile'
const REGISTRY = (process.env.NPM_CONFIG_REGISTRY ?? 'https://registry.npmjs.org').replace(
  /\/$/,
  ''
)
// The newest RN minor each Uniwind release is known to support (CLAUDE.md
// "Versions"). An RN above the last row is unknown territory: check Uniwind's
// releases and add a row.
const UNIWIND_FLOOR: Array<{ rn: string; uniwind: string }> = [{ rn: '0.88', uniwind: '1.13.0' }]

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(
    [
      'Usage: bun run upgrade:expo [--sdk <n>] [--check] [--json]',
      '  --sdk <n>  target SDK major (default: the installed one, newest patch)',
      '  --check    report target, blocked releases and planned changes; change nothing',
      '  --json     print one JSON result on stdout',
      'Exit codes: 0 up to date or upgraded, 3 (--check) upgrade available, 1 failed.',
    ].join('\n')
  )
  process.exit(0)
}
const check = args.includes('--check')
const json = args.includes('--json')
const sdkFlag = args.indexOf('--sdk')
const sdkArg = sdkFlag === -1 ? undefined : Number(args[sdkFlag + 1])
const log = (line = '') => (json ? console.error(line) : console.log(line))

process.chdir(join(import.meta.dir, '..'))
if (!existsSync(MOBILE)) fail('No apps/mobile in this project (bun run add:mobile brings it back).')
if (sdkArg !== undefined && !Number.isInteger(sdkArg)) fail('--sdk takes a major, e.g. --sdk 59.')

type Blocked = { name: string; version: string; publishedAt: string; clearsAt: string }
type Change = { name: string; from: string; to: string; where: string }
type Result = {
  status: 'up-to-date' | 'available' | 'upgraded' | 'failed'
  releaseAgeDays: number
  current: { expo: string; sdk: number; react: string; reactNative: string }
  target: { expo: string; react: string; reactNative: string } | null
  blocked: Blocked[]
  changes: Change[]
  warnings: string[]
  fingerprint: {
    before: Record<string, string>
    after: Record<string, string>
    nativeChanged: boolean
  } | null
  doctor: 'pass' | 'fail' | null
  typecheck: 'pass' | 'fail' | null
}
const result: Result = {
  status: 'up-to-date',
  releaseAgeDays: 0,
  current: { expo: '', sdk: 0, react: '', reactNative: '' },
  target: null,
  blocked: [],
  changes: [],
  warnings: [],
  fingerprint: null,
  doctor: null,
  typecheck: null,
}

function fail(message: string): never {
  result.status = 'failed'
  result.warnings.push(message)
  log(c.red(message))
  if (json) console.log(JSON.stringify(result, null, 2))
  process.exit(1)
}

// --- inputs -----------------------------------------------------------------

const pkgSchema = z.record(z.string(), z.unknown())
const depsSchema = z.record(z.string(), z.string())
const readJson = (path: string) => pkgSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
const deps = (pkg: Record<string, unknown>, key: string) => depsSchema.parse(pkg[key] ?? {})
const installed = (name: string): string | null => {
  const path = join('node_modules', name, 'package.json')
  if (!existsSync(path)) return null
  return z.object({ version: z.string() }).parse(JSON.parse(readFileSync(path, 'utf8'))).version
}

const ageSeconds = Number(
  /^\s*minimumReleaseAge\s*=\s*(\d+)/m.exec(
    existsSync('bunfig.toml') ? readFileSync('bunfig.toml', 'utf8') : ''
  )?.[1] ?? 0
)
result.releaseAgeDays = ageSeconds / 86400
const cutoff = Date.now() - ageSeconds * 1000

const mobilePkg = readJson(join(MOBILE, 'package.json'))
const mobileDeps = { ...deps(mobilePkg, 'dependencies'), ...deps(mobilePkg, 'devDependencies') }
const excluded = new Set(
  z
    .object({ install: z.object({ exclude: z.array(z.string()) }).partial() })
    .partial()
    .parse(mobilePkg.expo ?? {}).install?.exclude ?? []
)
const currentExpo = installed('expo') ?? fail('expo is not installed: run bun install first.')
const sdk = sdkArg ?? Number(currentExpo.split('.')[0])
if (sdk < Number(currentExpo.split('.')[0]))
  fail(`expo ${currentExpo} is already past SDK ${sdk}: no downgrades.`)
result.current = {
  expo: currentExpo,
  sdk: Number(currentExpo.split('.')[0]),
  react: installed('react') ?? '?',
  reactNative: installed('react-native') ?? '?',
}

// --- registry ---------------------------------------------------------------

const packumentSchema = z.object({
  versions: z.record(z.string(), z.unknown()),
  time: z.record(z.string(), z.string()),
})
type Packument = z.infer<typeof packumentSchema>
const packuments = new Map<string, Promise<Packument>>()
function packument(name: string): Promise<Packument> {
  let p = packuments.get(name)
  if (p === undefined) {
    p = fetch(`${REGISTRY}/${name.replace('/', '%2F')}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${name}: HTTP ${r.status}`))))
      .then((body) => packumentSchema.parse(body))
    packuments.set(name, p)
  }
  return p
}

const bundledSchema = z.record(z.string(), z.string())
async function bundled(expoVersion: string): Promise<Record<string, string>> {
  for (const base of ['https://cdn.jsdelivr.net/npm', 'https://unpkg.com']) {
    const r = await fetch(`${base}/expo@${expoVersion}/bundledNativeModules.json`).catch(() => null)
    if (r?.ok) return bundledSchema.parse(await r.json())
  }
  throw new Error(`could not fetch expo@${expoVersion}/bundledNativeModules.json`)
}

const published = (p: Packument, v: string) => Date.parse(p.time[v] ?? '')
const allowed = (p: Packument, v: string) => published(p, v) <= cutoff
const clears = (p: Packument, v: string) => new Date(published(p, v) + ageSeconds * 1000)
const iso = (d: Date) => d.toISOString().replace(/:\d\d\.\d+Z$/, 'Z')
const stable = (v: string) => !v.includes('-')
const newestFirst = (a: string, b: string) => Bun.semver.order(b, a)

/** Newest allowed version satisfying `range`, or the oldest blocked one that would (for its clear time). */
async function resolveRange(
  name: string,
  range: string
): Promise<{ ok: string } | { blocked: Blocked } | { missing: true }> {
  const p = await packument(name)
  const matching = Object.keys(p.versions)
    .filter((v) => stable(v) && Bun.semver.satisfies(v, range))
    .sort(newestFirst)
  const ok = matching.find((v) => allowed(p, v))
  if (ok !== undefined) return { ok }
  const first = matching.at(-1)
  if (first === undefined) return { missing: true }
  return {
    blocked: {
      name,
      version: first,
      publishedAt: iso(new Date(published(p, first))),
      clearsAt: iso(clears(p, first)),
    },
  }
}

/** The packages expo install --fix would move, for a given expo's bundled list. */
async function companions(list: Record<string, string>) {
  const moves: Array<{ name: string; range: string; from: string }> = []
  for (const [name, range] of Object.entries(list)) {
    const spec = mobileDeps[name]
    if (spec === undefined || excluded.has(name) || name === 'expo') continue
    const have = installed(name)
    if (have !== null && Bun.semver.satisfies(have, range)) continue
    moves.push({ name, range, from: have ?? spec })
  }
  return moves
}

// --- plan -------------------------------------------------------------------

async function plan() {
  const expo = await packument('expo')
  const candidates = Object.keys(expo.versions)
    .filter((v) => stable(v) && Number(v.split('.')[0]) === sdk)
    .sort(newestFirst)
  if (candidates.length === 0) fail(`No stable expo ${sdk}.x on the registry.`)

  // Newer than anything installable: report each with its clear time.
  for (const v of candidates) {
    if (allowed(expo, v) || Bun.semver.order(v, currentExpo) <= 0) continue
    result.blocked.push({
      name: 'expo',
      version: v,
      publishedAt: iso(new Date(published(expo, v))),
      clearsAt: iso(clears(expo, v)),
    })
  }
  // What the newest release will also need (so "expo clears" isn't the whole story).
  const newest = candidates[0]
  if (newest !== undefined && !allowed(expo, newest)) {
    for (const move of await companions(await bundled(newest))) {
      const r = await resolveRange(move.name, move.range)
      if ('blocked' in r) result.blocked.push(r.blocked)
    }
  }

  // The newest allowed expo whose companions are all installable now.
  for (const v of candidates.filter((x) => allowed(expo, x)).slice(0, 6)) {
    const list = await bundled(v)
    const moves = await companions(list)
    const resolved = await Promise.all(moves.map((m) => resolveRange(m.name, m.range)))
    const stuck = moves.filter((_, i) => !('ok' in (resolved[i] ?? { missing: true })))
    if (stuck.length > 0) {
      result.warnings.push(
        `expo ${v} skipped: ${stuck.map((m) => `${m.name}@${m.range}`).join(', ')} not installable yet`
      )
      continue
    }
    return { expoVersion: v, list, moves, resolved }
  }
  return null
}

const picked = await plan().catch((e: unknown) =>
  fail(`Registry lookup failed: ${e instanceof Error ? e.message : String(e)}`)
)

const rootPkg = readJson('package.json')
const workspaces = z.looseObject({ catalog: depsSchema.optional() }).parse(rootPkg.workspaces ?? {})
const catalog = workspaces.catalog ?? {}

if (picked !== null) {
  const react = picked.list.react ?? result.current.react
  const reactNative = picked.list['react-native'] ?? result.current.reactNative
  result.target = { expo: picked.expoVersion, react, reactNative }
  if (Bun.semver.order(picked.expoVersion, currentExpo) > 0) {
    result.changes.push({
      name: 'expo',
      from: currentExpo,
      to: picked.expoVersion,
      where: 'workspaces',
    })
  }
  // React is a catalog pin shared with web and desktop: one copy (CLAUDE.md rule 19).
  const [maj, min] = react.split('.')
  const wanted: Record<string, string> = {
    react,
    'react-dom': react,
    '@types/react': `~${maj}.${min}.0`,
    '@types/react-dom': `~${maj}.${min}.0`,
  }
  for (const [name, to] of Object.entries(wanted)) {
    const from = catalog[name]
    if (from !== undefined && from !== to) result.changes.push({ name, from, to, where: 'catalog' })
  }
  picked.moves.forEach((m, i) => {
    const r = picked.resolved[i]
    if (m.name === 'react' || r === undefined || !('ok' in r)) return
    result.changes.push({ name: m.name, from: m.from, to: r.ok, where: MOBILE })
  })

  // Uniwind's RN floor.
  const rnMinor = reactNative.split('.').slice(0, 2).join('.')
  const uniwind = installed('uniwind')
  const row = UNIWIND_FLOOR.find((r) => r.rn === rnMinor)
  const known = UNIWIND_FLOOR.at(-1)
  if (
    row === undefined &&
    known !== undefined &&
    Bun.semver.order(`${rnMinor}.0`, `${known.rn}.0`) > 0
  ) {
    result.warnings.push(
      `RN ${reactNative} is above the newest RN a known Uniwind supports (${known.rn} → uniwind ${known.uniwind}). ` +
        'Check https://github.com/uni-stack/uniwind/releases, pin the version that supports it in apps/mobile, and add a UNIWIND_FLOOR row.'
    )
  } else if (row !== undefined && uniwind !== null && Bun.semver.order(uniwind, row.uniwind) < 0) {
    result.warnings.push(`RN ${rnMinor} needs uniwind >= ${row.uniwind} (installed ${uniwind}).`)
  }
}
result.status = result.changes.length > 0 ? 'available' : 'up-to-date'

// --- report -----------------------------------------------------------------

log(c.bold(`Expo SDK ${sdk}`) + c.dim(` (release age ${result.releaseAgeDays} days)`))
log(
  `  installed  expo ${currentExpo} · react-native ${result.current.reactNative} · react ${result.current.react}`
)
if (result.target === null) log(c.yellow(`  no expo ${sdk}.x is installable yet`))
else
  log(
    `  target     expo ${result.target.expo} · react-native ${result.target.reactNative} · react ${result.target.react}`
  )
for (const b of result.blocked) {
  log(
    c.yellow(`  blocked    ${b.name} ${b.version}`) +
      c.dim(` (published ${b.publishedAt}, clears ${b.clearsAt})`)
  )
}
for (const ch of result.changes)
  log(`  change     ${ch.name} ${ch.from} → ${ch.to} ${c.dim(ch.where)}`)
for (const w of result.warnings) log(c.yellow(`  warning    ${w}`))
if (result.changes.length === 0) {
  log(
    c.green(result.blocked.length > 0 ? '  up to date (newest installable today)' : '  up to date')
  )
}

if (check || result.changes.length === 0 || picked === null || result.target === null) {
  if (json) console.log(JSON.stringify(result, null, 2))
  process.exit(check && result.changes.length > 0 ? 3 : 0)
}

// --- upgrade ----------------------------------------------------------------

function run(cwd: string, cmd: string, cmdArgs: string[], env: Record<string, string> = {}) {
  log(c.dim(`› ${cwd === '.' ? '' : `(${cwd}) `}${cmd} ${cmdArgs.join(' ')}`))
  return spawnSync(cmd, cmdArgs, {
    cwd,
    stdio: ['ignore', json ? 2 : 1, 2],
    env: { ...process.env, ...env },
  }).status
}

function fingerprints(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const platform of ['ios', 'android']) {
    const r = spawnSync('bun', ['scripts/fingerprint.ts', '--platform', platform], {
      cwd: MOBILE,
      encoding: 'utf8',
    })
    out[platform] = r.status === 0 ? r.stdout.trim() : 'unknown'
  }
  return out
}

const before = fingerprints()
const target = result.target

// 1. Catalog (React) and every workspace's `expo`.
const catalogChanges = result.changes.filter((ch) => ch.where === 'catalog')
if (catalogChanges.length > 0) {
  const nextCatalog = { ...catalog }
  for (const ch of catalogChanges) nextCatalog[ch.name] = ch.to
  writeFileSync(
    'package.json',
    JSON.stringify({ ...rootPkg, workspaces: { ...workspaces, catalog: nextCatalog } }, null, 2) +
      '\n'
  )
}
const workspaceFiles = ['apps', 'packages']
  .filter((d) => existsSync(d))
  .flatMap((d) => readdirSync(d).map((name) => join(d, name, 'package.json')))
  .filter((f) => existsSync(f))
const catalogRefs = new Map<string, string[]>()
for (const file of workspaceFiles) {
  const pkg = readJson(file)
  let touched = false
  const next: Record<string, unknown> = { ...pkg }
  for (const key of ['dependencies', 'devDependencies']) {
    const d = deps(pkg, key)
    const refs = Object.entries(d)
      .filter(([, spec]) => spec === 'catalog:')
      .map(([n]) => n)
    catalogRefs.set(`${file}#${key}`, refs)
    if (d.expo !== undefined && d.expo !== `~${target.expo}`) {
      next[key] = { ...d, expo: `~${target.expo}` }
      touched = true
    }
  }
  if (touched) writeFileSync(file, JSON.stringify(next, null, 2) + '\n')
}
if (run('.', 'bun', ['install']) !== 0) fail('bun install failed (see above).')

// 2. Everything Expo manages, from the installed expo's own list (no API call).
if (run(MOBILE, 'bunx', ['expo', 'install', '--fix'], { EXPO_OFFLINE: '1' }) !== 0) {
  fail('expo install --fix failed (a version still inside the release age?).')
}

// 3. expo install writes versions over `catalog:`: put the references back.
let restored = false
for (const file of workspaceFiles) {
  const pkg = readJson(file)
  const next: Record<string, unknown> = { ...pkg }
  let touched = false
  for (const key of ['dependencies', 'devDependencies']) {
    const d = { ...deps(pkg, key) }
    for (const name of catalogRefs.get(`${file}#${key}`) ?? []) {
      if (d[name] !== 'catalog:') {
        d[name] = 'catalog:'
        touched = true
      }
    }
    if (touched) next[key] = d
  }
  if (touched) {
    writeFileSync(file, JSON.stringify(next, null, 2) + '\n')
    restored = true
  }
}
if (restored && run('.', 'bun', ['install']) !== 0) fail('bun install failed (see above).')

// 4. Same-version copies nested under expo packages break autolinking (cliffnotes gotcha).
const nested = readdirSync('node_modules')
  .filter((d) => d.startsWith('expo'))
  .flatMap((d) => {
    const inner = join('node_modules', d, 'node_modules')
    return existsSync(inner) ? readdirSync(inner).map((n) => join(inner, n)) : []
  })
  .filter((p) => picked.list[p.split('/').slice(3).join('/')] !== undefined)
for (const p of nested) {
  result.warnings.push(`nested copy ${p}: delete it and bun install`)
  log(c.yellow(`  nested copy ${p}: delete it, then bun install`))
}

// 5. Checks.
result.doctor = run(MOBILE, 'bun', ['run', 'doctor']) === 0 ? 'pass' : 'fail'
result.typecheck = run(MOBILE, 'bun', ['run', 'typecheck']) === 0 ? 'pass' : 'fail'
const after = fingerprints()
const nativeChanged = Object.keys(after).some((k) => after[k] !== before[k])
result.fingerprint = { before, after, nativeChanged }
result.status = 'upgraded'

log()
log(c.bold(c.green(`✓ expo ${currentExpo} → ${target.expo}`)))
log(`  doctor ${result.doctor} · typecheck ${result.typecheck}`)
log(`  fingerprint ios ${before.ios} → ${after.ios}`)
log(`              android ${before.android} → ${after.android}`)
if (nativeChanged) {
  // The Limrun build command with this repo's values (.claude/skills/upgrade-expo).
  const asset = `${readProject().bundleId}.dev/${git('rev-parse', '--abbrev-ref', 'HEAD')}-debug.zip`
  log(c.yellow('  native changed: rebuild the dev client'))
  log(
    c.dim(
      `    lim xcode build . --configuration Debug --expo-app-dir apps/mobile --upload ${asset} --inactivity-timeout 2m`
    )
  )
} else {
  log(c.green('  JS-only: hot reload is enough'))
}
if (result.doctor === 'fail')
  log(
    c.yellow(
      '  doctor failed: read its output above (a patch still in the release age shows there).'
    )
  )
if (json) console.log(JSON.stringify(result, null, 2))
process.exit(result.typecheck === 'pass' ? 0 : 1)
