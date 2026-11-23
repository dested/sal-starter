// The fingerprint (= runtimeVersion) a build of this app gets, computed the way
// the build does it: expo-updates for one platform and one APP_VARIANT (the
// bundle id and scheme are in the hashed config). Compare it with Home's dev
// row: different means the installed dev client is stale, rebuild it.
//
//   bun run fingerprint [--platform ios|android] [--variant development|preview|production] [--json]
//
// Defaults: ios, development (the dev client). Prints the hash; --json prints
// { platform, variant, hash }. Exit 1 when expo-updates can't compute it.
// fingerprintSources() is the same run with --debug: every hashed input, which
// fingerprint.rule.test.ts checks for machine-specific (absolute) paths.

import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { z } from 'zod'

const platformSchema = z.enum(['ios', 'android'])
const variantSchema = z.enum(['development', 'preview', 'production'])
export type Platform = z.infer<typeof platformSchema>
export type Variant = z.infer<typeof variantSchema>

const sourceSchema = z.object({
  type: z.string(),
  hash: z.string().nullable(),
  id: z.string().optional(),
  filePath: z.string().optional(),
  contents: z.string().optional(),
})
export type FingerprintSource = z.infer<typeof sourceSchema>
const resultSchema = z.object({
  hash: z.string().min(1),
  sources: z.array(sourceSchema).optional(),
})

/** Runs `expo-updates fingerprint:generate` for one platform and variant; throws with its stderr. */
export async function generateFingerprint(
  platform: Platform,
  variant: Variant,
  debug = false
): Promise<{ hash: string; sources: FingerprintSource[] }> {
  const child = spawn(
    'bunx',
    ['expo-updates', 'fingerprint:generate', '--platform', platform, ...(debug ? ['--debug'] : [])],
    { cwd: join(import.meta.dir, '..'), env: { ...process.env, APP_VARIANT: variant } }
  )
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()))
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
  const code = await new Promise<number | null>((resolve) => child.on('close', resolve))
  const parsed = resultSchema.safeParse(safeJson(stdout))
  if (code !== 0 || !parsed.success) {
    throw new Error(
      `expo-updates fingerprint:generate failed (exit ${code ?? '?'}, ${platform}, ${variant})\n${stderr}`
    )
  }
  return { hash: parsed.data.hash, sources: parsed.data.sources ?? [] }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

if (import.meta.main) {
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
  const platform = platformSchema.parse(flag('--platform') ?? 'ios')
  const variant = variantSchema.parse(flag('--variant') ?? 'development')
  try {
    const { hash } = await generateFingerprint(platform, variant)
    console.log(args.includes('--json') ? JSON.stringify({ platform, variant, hash }) : hash)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
