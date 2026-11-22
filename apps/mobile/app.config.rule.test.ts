import { describe, expect, test } from 'bun:test'
import type { ExpoConfig } from 'expo/config'
import appConfig from './app.config'

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
    const config = appConfig({
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
