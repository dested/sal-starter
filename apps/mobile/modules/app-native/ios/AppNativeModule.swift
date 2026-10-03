import ExpoModulesCore

// App-only native glue lives in apps/mobile/modules/<name>/ (Expo autolinking
// finds it via expo-module.config.json). This one proves the path end to end.
public class AppNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppNative")

    Function("nativeHello") {
      return "Hello from Swift"
    }
  }
}
