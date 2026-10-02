// `bun run dev`: the web app (API + SSR + HMR on project.json `apiPort`), plus
// Metro on `metroPort` when apps/mobile exists. One command, both servers.
//
//   bun run dev            web, and mobile if present
//   bun run dev web        web only
//   bun run dev mobile     Metro only (the API is already running elsewhere)
//
// Metro owns the terminal's stdin (its r/j/m keys and the QR code); the web
// server never reads stdin. Ctrl+C stops both.

import { existsSync } from 'node:fs'
import { readProject } from './project'

const target = process.argv[2] ?? 'all'
if (target !== 'all' && target !== 'web' && target !== 'mobile') {
  console.error(`Usage: bun run dev [web|mobile]  (got "${target}")`)
  process.exit(1)
}

const project = readProject()
const hasMobile = existsSync('apps/mobile/package.json')
const procs: Bun.Subprocess[] = []

if (target !== 'mobile') {
  procs.push(
    Bun.spawn(['bun', 'run', '--cwd', 'apps/web', 'dev'], {
      stdin: 'ignore',
      stdout: 'inherit',
      stderr: 'inherit',
    })
  )
}

if (target === 'mobile' && !hasMobile) {
  console.error('apps/mobile does not exist. Add it with `bun run add:mobile`.')
  process.exit(1)
}

if (target !== 'web' && hasMobile) {
  procs.push(
    Bun.spawn(['bun', 'x', 'expo', 'start', '--dev-client', '--port', String(project.metroPort)], {
      cwd: 'apps/mobile',
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    })
  )
}

function stopAll() {
  for (const p of procs) p.kill()
}
process.on('SIGINT', stopAll)
process.on('SIGTERM', stopAll)

// If either server dies, take the other down too so nothing lingers on a port.
const first = await Promise.race(procs.map((p) => p.exited))
stopAll()
process.exit(first)
