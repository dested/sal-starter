// Tiny helpers shared by the root scripts (init, sync, add-surface).

import { execFileSync, spawnSync } from 'node:child_process'

// NO_COLOR (gate sets it) keeps output plain, so logs parse.
const paint = (code: number) => (s: string) =>
  process.env.NO_COLOR === undefined ? `\x1b[${code}m${s}\x1b[0m` : s

export const c = {
  bold: paint(1),
  dim: paint(2),
  green: paint(32),
  yellow: paint(33),
  red: paint(31),
  cyan: paint(36),
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

export function hasRemote(name: string): boolean {
  return git('remote').split('\n').includes(name)
}

export function workingTreeClean(): boolean {
  return git('status', '--porcelain') === ''
}
