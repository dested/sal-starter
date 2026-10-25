// The fingerprint (= runtimeVersion) a build of this app gets, computed the way
// the build does it: expo-updates for one platform and one APP_VARIANT (the
// bundle id and scheme are in the hashed config). Compare it with Home's dev
// row: different means the installed dev client is stale, rebuild it.
//
//   bun run fingerprint [--platform ios|android] [--variant development|preview|production] [--json]
//
// Defaults: ios, development (the dev client). Prints the hash; --json prints
// { platform, variant, hash }. Exit 1 when expo-updates can't compute it.

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { z } from 'zod'

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(
    'Usage: bun run fingerprint [--platform ios|android] [--variant development|preview|production] [--json]'
  )
  process.exit(0)
}
const flag = (name: string) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}
const platform = z.enum(['ios', 'android']).parse(flag('--platform') ?? 'ios')
const variant = z
  .enum(['development', 'preview', 'production'])
  .parse(flag('--variant') ?? 'development')

const result = spawnSync('bunx', ['expo-updates', 'fingerprint:generate', '--platform', platform], {
  cwd: join(import.meta.dir, '..'),
  encoding: 'utf8',
  env: { ...process.env, APP_VARIANT: variant },
  maxBuffer: 64 * 1024 * 1024,
})
const parsed = z.object({ hash: z.string().min(1) }).safeParse(safeJson(result.stdout))
if (result.status !== 0 || !parsed.success) {
  process.stderr.write(result.stderr)
  console.error(`expo-updates fingerprint:generate failed (exit ${result.status ?? '?'})`)
  process.exit(1)
}
const { hash } = parsed.data
console.log(args.includes('--json') ? JSON.stringify({ platform, variant, hash }) : hash)

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
