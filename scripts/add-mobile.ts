// Add the Expo app to a web-only fork, from upstream's current version:
//
//   bun run add:mobile                  from upstream/main
//   bun run add:mobile --from <ref>     from another ref
//
// It copies apps/mobile + packages/native-example out of the upstream ref (so
// later `bun run sync` merges them normally), installs, typechecks and commits.
// project.json already carries the mobile identity (scheme, bundleId,
// metroPort) because `init` always writes it.

import { existsSync } from 'node:fs'
import { readProject } from './project'
import { c, fail, git, hasRemote, MOBILE_PATHS, run, workingTreeClean } from './shell'

const args = process.argv.slice(2)
const fromIndex = args.indexOf('--from')
const ref = fromIndex === -1 ? 'upstream/main' : args[fromIndex + 1]
if (ref === undefined) fail('Usage: bun run add:mobile [--from <ref>]')

if (existsSync('apps/mobile')) fail('apps/mobile already exists.')
const remote = ref.split('/')[0] ?? ''
if (!hasRemote(remote)) {
  fail(
    `No "${remote}" remote.`,
    'git remote add upstream https://github.com/dested/sal-starter.git'
  )
}
if (!workingTreeClean()) fail('Working tree is not clean.', 'Commit your changes first.')

const project = readProject()

git('fetch', '-q', remote)
const sha = git('rev-parse', '--short', ref)
git('checkout', ref, '--', ...MOBILE_PATHS)
console.log(`  ${c.green('added')}   ${MOBILE_PATHS.join(', ')} ${c.dim(`from ${ref} @ ${sha}`)}`)

run('bun', 'install')
run('bun', 'run', 'typecheck')

git('add', '--', ...MOBILE_PATHS, 'bun.lock')
git('commit', '-q', '-m', `add apps/mobile from ${ref} @ ${sha}`)

console.log()
console.log(c.bold(c.green(`✓ Mobile added (${project.scheme}, ${project.bundleId}).`)))
console.log(`  Metro runs on ${c.bold(String(project.metroPort))} with \`bun run dev\`.`)
console.log(c.dim('  Next: cd apps/mobile && eas init, then the Mac dev-client build (README).'))
