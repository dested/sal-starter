import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ConfigContext, ExpoConfig } from 'expo/config'
import { withDangerousMod, type ConfigPlugin } from 'expo/config-plugins'
import { z } from 'zod'

// Identity comes from the repo-root project.json (CLAUDE.md rule #22). It's
// JSON, not TS, because the Expo config loader can't import workspace TS
// sources. Same shape as scripts/project.ts; a bad file fails the prebuild.
export const projectSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  scheme: z.string().regex(/^[a-z][a-z0-9]*$/),
  bundleId: z.string().regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/),
  apiPort: z.number().int(),
  metroPort: z.number().int(),
  db: z.string(),
  easProjectId: z.string().nullable(),
  easOwner: z.string().min(1),
  appleTeamId: z.string().nullable(),
  // Set by the kickoff; a fork older than `look` has none (treated as light).
  look: z
    .object({ scheme: z.enum(['light', 'dark']), direction: z.string() })
    .nullable()
    .optional(),
})

export type Project = z.infer<typeof projectSchema>

export const project = projectSchema.parse(
  JSON.parse(readFileSync(join(__dirname, '..', '..', 'project.json'), 'utf8'))
)

// Native surfaces (splash, root view) paint the token background, generated
// from tokens.css into @app/tokens colors.json (`bun run tokens`).
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
// all three sit side by side on one iPad. Each is also the EAS Update channel
// of the same name (eas.json `channel`).
const variantSchema = z.enum(['development', 'preview', 'production'])
export type Variant = z.infer<typeof variantSchema>
const variant = variantSchema.parse(process.env.APP_VARIANT ?? 'production')

export const EAS_SETUP = 'bun run --cwd apps/mobile eas:setup'

const easExtra = z.object({ eas: z.object({ projectId: z.string().min(1) }) })

/**
 * Why `config` can't ship as a `variant` binary that receives EAS Updates; null when it can.
 * A production binary must have them (Tell Santa 1.0 shipped to the App Store with expo-updates
 * off, so every fix needed App Review). Development and preview may be local-only (no EAS
 * project yet), but once updates are on, the channel must be the variant's.
 */
export function updatesProblem(config: ExpoConfig, variant: Variant): string | null {
  const updates = config.updates
  const on = updates?.url?.startsWith('https://u.expo.dev/') === true && updates.enabled !== false
  if (!on) {
    if (variant !== 'production') return null
    const linked = easExtra.safeParse(config.extra).success
    return (
      'EAS Update is off, so this production (App Store / Play Store) build would ship without ' +
      'over-the-air updates and every fix would need a new store review. ' +
      (linked
        ? 'updates.url is missing or updates.enabled is false in app.config.ts: put them back.'
        : `project.json easProjectId is null. Run \`${EAS_SETUP}\` (it creates the EAS project ` +
          'and writes easProjectId), then build again.')
    )
  }
  const channel = updates?.requestHeaders?.['expo-channel-name']
  if (channel !== variant) {
    return (
      `The ${variant} build's EAS Update channel is ${channel === undefined ? 'unset' : `'${channel}'`}, ` +
      `not '${variant}': a binary built outside EAS Build (Xcode, expo run, expo-wsl-ios, Limrun) ` +
      `would never receive an update. Set updates.requestHeaders['expo-channel-name'] from APP_VARIANT in app.config.ts.`
    )
  }
  return null
}

/**
 * Refuses to generate a native project that can't receive updates (updatesProblem). A mod, so it
 * runs only when native files are written: `expo prebuild`, `expo run:*`, EAS Build's prebuild,
 * expo-wsl-ios and the Mac path. Evaluating the config (`expo config`, `expo install`,
 * expo-doctor, `expo export`, fingerprints, tests) never trips it. Dangerous mods are skipped by
 * introspection.
 */
export const withUpdatesRequired: ConfigPlugin<Variant> = (config, variant) => {
  for (const platform of ['ios', 'android'] as const) {
    config = withDangerousMod(config, [
      platform,
      (modConfig) => {
        const problem = updatesProblem(modConfig, variant)
        if (problem !== null) throw new Error(problem)
        return modConfig
      },
    ])
  }
  return config
}

/** What the config derives from the project and variant, named as appConfig uses them. */
function derive(project: Project, variant: Variant) {
  return {
    suffix: variant === 'production' ? '' : `.${variant === 'development' ? 'dev' : 'preview'}`,
    schemeSuffix: variant === 'production' ? '' : variant === 'development' ? 'dev' : 'preview',
    nameSuffix: variant === 'production' ? '' : variant === 'development' ? ' (Dev)' : ' (Preview)',
    // One theme, never the OS's: the app's scheme is the look's (none yet: light).
    colorScheme: project.look?.scheme ?? 'light',
    // Info.plist usage strings, named so they're easy to find and reword.
    LOCAL_NETWORK_USAGE: `${project.displayName} connects to your development server on the local network.`,
  }
}

/**
 * The app config for one project and variant (the default export reads both from disk and env).
 * Call it with three arguments: the fourth only names derive()'s values for the object below.
 */
export const appConfig = (
  config: ConfigContext['config'],
  project: Project,
  variant: Variant,
  { suffix, schemeSuffix, nameSuffix, colorScheme, LOCAL_NETWORK_USAGE } = derive(project, variant)
): ExpoConfig => ({
  ...config,
  name: `${project.displayName}${nameSuffix}`,
  slug: project.name,
  // The Expo account that owns the EAS project (scripts/eas-setup.ts creates it there).
  owner: project.easOwner,
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
  // they print the project id, which goes in project.json easProjectId
  // (scripts/eas-setup.ts), and the url follows. Without it expo-updates is off
  // (lib/ota.ts checks isEnabled), so a production native build refuses
  // (withUpdatesRequired). The channel header is the variant: EAS Build
  // writes eas.json's `channel` (same names) over it, and every other build
  // (Xcode on a Mac, expo run, expo-wsl-ios, Limrun) needs it or never gets an
  // update. ON_LOAD + 0: launch never waits on the network; lib/ota.ts applies at once.
  ...(project.easProjectId === null
    ? {}
    : {
        updates: {
          url: `https://u.expo.dev/${project.easProjectId}`,
          requestHeaders: { 'expo-channel-name': variant },
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
    'expo-image',
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

// withUpdatesRequired is applied here, not listed in `plugins` (ExpoConfig types
// plugins as module names): its mod refuses `expo prebuild` / EAS Build of a
// production binary without EAS Update.
export default ({ config }: ConfigContext): ExpoConfig =>
  withUpdatesRequired(appConfig(config, project, variant), variant)
