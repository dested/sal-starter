// Over-the-air updates land at once: on launch and every time the app comes
// back to the foreground, check the build's channel, download a new bundle and
// reload into it. Off in dev and wherever expo-updates is disabled (no
// easProjectId in project.json, so no updates.url).
import * as Updates from 'expo-updates'
import { AppState } from 'react-native'

let busy = false

async function applyUpdate(): Promise<void> {
  if (busy || __DEV__ || !Updates.isEnabled) return
  busy = true
  try {
    const check = await Updates.checkForUpdateAsync()
    if (!check.isAvailable) return
    const fetched = await Updates.fetchUpdateAsync()
    if (fetched.isNew) await Updates.reloadAsync()
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
