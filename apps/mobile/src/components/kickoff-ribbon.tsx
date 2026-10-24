import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { appConfig } from '~/lib/app-config'

// Dev-only nag while project.json `look` is null: the starter's neutral
// placeholder is still on. Never renders in a release build or after the kickoff.
export function KickoffRibbon() {
  const { bottom } = useSafeAreaInsets()
  if (!__DEV__ || !appConfig.extra.kickoffPending) return null
  return (
    <View
      pointerEvents="none"
      className="absolute right-0 bottom-0 left-0 bg-warning px-6 pt-2"
      style={{ paddingBottom: bottom + 8 }}>
      <Text className="text-center text-sm font-medium text-warning-foreground">
        Kickoff pending: run the kickoff skill
      </Text>
    </View>
  )
}
