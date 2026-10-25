import { File, Paths } from 'expo-file-system'
import * as Updates from 'expo-updates'
import { Platform } from 'react-native'

// The fingerprint this binary was built with: the same hash `bun run
// fingerprint` prints when nothing native changed since (CLAUDE.md rule #20).
// Updates.runtimeVersion isn't it in a dev client: expo-updates' dev-launcher
// controller reports "1" until updates are configured (no easProjectId). The
// build step writes the real one in debug builds too, so read that file:
// iOS EXUpdates.bundle/fingerprint in the app bundle, Android assets/fingerprint.
export function buildFingerprint(): string | null {
  try {
    const file =
      Platform.OS === 'ios'
        ? new File(Paths.bundle, 'EXUpdates.bundle', 'fingerprint')
        : new File('asset:///fingerprint')
    if (file.exists) return file.textSync().trim()
  } catch {
    // Not in this build (or an older expo-updates layout): fall through.
  }
  const runtime = Updates.runtimeVersion
  return runtime === null || runtime === '1' ? null : runtime
}
