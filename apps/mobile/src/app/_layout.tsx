import '../../global.css'
import { colors } from '@app/tokens'
import { QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useEffect } from 'react'
import { Uniwind } from 'uniwind'
import { KickoffRibbon } from '~/components/kickoff-ribbon'
import { appConfig } from '~/lib/app-config'
import { authClient } from '~/lib/auth-client'
import { startOta } from '~/lib/ota'
import { wireReactQueryToNative } from '~/lib/query-rn'
import { queryClient, trpcClient, TRPCProvider } from '~/lib/trpc'

// Layouts hold providers and the session guard only; screens live in src/screens.
void SplashScreen.preventAutoHideAsync()
wireReactQueryToNative()

// One theme (project.json look): the root view behind every screen is the
// token background, and the status bar contrasts with it. Uniwind follows the
// OS scheme until a theme is set; pinning it to the look's scheme stops the OS
// from ever flipping the app (`dark:` never matches anyway, theme.css).
Uniwind.setTheme(appConfig.extra.colorScheme)
void SystemUI.setBackgroundColorAsync(colors.background)
const STATUS_BAR = appConfig.extra.colorScheme === 'dark' ? 'light' : 'dark'

export default function RootLayout() {
  const { data: session, isPending } = authClient.useSession()

  // A published update installs and reloads at once (lib/ota.ts).
  useEffect(() => startOta(), [])

  // Hold the splash until the cached session (SecureStore) resolves, so the
  // first frame is already on the right side of the auth guard.
  useEffect(() => {
    if (!isPending) void SplashScreen.hideAsync()
  }, [isPending])

  if (isPending) return null

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <StatusBar style={STATUS_BAR} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}>
          {/* Explicit redirects: SDK 58's default falls back to the first open
              group's path, and `(auth)` has no index, so a signed-out launch
              at `/` landed on "Unmatched Route". */}
          <Stack.Protected guard={session !== null} redirectTo="/sign-in">
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={session === null} redirectTo="/">
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
        <KickoffRibbon />
      </TRPCProvider>
    </QueryClientProvider>
  )
}
