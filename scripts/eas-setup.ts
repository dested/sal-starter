// EAS project setup for the mobile app. `bun run init <name> --mobile` runs it;
// rerun it any time (it links instead of creating once project.json has an id):
//
//   bun scripts/eas-setup.ts [--dry-run] [--json]      (in apps/mobile: bun run eas:setup)
//
// What it does, against the project.json `easOwner` account (quickgame):
//   1. eas init: creates (or links) @<easOwner>/<name>, and writes its id to
//      project.json `easProjectId`. app.config.ts reads it from there (updates.url,
//      extra.eas.projectId), so OTA updates are on from the first build.
//   2. eas env:set APP_VARIANT=<env> in the development, preview and production
//      environments, so builds and `eas update` evaluate the same app config.
//   3. eas channel:create + channel:protect production (when the installed
//      eas-cli has channel:protect), so only Release Managers and up publish there.
//
// eas-cli runs in a throwaway folder holding a static app.json (name, slug,
// owner): `eas init` can't write the id into a dynamic app.config.ts (it creates
// the project, then exits 1), and a static config lets it finish and print JSON.
//
// --dry-run prints the commands and touches nothing (no eas call, no write).
// --json    prints one JSON result on stdout (logs go to stderr).
// Exit codes: 0 done or dry run · 2 skipped (the template itself, or eas-cli
// missing or not logged in; the command to run later is printed) · 1 an eas
// command failed.
//
// The template (project.json name sal-starter) never gets an EAS project: it
// refuses there, dry run included, with no override.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { readProject, writeProject } from './project'
import { c } from './shell'

const ENVIRONMENTS = ['development', 'preview', 'production'] as const
const RERUN = 'bun run --cwd apps/mobile eas:setup'

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(
    'Usage: bun scripts/eas-setup.ts [--dry-run] [--json]\n' +
      '  Creates or links the EAS project for apps/mobile under project.json easOwner,\n' +
      '  writes easProjectId, sets APP_VARIANT per EAS environment, protects the production channel.\n' +
      '  Exit codes: 0 done or dry run, 2 skipped (the template, or eas-cli missing or not logged in), 1 failed.'
  )
  process.exit(0)
}
const dryRun = args.includes('--dry-run')
const json = args.includes('--json')
// Logs go to stderr under --json so stdout is only the result.
const log = (line: string) => (json ? console.error(line) : console.log(line))

// Runs from the repo root whatever the cwd (apps/mobile's eas:setup script).
process.chdir(join(import.meta.dir, '..'))
const project = readProject()
if (!project.surfaces.includes('mobile')) {
  log(c.red('No mobile app in this project (project.json surfaces).'))
  process.exit(1)
}

type Result = {
  status: 'done' | 'dry-run' | 'skipped' | 'failed'
  owner: string
  slug: string
  projectId: string | null
  commands: string[]
  notes: string[]
}
const result: Result = {
  status: 'done',
  owner: project.easOwner,
  slug: project.name,
  projectId: project.easProjectId,
  commands: [],
  notes: [],
}

// The throwaway folder eas-cli runs in; finish() removes it (process.exit skips finally).
let tempDir: string | null = null

function finish(status: Result['status'], code: number): never {
  if (tempDir !== null && existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true })
  result.status = status
  if (json) console.log(JSON.stringify(result, null, 2))
  process.exit(code)
}

function eas(cwd: string, capture: boolean, ...easArgs: string[]) {
  return spawnSync('eas', easArgs, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', json ? 2 : 1, 2],
    // No git in the throwaway folder; EAS_NO_VCS stops eas-cli looking for one.
    env: { ...process.env, EAS_NO_VCS: '1' },
  })
}

/** True when the installed eas-cli has this command (oclif exits 2 on an unknown one). */
function hasCommand(cwd: string, command: string): boolean {
  return eas(cwd, true, command, '--help').status === 0
}

// The commands, in order. init's own flags depend on the eas-cli version, so
// they're settled once a folder to probe from exists (dry run: the defaults).
function plan(cwd: string, probe: boolean) {
  const initArgs = [
    'init',
    ...(project.easProjectId === null
      ? ['--account', project.easOwner]
      : ['--id', project.easProjectId]),
    '--force',
    '--non-interactive',
    '--json',
  ]
  // The dashboard icon would be the pre-kickoff placeholder forever ("when the
  // project does not have one yet"): leave it unset.
  if (!probe || eas(cwd, true, 'init', '--help').stdout.includes('--[no-]icon')) {
    initArgs.push('--no-icon')
  }
  const envCommand = !probe || hasCommand(cwd, 'env:set') ? 'env:set' : 'env:create'
  const envArgs = ENVIRONMENTS.map((env) => [
    envCommand,
    '--name',
    'APP_VARIANT',
    '--value',
    env,
    '--environment',
    env,
    '--visibility',
    'plaintext',
    '--scope',
    'project',
    ...(envCommand === 'env:create' ? ['--force'] : []),
    '--non-interactive',
  ])
  const protect = !probe || hasCommand(cwd, 'channel:protect')
  return { initArgs, envArgs, protect }
}

