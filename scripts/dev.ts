// `bun run dev`: every surface this fork has, in one command:
//   web      API + SSR + HMR on project.json `apiPort`
//   mobile   Metro on `metroPort`
//   desktop  electron-vite (renderer dev server on `desktopPort`) + the window
//
//   bun run dev                    all of them
//   bun run dev web|mobile|desktop just one
//
// Metro owns the terminal's stdin (its r/j/m keys and the QR code); nothing
// else reads stdin. Ctrl+C stops all; if one exits, the rest stop too.

import { existsSync } from 'node:fs'
import { readProject } from './project'

const target = process.argv[2] ?? 'all'
if (target !== 'all' && target !== 'web' && target !== 'mobile' && target !== 'desktop') {
  console.error(`Usage: bun run dev [web|mobile|desktop]  (got "${target}")`)
  process.exit(1)
}

const project = readProject()
const has = (app: string) => existsSync(`apps/${app}/package.json`)
const wants = (app: 'web' | 'mobile' | 'desktop') =>
  target === app || (target === 'all' && has(app))
if (target !== 'all' && !has(target)) {
  console.error(
    `apps/${target} does not exist.${target === 'web' ? '' : ` Add it with \`bun run add:${target}\`.`}`
  )
  process.exit(1)
}
const procs: Bun.Subprocess[] = []

if (wants('web')) {
  procs.push(
    Bun.spawn(['bun', 'run', '--cwd', 'apps/web', 'dev'], {
      stdin: 'ignore',
      stdout: 'inherit',
      stderr: 'inherit',
    })
  )
}

if (wants('desktop')) {
  procs.push(
    Bun.spawn(['bun', 'run', '--cwd', 'apps/desktop', 'dev'], {
      stdin: 'ignore',
      stdout: 'inherit',
      stderr: 'inherit',
    })
  )
}

if (wants('mobile')) {
  procs.push(
    Bun.spawn(['bun', 'x', 'expo', 'start', '--dev-client', '--port', String(project.metroPort)], {
      cwd: 'apps/mobile',
      // The manifest Metro serves must match the installed dev client (the
      // `.dev` bundle id + scheme), so local Metro defaults to that variant.
      env: { ...process.env, APP_VARIANT: process.env.APP_VARIANT ?? 'development' },
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
