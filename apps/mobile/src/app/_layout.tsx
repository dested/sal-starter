import '../../global.css'
import { colors } from '@app/tokens'
import { QueryClientProvider } from '@tanstack/react-query'
import { Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { Toaster } from 'sonner-native'
import { Uniwind } from 'uniwind'
import { BrandSplash } from '~/components/brand-splash'
import { KickoffRibbon } from '~/components/kickoff-ribbon'
import { appConfig } from '~/lib/app-config'
import { authClient } from '~/lib/auth-client'
import { useAppFonts } from '~/lib/fonts'
import { navTheme } from '~/lib/nav-theme'
import { startOta, useOtaHold } from '~/lib/ota'
import { wireReactQueryToNative } from '~/lib/query-rn'
import { queryClient, trpcClient, TRPCProvider } from '~/lib/trpc'

// Layouts hold providers and the session guard only; screens live in src/screens.
// The native splash stays up until BrandSplash (its exact JS copy) has drawn
// and hides it; BrandSplash then leaves once `ready`.
void SplashScreen.preventAutoHideAsync()
wireReactQueryToNative()

// One theme (project.json look): the root view behind every screen is the
// token background, and the status bar contrasts with it. Uniwind follows the
// OS scheme until a theme is set; pinning it to the look's scheme stops the OS
// from ever flipping the app (`dark:` never matches anyway, theme.css).
Uniwind.setTheme(appConfig.extra.colorScheme)
void SystemUI.setBackgroundColorAsync(colors.background)
const STATUS_BAR = appConfig.extra.colorScheme === 'dark' ? 'light' : 'dark'
const TOAST_OPTIONS = {
  style: { backgroundColor: colors.popover, borderColor: colors.border, borderWidth: 1 },
  titleStyle: { color: colors.popoverForeground },
  descriptionStyle: { color: colors.mutedForeground },
}

export default function RootLayout() {
  const { data: session, isPending } = authClient.useSession()
  const fontsLoaded = useAppFonts()
  const [splashGone, setSplashGone] = useState(false)

  // A published update installs and reloads at once (lib/ota.ts), but never
  // under the splash or mid-exit.
  useEffect(() => startOta(), [])
  useOtaHold(!splashGone)

  return (
    <GestureHandlerRootView style={styles.root}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
            <ThemeProvider value={navTheme}>
              <StatusBar style={STATUS_BAR} />
              {/* The Stack mounts once the cached session (SecureStore) resolves,
                  so the first frame is already on the right side of the guard;
                  the splash overlay covers the wait. */}
              {!isPending && (
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
              )}
              <Toaster theme={appConfig.extra.colorScheme} toastOptions={TOAST_OPTIONS} />
              <KickoffRibbon />
            </ThemeProvider>
          </TRPCProvider>
        </QueryClientProvider>
        <BrandSplash ready={!isPending && fontsLoaded} onGone={() => setSplashGone(true)} />
      </KeyboardProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
})
