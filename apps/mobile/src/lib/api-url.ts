import { env } from '~/env'
import { appConfig } from '~/lib/app-config'

// EXPO_PUBLIC_API_URL wins everywhere it's set (tunnel, custom domain, Metro on
// a different box than the API). LAN dev: Metro's hostUri is
// "<lan-ip>:<metro-port>", and the same machine runs the API on project.json's
// apiPort. Everything else (preview, production, an OTA) talks to the deployed
// server, so a bundle built without the env var still starts instead of
// crash-looping into an expo-updates rollback.
export function apiUrl(): string {
  if (env.EXPO_PUBLIC_API_URL !== undefined) return env.EXPO_PUBLIC_API_URL.replace(/\/$/, '')
  const host = appConfig.hostUri?.split(':')[0]
  if (__DEV__ && host !== undefined && host !== '') {
    return `http://${host}:${appConfig.extra.apiPort}`
  }
  return appConfig.extra.apiUrl
}
