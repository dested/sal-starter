import { env } from '~/env'
import { appConfig } from '~/lib/app-config'

// LAN dev: Metro's hostUri is "<lan-ip>:<metro-port>", and the same machine
// runs the API on project.json's apiPort. EXPO_PUBLIC_API_URL wins everywhere
// else (tunnel, preview, production, or Metro on a different box than the API).
export function apiUrl(): string {
  if (env.EXPO_PUBLIC_API_URL !== undefined) return env.EXPO_PUBLIC_API_URL.replace(/\/$/, '')
  const host = appConfig.hostUri?.split(':')[0]
  if (!__DEV__ || host === undefined || host === '') {
    throw new Error('EXPO_PUBLIC_API_URL is required outside LAN dev')
  }
  return `http://${host}:${appConfig.extra.apiPort}`
}
