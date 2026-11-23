import { describe, expect, test } from 'bun:test'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { generateFingerprint, type FingerprintSource } from './scripts/fingerprint'

// The runtimeVersion is the fingerprint, so the Mac or EAS machine that builds a binary and the
// WSL box that runs `eas update` must hash the same inputs, or updates never reach the build.
// Tell Santa's first OTA build missed exactly so: app.config.ts handed expo-font absolute font
// paths (require.resolve), the resolved config is hashed, and /w/code/… ≠ /Users/sal/code/….
// @expo/fingerprint only relativizes paths under apps/mobile; one into the repo-root
// node_modules or packages/ stays absolute. This runs the same `expo-updates
// fingerprint:generate --debug` a build runs and fails on any machine-specific path in its inputs.

const REPO_ROOT = join(import.meta.dir, '..', '..')
const HOME = homedir()
const WINDOWS_ABSOLUTE = /^[A-Za-z]:[\\/]/

/** Every string inside a JSON value, with where it sits. */
function strings(value: unknown, at = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[at, value]]
  if (Array.isArray(value)) return value.flatMap((item, i) => strings(item, `${at}[${i}]`))
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => strings(item, `${at}.${key}`))
  }
  return []
}

/** Why these fingerprint inputs would hash differently on another machine; empty when they won't. */
function machineSpecific(sources: FingerprintSource[]): string[] {
  const problems: string[] = []
  for (const source of sources) {
    const name = source.id ?? source.filePath ?? source.type
    const text = JSON.stringify(source)
    if (text.includes(REPO_ROOT)) problems.push(`${name} contains the repo root ${REPO_ROOT}`)
    else if (text.includes(HOME)) problems.push(`${name} contains the home folder ${HOME}`)
    if (
      source.filePath !== undefined &&
      (isAbsolute(source.filePath) || WINDOWS_ABSOLUTE.test(source.filePath))
    )
      problems.push(`${name}: absolute source path`)
    // The resolved app config: any absolute path in it (fonts, assets, plugin options) is hashed as is.
    if (source.id === 'expoConfig' && source.contents !== undefined) {
      for (const [at, value] of strings(JSON.parse(source.contents))) {
        if (isAbsolute(value) || WINDOWS_ABSOLUTE.test(value))
          problems.push(
            `app config${at} is an absolute path (${value}): make it relative to apps/mobile`
          )
      }
    }
  }
  return problems
}

describe('the fingerprint is the same on every machine', () => {
  const runs = (['production', 'preview', 'development'] as const).flatMap((variant) =>
    (['ios', 'android'] as const).map((platform) => ({ variant, platform }))
  )
  test('no hashed input holds an absolute path, for every variant and platform', async () => {
    const results = await Promise.all(
      runs.map(async ({ variant, platform }) => {
        const { sources } = await generateFingerprint(platform, variant, true)
        expect(sources.some((s) => s.id === 'expoConfig')).toBe(true)
        return machineSpecific(sources).map((p) => `${variant}/${platform}: ${p}`)
      })
    )
    expect(results.flat()).toEqual([])
  }, 60_000)
})

describe('machineSpecific', () => {
  const config = (value: unknown): FingerprintSource => ({
    type: 'contents',
    id: 'expoConfig',
    hash: null,
    contents: JSON.stringify(value),
  })

  test('passes relative paths and plain values', () => {
    expect(
      machineSpecific([
        config({
          icon: './assets/icon.png',
          plugins: [['expo-font', { fonts: ['../../node_modules/x/a.ttf'] }]],
        }),
        { type: 'file', filePath: '../../packages/x/app.plugin.js', hash: null },
      ])
    ).toEqual([])
  })

  test('names an absolute font path, a Windows path and an absolute source', () => {
    expect(
      machineSpecific([
        config({ plugins: [['expo-font', { fonts: ['/Users/sal/code/x/a.ttf'] }]] }),
      ])
    ).toHaveLength(1)
    expect(machineSpecific([config({ icon: 'W:\\code\\x\\icon.png' })])).toHaveLength(1)
    expect(machineSpecific([{ type: 'file', filePath: '/opt/x.js', hash: null }])).toHaveLength(1)
    expect(
      machineSpecific([config({ icon: join(REPO_ROOT, 'apps', 'mobile', 'icon.png') })])
    ).toHaveLength(2)
  })
})
