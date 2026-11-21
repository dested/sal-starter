// The app as flows see it: the production build (`bun run build`, which
// test:flows runs first), started on a free port against its own clone of the
// test template, with the same explicit environment as the API tests
// (test/env.ts): nothing from the root .env.

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { createClone, dropClone } from '../test/db'
import { testEnv } from '../test/env'

const WEB_DIR = fileURLToPath(new URL('..', import.meta.url))
const BUILD = new URL('../dist/server/entry-server.js', import.meta.url)

// Passed through from the runner: what a process needs to run, never a key.
const PASSTHROUGH = ['PATH', 'HOME', 'USER', 'LANG', 'LC_ALL', 'TZ', 'TMPDIR', 'BUN_INSTALL']

export type FlowServer = {
  url: string
  /** Everything the server printed so far, and the offset a test started at. */
  log: () => string
  /** Set once world.signIn('admin') has made the admin on this server's database. */
  adminExists: boolean
  stop: () => Promise<void>
}

export function assertBuilt(): void {
  if (!existsSync(BUILD)) {
    throw new Error(
      'No production build at apps/web/dist. `bun run test:flows` builds first; for a bare `playwright test`, run `bun run build`.'
    )
  }
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, () => {
      const address = probe.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      probe.close(() => (port > 0 ? resolve(port) : reject(new Error('no free port'))))
    })
  })
}

async function waitUntilUp(url: string, child: ChildProcess, log: () => string): Promise<void> {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`The app exited (${child.exitCode}) before it was up:\n${log()}`)
    }
    try {
      // /healthz pings the database: up means the clone is reachable too.
      const res = await fetch(`${url}/healthz`)
      if (res.ok) return
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`The app wasn't up on ${url} after 30 s:\n${log()}`)
}

/** A server on its own database `<template>_<suffix>`, cloned from `template`. */
export async function startFlowServer(template: string, suffix: string): Promise<FlowServer> {
  assertBuilt()
  const database = await createClone(template, suffix)
  const port = await freePort()
  // The browser and better-auth agree on this origin; the probe uses IPv6
  // loopback (under WSL a closed 127.0.0.1 port hangs instead of refusing).
  const url = `http://localhost:${port}`
  const env: Record<string, string> = { NODE_ENV: 'production', PORT: String(port), NO_COLOR: '1' }
  for (const key of PASSTHROUGH) {
    const value = process.env[key]
    if (value !== undefined) env[key] = value
  }
  Object.assign(env, testEnv(database, url))
  const child = spawn('bun', ['server.ts'], {
    cwd: WEB_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()))
  child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()))
  const log = () => output
  try {
    await waitUntilUp(`http://[::1]:${port}`, child, log)
  } catch (error) {
    child.kill('SIGKILL')
    await dropClone(template, database)
    throw error
  }
  return {
    url,
    log,
    adminExists: false,
    stop: async () => {
      if (child.exitCode === null) {
        const exited = new Promise((resolve) => child.once('exit', resolve))
        child.kill('SIGTERM')
        await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))])
        if (child.exitCode === null) child.kill('SIGKILL')
      }
      await dropClone(template, database)
    },
  }
}
