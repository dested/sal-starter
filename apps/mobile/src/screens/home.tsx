import { Text, View } from 'react-native'
import { nativeHello } from '../../modules/app-native'
import { PostsDemo } from '~/components/demo/posts-demo' // demo
import { NativeExampleRow } from '~/components/native-example-row'
import { Screen } from '~/components/screen'
import { Button } from '~/components/ui/button'
import { authClient } from '~/lib/auth-client'
import { buildFingerprint } from '~/lib/build-fingerprint'

// Mirrors web's /dashboard: the signed-in page, sign-out and the native examples.
export function HomeScreen() {
  const { data: session } = authClient.useSession()

  if (!session) return null

  return (
    <Screen edges={['top', 'left', 'right']} className="gap-8">
      <View className="flex-row items-center justify-between gap-4">
        <Text className="flex-1 font-display text-3xl font-bold tracking-tight text-foreground">
          {session.user.name}
        </Text>
        <Button
          variant="outline"
          size="sm"
          label="Sign out"
          onPress={() => void authClient.signOut()}
        />
      </View>
      {/* demo:start */}
      <PostsDemo />
      {/* demo:end */}
      <NativeExamples />
    </Screen>
  )
}

// Proves both native hosting modes. In dev it also shows the binary's
// fingerprint: compare it with `bun run fingerprint` to know when the dev client
// needs a rebuild (Limrun or expo-wsl-ios) (CLAUDE.md rule #20).
function NativeExamples() {
  const hello = nativeHello()
  return (
    <View className="gap-1 pb-6">
      <Text className="text-xs text-muted-foreground">
        modules/app-native: {hello ?? 'not in this build (rebuild the dev client)'}
      </Text>
      <NativeExampleRow />
      {__DEV__ && (
        <Text className="text-xs text-muted-foreground">
          fingerprint: {buildFingerprint() ?? 'unknown (not in this build)'}
        </Text>
      )}
    </View>
  )
}
