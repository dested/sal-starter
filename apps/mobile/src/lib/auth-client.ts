import { expoClient } from '@better-auth/expo/client'
import { createAuthClient } from 'better-auth/react'
import * as SecureStore from 'expo-secure-store'
import { apiUrl } from '~/lib/api-url'
import { appConfig } from '~/lib/app-config'

// better-auth over the same /api/auth the web app uses. The session cookie and
// a cached session live in SecureStore, so a cold start knows who's signed in
// before any network round-trip (no signed-out flash).
export const authClient = createAuthClient({
  baseURL: apiUrl(),
  plugins: [
    expoClient({
      scheme: appConfig.scheme,
      storagePrefix: appConfig.scheme,
      storage: SecureStore,
    }),
  ],
})
