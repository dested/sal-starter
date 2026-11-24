import { describe, expect, test } from 'bun:test'
import { updateState } from './update-state'

const manifest = (latest: number, min: number | null) => ({
  latest: { versionCode: latest },
  minSupportedVersionCode: min,
})

describe('updateState', () => {
  test('installed equals latest: none', () => {
    expect(updateState(12, manifest(12, 10))).toBe('none')
  })

  test('installed above latest (a build the store has not caught up to): none', () => {
    expect(updateState(13, manifest(12, 10))).toBe('none')
  })

  test('below latest, at or above the minimum: available', () => {
    expect(updateState(11, manifest(12, 10))).toBe('available')
    expect(updateState(10, manifest(12, 10))).toBe('available')
  })

  test('below the minimum: required', () => {
    expect(updateState(9, manifest(12, 10))).toBe('required')
  })

  test('no minimum: below latest is only available', () => {
    expect(updateState(1, manifest(12, null))).toBe('available')
    expect(updateState(12, manifest(12, null))).toBe('none')
  })

  test('unknown installed version never prompts', () => {
    expect(updateState(Number.NaN, manifest(12, 10))).toBe('none')
    expect(updateState(0, manifest(12, 10))).toBe('none')
    expect(updateState(1.5, manifest(12, 10))).toBe('none')
  })
})
