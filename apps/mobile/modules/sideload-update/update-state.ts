import type { AndroidManifest } from './manifest'

export type UpdateState = 'none' | 'available' | 'required'

/**
 * What the installed build (its Android versionCode) should do about the
 * store's manifest. An unknown installed version (NaN, 0) never prompts.
 */
export function updateState(
  installedVersionCode: number,
  manifest: Pick<AndroidManifest, 'minSupportedVersionCode'> & {
    latest: Pick<AndroidManifest['latest'], 'versionCode'>
  }
): UpdateState {
  if (!Number.isInteger(installedVersionCode) || installedVersionCode <= 0) return 'none'
  const min = manifest.minSupportedVersionCode
  if (min !== null && installedVersionCode < min) return 'required'
  if (installedVersionCode < manifest.latest.versionCode) return 'available'
  return 'none'
}
