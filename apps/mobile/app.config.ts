import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ConfigContext, ExpoConfig } from 'expo/config'
import { z } from 'zod'

// Identity comes from the repo-root project.json (CLAUDE.md rule #22). It's
// JSON, not TS, because the Expo config loader can't import workspace TS
// sources. Same shape as scripts/project.ts; a bad file fails the prebuild.
const projectSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  scheme: z.string().regex(/^[a-z][a-z0-9]*$/),
  bundleId: z.string().regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/),
  apiPort: z.number().int(),
  metroPort: z.number().int(),
  db: z.string(),
  easProjectId: z.string().nullable(),
  appleTeamId: z.string().nullable(),
})

const project = projectSchema.parse(
  JSON.parse(readFileSync(join(__dirname, '..', '..', 'project.json'), 'utf8'))
)

// APP_VARIANT picks the install: development (local/Mac dev client), preview
// (ad hoc), production (store). Variants get their own bundle id + scheme so
// all three sit side by side on one iPad.
const variant = z
  .enum(['development', 'preview', 'production'])
  .parse(process.env.APP_VARIANT ?? 'production')
const suffix = variant === 'production' ? '' : `.${variant === 'development' ? 'dev' : 'preview'}`
const schemeSuffix = variant === 'production' ? '' : variant === 'development' ? 'dev' : 'preview'
const nameSuffix =
  variant === 'production' ? '' : variant === 'development' ? ' (Dev)' : ' (Preview)'

// Info.plist usage strings, named so they're easy to find and reword.
const LOCAL_NETWORK_USAGE = `${project.displayName} connects to your development server on the local network.`

// Splash/system background before first paint, matching tokens.css --background.
const BACKGROUND_LIGHT = '#ffffff'
const BACKGROUND_DARK = '#0a0a0a'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `${project.displayName}${nameSuffix}`,
  slug: project.name,
  scheme: `${project.scheme}${schemeSuffix}`,
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: BACKGROUND_LIGHT,
  runtimeVersion: { policy: 'fingerprint' },
  // Read at runtime by src/lib/app-config.ts. apiPort lets LAN dev find the API
  // next to Metro without a mobile .env (identity stays in project.json).
  extra: {
    apiPort: project.apiPort,
    ...(project.easProjectId === null ? {} : { eas: { projectId: project.easProjectId } }),
  },
  // EAS Update. `eas init` / `eas update:configure` can't write a dynamic config:
  // they print the project id, which goes in project.json easProjectId, and the
  // url follows. Without it expo-updates is off (lib/ota.ts checks isEnabled).
  // ON_LOAD + 0: launch never waits on the network; lib/ota.ts applies at once.
  ...(project.easProjectId === null
    ? {}
    : {
        updates: {
          url: `https://u.expo.dev/${project.easProjectId}`,
          checkAutomatically: 'ON_LOAD',
          fallbackToCacheTimeout: 0,
        },
      }),
  ios: {
    bundleIdentifier: `${project.bundleId}${suffix}`,
    supportsTablet: true,
    ...(project.appleTeamId === null ? {} : { appleTeamId: project.appleTeamId }),
    // Export compliance answered in config, so TestFlight never asks per build.
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      NSLocalNetworkUsageDescription: LOCAL_NETWORK_USAGE,
      ITSAppUsesNonExemptEncryption: false,
      // Dev builds talk plain http to the Windows box on the LAN; never in prod.
      ...(variant === 'development'
        ? { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } }
        : {}),
    },
  },
  experiments: { typedRoutes: true },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-build-properties',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: BACKGROUND_LIGHT,
        dark: { image: './assets/splash-icon.png', backgroundColor: BACKGROUND_DARK },
      },
    ],
    '@app/native-example',
  ],
})
