import ExpoModulesCore

// A workspace package with native code: autolinked from apps/mobile's
// dependencies (no path config). It reads back the Info.plist key that its own
// config plugin (plugin/src/index.ts) wrote at prebuild time.
public class NativeExampleModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeExample")

    Function("pluginValue") { () -> String? in
      return Bundle.main.object(forInfoDictionaryKey: "SalNativeExample") as? String
    }
  }
}
