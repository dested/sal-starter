import { NativeModule, requireOptionalNativeModule } from 'expo'

declare class NativeExampleModule extends NativeModule {
  pluginValue(): string | null
}

const native = requireOptionalNativeModule<NativeExampleModule>('NativeExample')

// The Info.plist value the config plugin wrote; null when the dev client
// predates this package (rebuild on the Mac).
export function pluginValue(): string | null {
  return native === null ? null : native.pluginValue()
}
