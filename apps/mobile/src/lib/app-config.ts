import * as Application from 'expo-application'
import Constants from 'expo-constants'
import { z } from 'zod'

// The runtime view of app.config.ts (which reads project.json). Validated once
// so the rest of the app never touches `Constants.expoConfig` directly.
const schema = z.object({
  extra: z.object({
    apiPort: z.number().int(),
    apiUrl: z.url(),
    scheme: z.string(),
    colorScheme: z.enum(['light', 'dark']),
    kickoffPending: z.boolean(),
  }),
  hostUri: z.string().optional(),
})

export const appConfig = schema.parse(Constants.expoConfig)

// Which install this is, read from the native bundle id (app.config.ts adds
// .dev / .preview), never from the JS bundle: the same update bundle runs in
// preview and production, so `ota:promote` ships exactly what was tested.
const bundleId = Application.applicationId ?? ''
export const variant = bundleId.endsWith('.dev')
  ? 'development'
  : bundleId.endsWith('.preview')
    ? 'preview'
    : 'production'

/** This install's URL scheme (deep links, better-auth redirects); matches app.config.ts. */
export const appScheme = `${appConfig.extra.scheme}${variant === 'production' ? '' : variant === 'development' ? 'dev' : 'preview'}`
