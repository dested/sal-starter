import { describe, expect, test } from 'bun:test'
import express, { type RequestHandler } from 'express'
import { once } from 'node:events'
import { healthz } from './health'

// The handler mounted the way server.ts mounts it, over real HTTP and the real
// database clone. The commit a deploy reports is proved on the production
// server by e2e/health.flow.spec.ts (the flow servers set DRYDOCK_COMMIT).
async function getHealth(handler: RequestHandler): Promise<{ status: number; body: unknown }> {
  const app = express()
  app.get('/healthz', handler)
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const address = server.address()
    if (typeof address !== 'object' || address === null) throw new Error('no port')
    const res = await fetch(`http://127.0.0.1:${address.port}/healthz`)
    return { status: res.status, body: await res.json() }
  } finally {
    server.close()
  }
}

describe('/healthz', () => {
  test('pings the database and reports commit null outside a deploy', async () => {
    expect(process.env.DRYDOCK_COMMIT).toBeUndefined()
    const { status, body } = await getHealth(healthz())
    expect(status).toBe(200)
    expect(body).toEqual({ status: 'ok', uptime: expect.any(Number), commit: null })
  })

  test('answers 503 when the database is down', async () => {
    const { status, body } = await getHealth(
      healthz(() => Promise.reject(new Error('connection refused')))
    )
    expect(status).toBe(503)
    expect(body).toEqual({ status: 'error', error: 'database unreachable' })
  })
})
