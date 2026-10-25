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
  // Set by the kickoff; a fork older than `look` has none (treated as light).
  look: z
    .object({ scheme: z.enum(['light', 'dark']), direction: z.string() })
    .nullable()
    .optional(),
})

const project = projectSchema.parse(
  JSON.parse(readFileSync(join(__dirname, '..', '..', 'project.json'), 'utf8'))
)

// One theme, never the OS's: the app's scheme is the look's, and native
// surfaces (splash, root view) paint the token background, generated from
// tokens.css into @app/tokens colors.json (`bun run tokens`).
const colorScheme = project.look?.scheme ?? 'light'
const { background: BACKGROUND } = z
  .object({ background: z.string() })
  .parse(
    JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'packages', 'tokens', 'colors.json'), 'utf8')
    )
  )

// Icon and splash colors, resolved from packages/brand/brand.json by
// `bun run brand` (which also renders ./assets from packages/brand/mark.svg).
const brand = z
  .object({
    icon: z.object({ background: z.string() }),
    splash: z.object({ background: z.string(), markWidth: z.number() }),
  })
  .parse(
    JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'packages', 'brand', 'brand.gen.json'), 'utf8')
    )
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

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `${project.displayName}${nameSuffix}`,
  slug: project.name,
  scheme: `${project.scheme}${schemeSuffix}`,
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: colorScheme,
  backgroundColor: BACKGROUND,
  runtimeVersion: { policy: 'fingerprint' },
  // Read at runtime by src/lib/app-config.ts. apiPort lets LAN dev find the API
  // next to Metro without a mobile .env (identity stays in project.json).
  // apiUrl is the deployed server (Drydock's default <name>.dested.com), so a
  // preview or production bundle always has one; EXPO_PUBLIC_API_URL overrides.
  // scheme is the base scheme: the variant suffix is read from the installed
  // binary at runtime, so one update bundle serves preview and production.
  extra: {
    apiPort: project.apiPort,
    apiUrl: `https://${project.name}.dested.com`,
    scheme: project.scheme,
    colorScheme,
    kickoffPending: project.look === null,
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
  android: {
    package: `${project.bundleId}${suffix}`,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/adaptive-icon-monochrome.png',
      backgroundColor: brand.icon.background,
    },
  },
  // React Compiler as SDK 58's template ships it (babel-preset-expo carries the plugin).
  experiments: { typedRoutes: true, reactCompiler: true },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-build-properties',
    // The launch status bar (before JS runs) contrasts with the one scheme.
    ['expo-status-bar', { style: colorScheme === 'dark' ? 'light' : 'dark' }],
    'expo-web-browser',
    [
      'expo-splash-screen',
      {
        // The bare mark on the brand color, no tile. BrandSplash
        // (src/components/brand-splash.tsx) redraws it exactly, then animates out.
        image: './assets/splash-icon.png',
        imageWidth: brand.splash.markWidth,
        resizeMode: 'contain',
        backgroundColor: brand.splash.background,
      },
    ],
    '@app/native-example',
  ],
})
