import { pluginValue } from '@app/native-example'
import { Text } from 'react-native'

// The shared-package half of the native demo (packages/native-example: Swift
// module + config plugin). `bun run init --mobile` deletes this file and its
// one use on Home unless --native-example.
export function NativeExampleRow() {
  return (
    <Text className="text-xs text-muted-foreground">
      @app/native-example: {pluginValue() ?? 'not in this build (rebuild the dev client)'}
    </Text>
  )
}
