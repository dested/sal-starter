// The every-screen check, a Playwright reporter: when a full run ends, every
// route in src/app/routes.tsx (read from the router itself, so there is no
// second list to drift) and the 404 must have been landed on by some flow in
// EACH project, or the run fails naming the route and the project. Flows record
// the pages they land on (e2e/flow.ts attaches `visited`); a pathname counts for
// the deepest route it matches, an unmatched one for the 404.
//
// A partial run (a file or line filter, --grep, --project, --last-failed,
// --only-changed, --shard) skips the check and says so.

import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter'
import { routes } from '../src/app/routes'
import { NOT_FOUND, screenFor, screens } from './screens'

const FLOWS_DIR = fileURLToPath(new URL('.', import.meta.url))
const PARTIAL_FLAGS = [
  '--grep',
  '-g',
  '--grep-invert',
  '--last-failed',
  '--only-changed',
  '--shard',
  '--ui',
]

export default class CoverageReporter implements Reporter {
  private partial: string | null = null
  private visits = new Map<string, Set<string>>()
  private projects: string[] = []

  onBegin(config: FullConfig, suite: Suite): void {
    this.projects = config.projects.map((p) => p.name)
    const flowFiles = readdirSync(FLOWS_DIR).filter((f) => f.endsWith('.flow.spec.ts'))
    const flag = process.argv.find(
      (a) =>
        PARTIAL_FLAGS.some((f) => a === f || a.startsWith(`${f}=`)) ||
        // a file or line filter: `auth.flow.spec.ts`, `e2e/shell`, `auth.flow.spec.ts:12`
        /flow\.spec|:\d+$/.test(a)
    )
    const projectSuites = suite.suites
    if (flag) this.partial = flag
    else if (projectSuites.length < config.projects.length) this.partial = 'not every project'
    else {
      for (const project of projectSuites) {
        const files = new Set(project.suites.map((s) => s.title.split('/').pop() ?? s.title))
        const missing = flowFiles.find((f) => !files.has(f))
        if (missing) this.partial = `${missing} not in ${project.title}`
        else if (project.allTests().length === 0) this.partial = `${project.title} has no tests`
      }
    }
    for (const name of this.projects) this.visits.set(name, new Set())
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const project = test.parent.project()?.name
    const seen = project ? this.visits.get(project) : undefined
    if (!seen) return
    for (const attachment of result.attachments) {
      if (attachment.name !== 'visited' || !attachment.body) continue
      const paths: unknown = JSON.parse(attachment.body.toString())
      if (!Array.isArray(paths)) continue
      for (const p of paths) if (typeof p === 'string') seen.add(screenFor(routes, p))
    }
  }

  async onEnd(result: FullResult): Promise<{ status?: FullResult['status'] } | undefined> {
    if (this.partial) {
      console.log(`\ncoverage: partial run (${this.partial}): the every-screen check is skipped`)
      return undefined
    }
    const all = [...screens(routes), NOT_FOUND]
    const missing: string[] = []
    for (const project of this.projects) {
      const seen = this.visits.get(project) ?? new Set()
      for (const screen of all) if (!seen.has(screen)) missing.push(`${screen} in ${project}`)
    }
    if (missing.length > 0) {
      console.log(
        `\ncoverage: ${missing.length} screen(s) no flow landed on:\n` +
          missing.map((m) => `  ${m}`).join('\n') +
          '\nEvery route in src/app/routes.tsx (and the 404) needs a flow that lands on it, in every project. Add one (CLAUDE.md → Testing → Add a flow).'
      )
      return { status: 'failed' }
    }
    console.log(
      `\ncoverage: every screen walked in ${this.projects.join(' and ')} (${all.join(', ')})`
    )
    return result.status === 'passed' ? undefined : { status: result.status }
  }

  printsToStdio(): boolean {
    return false
  }
}
