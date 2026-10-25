import { env } from '~/env'
import { appConfig } from '~/lib/app-config'
import { resolveApiUrl } from '~/lib/resolve-api-url'

/** The API base URL: EXPO_PUBLIC_API_URL, else the dev machine on the LAN, else the deployed server. */
export function apiUrl(): string {
  return resolveApiUrl({
    envUrl: env.EXPO_PUBLIC_API_URL,
    hostUri: appConfig.hostUri,
    dev: __DEV__,
    apiPort: appConfig.extra.apiPort,
    deployedUrl: appConfig.extra.apiUrl,
  })
}
