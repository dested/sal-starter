import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  addImport,
  hasMigration,
  insertAfterLine,
  migrationStamp,
  type EditStep,
  type Recipe,
} from '../lib'

const SERVER = 'apps/web/server.ts'
const SCHEMA = 'apps/web/prisma/schema.prisma'
const MIGRATION = 'add_job_queue'

const schemaFragment = readFileSync(join(import.meta.dirname, 'schema.prisma'), 'utf8')

const appendModel: EditStep = {
  file: SCHEMA,
  what: 'Job model + JobState enum',
  done: (s) => /^model Job \{/m.test(s),
  apply: (s) => `${s.trimEnd()}\n${schemaFragment}`,
  manual: `Append recipes/jobs/schema.prisma to ${SCHEMA}`,
}

const truncateJobs: EditStep = {
  file: 'apps/web/e2e/global-setup.ts',
  what: 'e2e truncates the job table',
  done: (s) => s.includes('"job"'),
  apply: (s) =>
    s.includes('TRUNCATE TABLE ') ? s.replace('TRUNCATE TABLE ', 'TRUNCATE TABLE "job", ') : null,
  manual: 'In apps/web/e2e/global-setup.ts, add "job" to the TRUNCATE TABLE list.',
}

export default function jobs(root: string): Recipe {
  return {
    name: 'jobs',
    summary:
      'Postgres job queue: job table, SKIP LOCKED claims, retries with backoff, graceful stop',
    details: [
      'Adds apps/web/server/jobs.ts (+ jobs.test.ts), shutdown.ts, the Job model and its migration.',
      '  const welcome = defineJob(kind, zodSchema, handler); await welcome.enqueue(data, { key, runAfter, tx })',
      '  - claims due rows with FOR UPDATE SKIP LOCKED (any number of processes)',
      '  - retries after 30 s, 1 min, 2 min, … (cap 1 h) up to maxAttempts (default 5), then `failed`',
      '  - `key`: at most one waiting/running job per (kind, key); `tx`: enqueue in your transaction',
      '  - a job stuck `running` past 10 min (dead runner) is taken again',
      '  - server.ts starts the runner after listen; SIGTERM waits for running jobs',
      '  - runDueJobs() runs what is due once (tests, scripts)',
      '  Handlers run at least once: make them idempotent.',
    ].join('\n'),
    files: [
      { from: 'apps/web/server/jobs.ts' },
      { from: 'apps/web/server/jobs.test.ts' },
      { from: 'apps/web/server/shutdown.ts', shared: true },
      {
        from: 'apps/web/prisma/add_job_queue.sql',
        to: `apps/web/prisma/migrations/${migrationStamp(root)}_${MIGRATION}/migration.sql`,
        present: () => hasMigration(root, MIGRATION),
      },
    ],
    dependencies: [],
    edits: [
      appendModel,
      addImport(SERVER, './server/jobs', ['startJobs']),
      addImport(SERVER, './server/shutdown', ['onShutdown']),
      insertAfterLine(
        SERVER,
        'start the job runner after listen',
        'httpServer.listen(PORT, () => {',
        '    onShutdown(startJobs().stop)\n',
        'startJobs()'
      ),
      truncateJobs,
    ],
    after: [['bun', 'run', '--cwd', 'apps/web', 'db:generate']],
    next: [
      'Apply the migration: `bun run db:deploy` (dev DB), and commit prisma/migrations/*_add_job_queue.',
      'Define a job: `defineJob(kind, schema, handler)` in a module server.ts imports (e.g. server/jobs/<area>.ts).',
    ],
  }
}
