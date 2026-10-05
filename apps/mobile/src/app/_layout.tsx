import '../../global.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useEffect } from 'react'
import { useColorScheme } from 'react-native'
import { authClient } from '~/lib/auth-client'
import { startOta } from '~/lib/ota'
import { wireReactQueryToNative } from '~/lib/query-rn'
import { queryClient, trpcClient, TRPCProvider } from '~/lib/trpc'

// Layouts hold providers and the session guard only; screens live in src/screens.
void SplashScreen.preventAutoHideAsync()
wireReactQueryToNative()

// Root view background behind every screen, matching tokens.css --background.
const BACKGROUND = { light: '#ffffff', dark: '#0a0a0a' }

export default function RootLayout() {
  const { data: session, isPending } = authClient.useSession()
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'

  // A published update installs and reloads at once (lib/ota.ts).
  useEffect(() => startOta(), [])

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(BACKGROUND[scheme])
  }, [scheme])

  // Hold the splash until the cached session (SecureStore) resolves, so the
  // first frame is already on the right side of the auth guard.
  useEffect(() => {
    if (!isPending) void SplashScreen.hideAsync()
  }, [isPending])

  if (isPending) return null

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={session !== null}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={session === null}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      </TRPCProvider>
    </QueryClientProvider>
  )
}
