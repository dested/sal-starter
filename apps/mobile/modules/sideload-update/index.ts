// Tells a sideloaded production APK (installed from https://appstore.dested.com,
// not Google Play) that a newer native build exists, and sends the person to
// the store's install page. JS-only fixes still arrive through EAS Update; this
// is for a new APK. The app never downloads or installs anything itself.
import * as Application from 'expo-application'
import { NativeModule, requireOptionalNativeModule } from 'expo'
import * as SecureStore from 'expo-secure-store'
import { useEffect } from 'react'
import { Alert, AppState, Linking, Platform } from 'react-native'
import { androidManifest, type AndroidManifest } from './manifest'
import { updateState } from './update-state'

export { androidManifest, type AndroidManifest } from './manifest'
export { updateState, type UpdateState } from './update-state'

declare class SideloadUpdateModule extends NativeModule {
  installerPackageName(): string | null
}

// Optional: null on iOS and in a dev client built before this module existed.
const native = requireOptionalNativeModule<SideloadUpdateModule>('SideloadUpdate')

const STORE = 'https://appstore.dested.com/api/android'
const PLAY_STORE = 'com.android.vending'
const THROTTLE_MS = 12 * 60 * 60 * 1000
const TIMEOUT_MS = 5000
const LAST_CHECK_KEY = 'sideload-update.last-check'

// Production only, read from the native application id the way the starter's
// src/lib/app-config.ts does (.dev / .preview suffixes), so this folder needs
// nothing from the app it's copied into.
function isProductionInstall(): boolean {
  const id = Application.applicationId ?? ''
  return id !== '' && !id.endsWith('.dev') && !id.endsWith('.preview')
}

function isSideloaded(): boolean {
  if (native === null) return false
  // Null (adb, or Android won't say) counts as sideloaded.
  return native.installerPackageName() !== PLAY_STORE
}

// After a `required` answer every foreground checks again; otherwise once per 12 h.
let required = false
let busy = false
let showing = false

async function throttled(): Promise<boolean> {
  if (required) return false
  const last = Number(await SecureStore.getItemAsync(LAST_CHECK_KEY))
  return Number.isFinite(last) && Date.now() - last < THROTTLE_MS
}

async function fetchManifest(applicationId: string): Promise<AndroidManifest | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${STORE}/${encodeURIComponent(applicationId)}.json`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
    // Any answer (a 404 for an app the store doesn't list included) counts as a check.
    await SecureStore.setItemAsync(LAST_CHECK_KEY, String(Date.now()))
    if (!res.ok) return null
    const parsed = androidManifest.safeParse(await res.json())
    return parsed.success ? parsed.data : null
  } finally {
    clearTimeout(timer)
  }
}

function prompt(manifest: AndroidManifest, state: 'available' | 'required'): void {
  if (showing) return
  showing = true
  const done = () => {
    showing = false
  }
  const open = () => {
    done()
    void Linking.openURL(manifest.installPageUrl).catch(() => {})
  }
  const name = Application.applicationName ?? 'An update'
  const title = `${name} ${manifest.latest.versionName} is ready`
  if (state === 'required') {
    Alert.alert(
      title,
      'This version needs the update to keep working.',
      [{ text: 'Update', onPress: open }],
      {
        cancelable: false,
      }
    )
  } else {
    Alert.alert(
      title,
      manifest.latest.notes || undefined,
      [
        { text: 'Later', style: 'cancel', onPress: done },
        { text: 'Update', onPress: open },
      ],
      { onDismiss: done }
    )
  }
}

async function check(): Promise<void> {
  const applicationId = Application.applicationId
  if (busy || showing || applicationId === null) return
  busy = true
  try {
    if (await throttled()) return
    const manifest = await fetchManifest(applicationId)
    if (manifest === null) return
    // nativeBuildVersion is the versionCode on Android; null → NaN → no prompt.
    const state = updateState(Number(Application.nativeBuildVersion ?? Number.NaN), manifest)
    required = state === 'required'
    if (state !== 'none') prompt(manifest, state)
  } catch {
    // Offline, timed out, bad JSON, SecureStore unavailable: try again later.
  } finally {
    busy = false
  }
}

/**
 * Call once in the root layout. On a sideloaded production Android install it
 * checks the store on launch and on every return to the foreground (at most
 * every 12 hours, every time while an update is required) and offers the new
 * build. Everywhere else it does nothing.
 */
export function useSideloadUpdatePrompt(): void {
  useEffect(() => {
    if (Platform.OS !== 'android' || !isProductionInstall() || !isSideloaded()) return
    void check()
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check()
    })
    return () => sub.remove()
  }, [])
}
