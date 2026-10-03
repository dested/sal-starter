// Tiny helpers shared by the root scripts (init, sync, add-mobile).

import { execFileSync, spawnSync } from 'node:child_process'

export const c = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
}

// git, capturing stdout. Throws on a non-zero exit.
export function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
}

// git, returning the exit code instead of throwing (merge exits 1 on conflicts).
export function gitStatus(...args: string[]): number {
  return spawnSync('git', args, { stdio: 'inherit' }).status ?? 1
}

// A command with inherited stdio. Throws on a non-zero exit.
export function run(cmd: string, ...args: string[]): void {
  const result = spawnSync(cmd, args, { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exited with ${result.status}`)
}

export function fail(message: string, hint?: string): never {
  console.error(c.red(message))
  if (hint !== undefined) console.error(c.dim(`  ${hint}`))
  process.exit(1)
}

// Paths that only exist in a fork with the mobile app (`init --mobile`).
export const MOBILE_PATHS = ['apps/mobile', 'packages/native-example']

export function hasRemote(name: string): boolean {
  return git('remote').split('\n').includes(name)
}

export function workingTreeClean(): boolean {
  return git('status', '--porcelain') === ''
}
