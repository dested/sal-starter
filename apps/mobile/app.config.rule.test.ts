import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ExpoConfig } from 'expo/config'
import type { ExportedConfig } from 'expo/config-plugins'
import defaultConfig, {
  appConfig,
  EAS_SETUP,
  projectSchema,
  updatesProblem,
  withUpdatesRequired,
  type Project,
  type Variant,
} from './app.config'

// Every fork is a universal app (CLAUDE.md rule 32): it installs and runs full size on an iPad,
// not as a letterboxed iPhone app. Tell Santa shipped iPhone-only and was unusable on Sal's iPad.

/** Why `config` isn't a universal iOS app the App Store will take; empty when it is. */
function universalProblems(config: ExpoConfig): string[] {
  const problems: string[] = []
  if (config.ios?.supportsTablet !== true)
    problems.push('ios.supportsTablet must be true: every fork runs full size on an iPad')
  if (config.ios?.isTabletOnly === true)
    problems.push('ios.isTabletOnly must not be true: the app runs on iPhone too')
  // ITMS-90474: an iPad app that allows multitasking must support all four orientations, so a
  // locked orientation needs requireFullScreen (an iPad window can still be resized on iOS 27:
  // layouts key off the window size, never the device).
  const locked = config.orientation === 'portrait' || config.orientation === 'landscape'
  if (locked && config.ios?.requireFullScreen !== true)
    problems.push(
      `orientation is '${config.orientation}', so ios.requireFullScreen must be true (App Store ITMS-90474)`
    )
  return problems
}

const base: ExpoConfig = { name: 'x', slug: 'x', ios: { supportsTablet: true } }

describe('app.config.ts', () => {
  test('is a universal app the App Store accepts', () => {
    const config = defaultConfig({
      projectRoot: import.meta.dir,
      staticConfigPath: null,
      packageJsonPath: null,
      config: {},
    })
    expect(universalProblems(config)).toEqual([])
  })
})

describe('universalProblems', () => {
  test('passes a universal app in any orientation once a locked one is full screen', () => {
    expect(universalProblems(base)).toEqual([])
    expect(universalProblems({ ...base, orientation: 'default' })).toEqual([])
    expect(
      universalProblems({
        ...base,
        orientation: 'portrait',
        ios: { supportsTablet: true, requireFullScreen: true },
      })
    ).toEqual([])
  })

  test('refuses an iPhone-only or iPad-only app', () => {
    expect(universalProblems({ ...base, ios: { supportsTablet: false } })).toHaveLength(1)
    expect(universalProblems({ ...base, ios: {} })).toHaveLength(1)
    expect(universalProblems({ ...base, ios: undefined })).toHaveLength(1)
    expect(
      universalProblems({ ...base, ios: { supportsTablet: true, isTabletOnly: true } })
    ).toHaveLength(1)
  })

  test('refuses a locked orientation that allows multitasking (ITMS-90474)', () => {
    expect(universalProblems({ ...base, orientation: 'portrait' })).toHaveLength(1)
    expect(
      universalProblems({
        ...base,
        orientation: 'landscape',
        ios: { supportsTablet: true, requireFullScreen: false },
      })
    ).toHaveLength(1)
  })
})

// A store binary can never ship without EAS Update (decisions 2026-11-23): Tell Santa 1.0 went to
// the App Store from a `--no-eas` fork with expo-updates off, so every fix needed App Review.

const real = projectSchema.parse(
  JSON.parse(readFileSync(join(import.meta.dir, '..', '..', 'project.json'), 'utf8'))
)
const ID = '00000000-1111-2222-3333-444444444444'
const linked: Project = { ...real, easProjectId: ID }
const unlinked: Project = { ...real, easProjectId: null }

/** Runs the native-generation guard the way `expo prebuild` does: the dangerous mod per platform. */
async function prebuild(project: Project, variant: Variant): Promise<string[]> {
  const config: ExportedConfig = withUpdatesRequired(appConfig({}, project, variant), variant)
  const errors: string[] = []
  for (const platform of ['ios', 'android'] as const) {
    const mod = config.mods?.[platform]?.dangerous
    if (mod === undefined) throw new Error(`no ${platform} dangerous mod registered`)
    try {
      await mod({
        ...config,
        modResults: null,
        modRawConfig: config,
        modRequest: {
          projectRoot: import.meta.dir,
          platformProjectRoot: join(import.meta.dir, platform),
          modName: 'dangerous',
          platform,
          introspect: false,
        },
      })
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  return errors
}

describe('EAS Update in every binary', () => {
  test('production: the EAS url, the production channel, a fingerprint runtime', async () => {
    const config = appConfig({}, linked, 'production')
    expect(config.updates?.url).toBe(`https://u.expo.dev/${ID}`)
    expect(config.updates?.requestHeaders).toEqual({ 'expo-channel-name': 'production' })
    expect(config.runtimeVersion).toEqual({ policy: 'fingerprint' })
    expect(config.extra?.eas).toEqual({ projectId: ID })
    expect(updatesProblem(config, 'production')).toBeNull()
    expect(await prebuild(linked, 'production')).toEqual([])
  })

  test('preview and development carry their own channel (the eas.json channel names)', async () => {
    for (const variant of ['preview', 'development'] as const) {
      const config = appConfig({}, linked, variant)
      expect(config.updates?.requestHeaders).toEqual({ 'expo-channel-name': variant })
      expect(await prebuild(linked, variant)).toEqual([])
    }
  })

  test('production without an EAS project refuses to prebuild, naming eas:setup', async () => {
    const config = appConfig({}, unlinked, 'production')
    expect(config.updates).toBeUndefined()
    const errors = await prebuild(unlinked, 'production')
    expect(errors).toHaveLength(2) // ios and android
    for (const error of errors) {
      expect(error).toContain('EAS Update is off')
      expect(error).toContain('easProjectId is null')
      expect(error).toContain(EAS_SETUP)
    }
  })

  test('development and preview may stay local-only until eas:setup', async () => {
    expect(await prebuild(unlinked, 'development')).toEqual([])
    expect(await prebuild(unlinked, 'preview')).toEqual([])
  })

  test('refuses a production config with updates turned off or on the wrong channel', () => {
    const config = appConfig({}, linked, 'production')
    const updates = config.updates ?? {}
    expect(
      updatesProblem({ ...config, updates: { ...updates, enabled: false } }, 'production')
    ).toContain('updates.enabled is false')
    expect(
      updatesProblem({ ...config, updates: { ...updates, requestHeaders: {} } }, 'production')
    ).toContain('channel is unset')
    expect(
      updatesProblem(
        { ...config, updates: { ...updates, requestHeaders: { 'expo-channel-name': 'preview' } } },
        'production'
      )
    ).toContain("channel is 'preview'")
  })
})
