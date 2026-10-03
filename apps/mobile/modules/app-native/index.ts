import { NativeModule, requireOptionalNativeModule } from 'expo'

declare class AppNativeModule extends NativeModule {
  nativeHello(): string
}

// Optional so a dev client built before this module existed renders a hint
// instead of crashing ("native module not found" means: rebuild on the Mac).
const native = requireOptionalNativeModule<AppNativeModule>('AppNative')

export function nativeHello(): string | null {
  return native === null ? null : native.nativeHello()
}
