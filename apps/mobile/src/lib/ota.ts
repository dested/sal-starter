// Over-the-air updates land at once (decision Q3): on launch and every time the
// app comes back to the foreground, check the build's channel, download a new
// bundle and reload into it. A screen in a critical flow (a game round, a
// checkout) defers the reload with useOtaHold(true) until it lets go; the root
// layout holds it while the brand splash is up. Off in dev and wherever
// expo-updates is disabled (no easProjectId in project.json, so no updates.url).
import * as Updates from 'expo-updates'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { createHoldGate } from '~/lib/ota-hold'

const gate = createHoldGate()
let busy = false
// A downloaded update waiting on a hold: later checks don't fetch it again.
let downloaded = false

const reload = () => void Updates.reloadAsync().catch(() => {})

async function applyUpdate(): Promise<void> {
  if (busy || __DEV__ || !Updates.isEnabled) return
  if (downloaded) return gate.whenFree(reload)
  busy = true
  try {
    const check = await Updates.checkForUpdateAsync()
    if (!check.isAvailable) return
    const fetched = await Updates.fetchUpdateAsync()
    if (!fetched.isNew) return
    downloaded = true
    gate.whenFree(reload)
  } catch {
    // Offline or the update server is down: keep running the bundle we have.
  } finally {
    busy = false
  }
}

/** Starts the check on launch and on each return to the foreground. Returns the unsubscribe. */
export function startOta(): () => void {
  void applyUpdate()
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') void applyUpdate()
  })
  return () => sub.remove()
}

/**
 * While `active`, a downloaded update waits instead of reloading the app under
 * the user; it applies the moment the last hold releases (or unmounts).
 */
export function useOtaHold(active: boolean): void {
  useEffect(() => (active ? gate.acquire() : undefined), [active])
}
