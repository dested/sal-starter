import type { RequestHandler } from 'express'
import { env } from './env'
import { formatError, log } from './logger'
import { prisma } from './prisma'

const pingDatabase = () => prisma.$queryRaw`SELECT 1`

/**
 * GET /healthz: Drydock's health check, the flows' readiness poll and the Live
 * check. `commit` is the deployed commit (DRYDOCK_COMMIT), null outside a deploy.
 * `ping` is swappable so a test can take the database down.
 */
export function healthz(ping: () => Promise<unknown> = pingDatabase): RequestHandler {
  return async (_req, res) => {
    try {
      await ping()
      res.json({ status: 'ok', uptime: process.uptime(), commit: env.DRYDOCK_COMMIT ?? null })
    } catch (e) {
      log.error(`healthz db check failed: ${formatError(e)}`)
      res.status(503).json({ status: 'error', error: 'database unreachable' })
    }
  }
}
