// Graceful stop. Long-lived things (the job runner, WebSocket servers) register
// a hook; on SIGTERM (Drydock redeploys) or SIGINT the hooks run together, then
// the process exits. A hook that hangs is cut off after STOP_TIMEOUT_MS.
import { formatError, log } from './logger'

const STOP_TIMEOUT_MS = 10_000

type Hook = () => Promise<void> | void
const hooks: Hook[] = []
let installed = false

export function onShutdown(hook: Hook): void {
  hooks.push(hook)
  if (installed) return
  installed = true
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => void shutdown(signal))
  }
}

async function shutdown(signal: string): Promise<void> {
  log.info(`${signal}: stopping (${hooks.length} hook${hooks.length === 1 ? '' : 's'})`)
  const timeout = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), STOP_TIMEOUT_MS).unref()
  )
  const done = Promise.allSettled(hooks.map(async (hook) => hook())).then((results) => {
    for (const r of results) if (r.status === 'rejected') log.error(formatError(r.reason))
    return 'done' as const
  })
  if ((await Promise.race([done, timeout])) === 'timeout') {
    log.warn(`shutdown hooks still running after ${STOP_TIMEOUT_MS / 1000}s; exiting anyway`)
  }
  process.exit(0)
}
