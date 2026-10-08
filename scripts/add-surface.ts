// Add a surface the fork dropped at init, from upstream's current version:
//
//   bun run add:mobile                  the Expo app, from upstream/main
//   bun run add:desktop                 the Electron app, from upstream/main
//   bun run add:<surface> --from <ref>  from another ref
//
// It checks the surface's paths out of the upstream ref (so later `bun run
// sync` merges them normally), restores its root scripts, adds it to
// project.json `surfaces`, installs, typechecks and commits. project.json
// already carries the identity every surface needs (`init` always writes it).

import { existsSync } from 'node:fs'
import {
  readProject,
  SURFACE_PATHS,
  SURFACES,
  syncRootScripts,
  writeProject,
  type Surface,
} from './project'
import { c, fail, git, hasRemote, run, workingTreeClean } from './shell'

const args = process.argv.slice(2)
const surface = SURFACES.find((s) => s === args[0])
if (surface === undefined)
  fail(`Usage: bun scripts/add-surface.ts <${SURFACES.join('|')}> [--from <ref>]`)
const fromIndex = args.indexOf('--from')
const ref = fromIndex === -1 ? 'upstream/main' : args[fromIndex + 1]
if (ref === undefined) fail(`Usage: bun run add:${surface} [--from <ref>]`)

const project = readProject()
if (project.surfaces.includes(surface) || existsSync(`apps/${surface}`)) {
  fail(`apps/${surface} is already part of this project.`)
}
const remote = ref.split('/')[0] ?? ''
if (!hasRemote(remote)) {
  fail(
    `No "${remote}" remote.`,
    'git remote add upstream https://github.com/dested/sal-starter.git'
  )
}
if (!workingTreeClean()) fail('Working tree is not clean.', 'Commit your changes first.')

git('fetch', '-q', remote)
const sha = git('rev-parse', '--short', ref)
// Paths another surface also owns (none today) or that upstream lacks are skipped.
const paths = SURFACE_PATHS[surface].filter(
  (p) => git('ls-tree', '--name-only', ref, '--', p) !== ''
)
git('checkout', ref, '--', ...paths)
console.log(`  ${c.green('added')}   ${paths.join(', ')} ${c.dim(`from ${ref} @ ${sha}`)}`)

const next = {
  ...project,
  surfaces: SURFACES.filter((s: Surface) => s === surface || project.surfaces.includes(s)),
}
writeProject(next)
syncRootScripts(next)

run('bun', 'install')
run('bun', 'run', 'typecheck')

git('add', '--', ...paths, 'bun.lock', 'project.json', 'package.json')
git('commit', '-q', '-m', `add apps/${surface} from ${ref} @ ${sha}`)

console.log()
console.log(c.bold(c.green(`✓ ${surface} added.`)))
if (surface === 'mobile') {
  console.log(`  Metro runs on ${c.bold(String(project.metroPort))} with \`bun run dev\`.`)
  console.log(c.dim('  Next: cd apps/mobile && eas init, then the Mac dev-client build (README).'))
}
if (surface === 'desktop') {
  console.log(
    `  The renderer dev server runs on ${c.bold(String(project.desktopPort))} with \`bun run dev\`.`
  )
  console.log(c.dim('  `bun run release` writes an unpacked build to release/.'))
}