if (project.name === 'sal-starter') {
  result.notes.push('the template has no EAS project')
  log(c.yellow('  skipped EAS setup: this is the sal-starter template, which has no EAS project.'))
  log(c.dim(`  In a fork (bun run init <name> --mobile), run ${RERUN}`))
  finish('skipped', 2)
}

const show = (easArgs: string[]) => `eas ${easArgs.join(' ')}`

if (dryRun) {
  const { initArgs, envArgs } = plan('.', false)
  const commands = [
    initArgs,
    ...envArgs,
    ['channel:create', 'production', '--non-interactive'],
    ['channel:protect', 'production', '--non-interactive'],
  ].map(show)
  result.commands = commands
  log(c.bold(`EAS setup (dry run): @${project.easOwner}/${project.name}`))
  log(c.dim('  in a throwaway folder with app.json { name, slug, owner }:'))
  for (const cmd of commands) log(`  ${cmd}`)
  log(c.dim('  then project.json easProjectId = the id `eas init --json` prints'))
  finish('dry-run', 0)
}

const whoami = eas('.', true, 'whoami')
if (whoami.error !== undefined || whoami.status !== 0 || whoami.stdout.trim() === '') {
  const why = whoami.error !== undefined ? 'eas-cli is not installed' : 'eas-cli is not logged in'
  result.notes.push(why)
  log(c.yellow(`  skipped EAS setup: ${why}.`))
  log(
    c.dim(
      `  Later: ${whoami.error !== undefined ? 'npm i -g eas-cli && ' : ''}eas login, then ${RERUN}`
    )
  )
  finish('skipped', 2)
}

// eas init --account fails with a clear message when this login can't create
// projects under easOwner.
const dir = mkdtempSync(join(tmpdir(), 'eas-setup-'))
tempDir = dir
writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: project.name, private: true }))
writeFileSync(
  join(dir, 'app.json'),
  JSON.stringify({
    expo: { name: project.displayName, slug: project.name, owner: project.easOwner },
  })
)
const { initArgs, envArgs, protect } = plan(dir, true)

// 1. Create or link, and keep the id.
log(c.dim(`› ${show(initArgs)}`))
result.commands.push(show(initArgs))
const init = eas(dir, true, ...initArgs)
if (init.stderr !== '') process.stderr.write(init.stderr)
const parsed = z
  .object({ projectId: z.string().min(1), status: z.string(), owner: z.string() })
  .safeParse(safeJson(init.stdout))
if (init.status !== 0 || !parsed.success) {
  log(c.red(`  eas init failed (exit ${init.status ?? '?'}).`))
  log(c.dim(`  Fix it, then ${RERUN}`))
  finish('failed', 1)
}
const { projectId, status } = parsed.data
result.projectId = projectId
if (project.easProjectId !== projectId) {
  writeProject({ ...project, easProjectId: projectId })
  log(`  ${c.green('wrote')}   project.json easProjectId ${c.dim(projectId)}`)
}
if (status === 'linked') {
  result.notes.push(`linked the existing @${project.easOwner}/${project.name}`)
  log(
    c.yellow(
      `  linked the EXISTING @${project.easOwner}/${project.name}: make sure it's this app's`
    )
  )
} else {
  log(`  ${c.green(status)} @${project.easOwner}/${project.name}`)
}

// 2. APP_VARIANT per environment.
for (const envArg of envArgs) {
  log(c.dim(`› ${show(envArg)}`))
  result.commands.push(show(envArg))
  if (eas(dir, false, ...envArg).status !== 0) {
    log(c.red('  setting APP_VARIANT failed.'))
    finish('failed', 1)
  }
}

// 3. Protect production (the channel must exist first; builds create the others).
if (!protect) {
  result.notes.push('eas-cli has no channel:protect: production is unprotected')
  log(c.yellow('  this eas-cli has no channel:protect: protect production on the dashboard.'))
} else {
  if (eas(dir, true, 'channel:view', 'production', '--json', '--non-interactive').status !== 0) {
    const create = ['channel:create', 'production', '--non-interactive']
    log(c.dim(`› ${show(create)}`))
    result.commands.push(show(create))
    if (eas(dir, false, ...create).status !== 0) finish('failed', 1)
  }
  const protectArgs = ['channel:protect', 'production', '--non-interactive']
  log(c.dim(`› ${show(protectArgs)}`))
  result.commands.push(show(protectArgs))
  if (eas(dir, false, ...protectArgs).status !== 0) finish('failed', 1)
}

log(
  c.green(
    `  ✓ EAS project @${project.easOwner}/${project.name} ready (updates on from the first build)`
  )
)
finish('done', 0)

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
