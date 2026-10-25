// Pure half of api-url.ts (no Expo imports), so `bun test` can cover it.

export type ApiUrlInputs = {
  /** EXPO_PUBLIC_API_URL, when set. */
  envUrl: string | undefined
  /** Metro's "<host>:<port>" (Constants.expoConfig.hostUri) in a dev client. */
  hostUri: string | undefined
  dev: boolean
  /** project.json apiPort: the API runs next to Metro on the dev machine. */
  apiPort: number
  /** The deployed server (app.config.ts extra.apiUrl). */
  deployedUrl: string
}

// EXPO_PUBLIC_API_URL wins everywhere it's set (tunnel, custom domain, Metro on
// a different box than the API). LAN dev: the same machine as Metro runs the
// API on apiPort. Everything else (preview, production, an OTA) talks to the
// deployed server, so a bundle built without the env var still starts instead
// of crash-looping into an expo-updates rollback.
export function resolveApiUrl({
  envUrl,
  hostUri,
  dev,
  apiPort,
  deployedUrl,
}: ApiUrlInputs): string {
  if (envUrl !== undefined) return envUrl.replace(/\/$/, '')
  const host = hostOf(hostUri)
  if (dev && host !== null) return `http://${host}:${apiPort}`
  return deployedUrl
}

/** The host part of "<host>:<port>", keeping an IPv6 literal's brackets. */
function hostOf(hostUri: string | undefined): string | null {
  if (hostUri === undefined) return null
  const host = hostUri.startsWith('[')
    ? hostUri.slice(0, hostUri.indexOf(']') + 1)
    : (hostUri.split(':')[0] ?? '')
  return host === '' ? null : host
}
