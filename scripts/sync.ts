// Pull sal-starter improvements into this fork:
//
//   bun run sync                  merge upstream/main
//   bun run sync --from <ref>     merge another ref (e.g. upstream/some-branch)
//
// It merges WITHOUT committing, auto-resolves what's mechanical, then installs
// and typechecks so you review a working tree, never a surprise commit:
//   - project.json / drydock.yaml keep this fork's values (merge=ours driver)
//   - web-only forks: anything upstream changed or added under apps/mobile or
//     packages/native-example is dropped again (those paths stay deleted)
// Real conflicts are listed for you to resolve. Finish with `git commit`.

import { existsSync } from 'node:fs'
import { c, fail, git, gitStatus, hasRemote, MOBILE_PATHS, run, workingTreeClean } from './shell'

const args = process.argv.slice(2)
const fromIndex = args.indexOf('--from')
const ref = fromIndex === -1 ? 'upstream/main' : args[fromIndex + 1]
if (ref === undefined) fail('Usage: bun run sync [--from <ref>]')

const remote = ref.split('/')[0] ?? ''
if (!hasRemote(remote)) {
  fail(
    `No "${remote}" remote.`,
    'git remote add upstream https://github.com/dested/sal-starter.git'
  )
}
if (!workingTreeClean()) fail('Working tree is not clean.', 'Commit your changes first.')

const webOnly = !existsSync('apps/mobile')

git('config', 'merge.ours.driver', 'true')
console.log(c.dim(`› git fetch ${remote}`))
git('fetch', '-q', remote)

console.log(c.dim(`› git merge --no-commit --no-ff ${ref}`))
const mergeExit = gitStatus('merge', '--no-commit', '--no-ff', ref)

if (webOnly) {
  // Modify/delete conflicts and newly added upstream files under the mobile
  // paths: keep this fork web-only. `git rm` also resolves unmerged entries.
  const touched = MOBILE_PATHS.filter((p) => git('ls-files', '--', p) !== '')
  if (touched.length > 0) {
    git('rm', '-r', '-q', '-f', '--', ...touched)
    console.log(
      `  ${c.green('kept deleted')} ${c.dim(touched.join(', '))} ${c.dim('(web-only fork)')}`
    )
  }
}

const conflicts = git('diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean)
if (conflicts.length > 0) {
  console.log()
  console.log(c.yellow(c.bold(`${conflicts.length} conflict(s) to resolve by hand:`)))
  for (const f of conflicts) console.log(`  ${c.yellow('•')} ${f}`)
  console.log()
  console.log(
    c.dim('Resolve, `git add` them, then: bun install && bun run typecheck && git commit')
  )
  process.exit(1)
}

if (mergeExit !== 0 && git('status', '--porcelain') === '') {
  fail('git merge failed before producing any changes (see output above).')
}

run('bun', 'install')
run('bun', 'run', 'typecheck')

console.log()
console.log(c.bold(c.green(`✓ Merged ${ref}; install + typecheck green.`)))
console.log(c.dim('  Review with `git diff --cached`, then `git commit` (or `git merge --abort`).'))
