// Pull sal-starter improvements into this fork:
//
//   bun run sync                  merge upstream/main
//   bun run sync --from <ref>     merge another ref (e.g. upstream/some-branch)
//
// It merges WITHOUT committing, auto-resolves what's mechanical, then installs
// and typechecks so you review a working tree, never a surprise commit:
//   - project.json / drydock.yaml keep this fork's values (merge=ours driver)
//   - bun.lock: this fork's copy is kept and `bun install` folds upstream in
//   - surfaces this fork doesn't have (project.json `surfaces`): anything
//     upstream changed or added under their paths is dropped again, and their
//     root scripts stay out of package.json
//   - forks older than `surfaces` get it (plus desktopPort, appId) filled in
// Real conflicts are listed for you to resolve. Finish with `git commit`.

import { readFileSync, writeFileSync } from 'node:fs'
import { excludedPaths, projectSchema, readProject, syncRootScripts, writeProject } from './project'
import { c, fail, git, gitStatus, hasRemote, run, workingTreeClean } from './shell'

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

const project = readProject()
const excluded = excludedPaths(project)
const projectBefore = readFileSync('project.json', 'utf8')

git('config', 'merge.ours.driver', 'true')
console.log(c.dim(`› git fetch ${remote}`))
git('fetch', '-q', remote)

console.log(c.dim(`› git merge --no-commit --no-ff ${ref}`))
const mergeExit = gitStatus('merge', '--no-commit', '--no-ff', ref)

if (excluded.length > 0) {
  // Modify/delete conflicts and newly added upstream files under paths of
  // surfaces this fork doesn't have: keep them deleted. `git rm` also resolves
  // unmerged entries.
  const touched = excluded.filter((p) => git('ls-files', '--', p) !== '')
  if (touched.length > 0) {
    git('rm', '-r', '-q', '-f', '--', ...touched)
    console.log(
      `  ${c.green('kept deleted')} ${c.dim(touched.join(', '))} ${c.dim(`(${project.surfaces.join(' + ')} fork)`)}`
    )
  }
}

// Root scripts follow the surfaces (an upstream edit to the scripts block can
// re-add ones this fork dropped). Only safe once package.json merged cleanly.
if (
  git('diff', '--name-only', '--diff-filter=U', '--', 'package.json') === '' &&
  syncRootScripts(project)
) {
  git('add', 'package.json')
}

// Older forks: persist the surfaces/desktopPort/appId readProject inferred.
if (!projectSchema.safeParse(JSON.parse(projectBefore)).success) {
  writeProject(project)
  git('add', 'project.json')
  console.log(
    `  ${c.green('updated')} project.json ${c.dim(`(surfaces: ${project.surfaces.join(', ')})`)}`
  )
}

// bun.lock: keep this fork's copy and let `bun install` below fold in what
// upstream changed in package.json. A textual merge of a lockfile is either a
// conflict or, for web-only forks, a silent re-import of the Expo tree.
const lockConflicted = git('diff', '--name-only', '--diff-filter=U', '--', 'bun.lock') !== ''
if (excluded.length > 0 || lockConflicted) {
  writeFileSync('bun.lock', git('show', 'HEAD:bun.lock') + '\n')
  git('add', 'bun.lock')
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
