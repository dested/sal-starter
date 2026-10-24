// The runtimeVersion is this fingerprint, so a local `eas update` must hash
// exactly what the EAS builder hashes, or updates never reach the build
// ("Runtime version mismatch"). What differs by machine, from the forks:
// - expoConfigPlugins lists the JS files *newly* loaded while the config is
//   evaluated, which depends on what the process already had cached (eas-cli on
//   the builder preloads babel/@expo/config-plugins; a local run does not).
// - native packages hashed as a whole dir pick up local Gradle output.
// - Bun's patch marker files (.bun-tag-*) are named per Bun version.
// Native code (ios/, android/ sources, podspecs) and the resolved app config
// are still hashed; plugin JS/JSON in node_modules is not. SDK 58's `balanced`
// preset does most of this itself: revisit then.
/** @type {import('expo/fingerprint').Config} */
module.exports = {
  ignorePaths: [
    '../../node_modules/**/*.js',
    '../../node_modules/**/*.cjs',
    '../../node_modules/**/*.mjs',
    '../../node_modules/**/*.json',
    '../../node_modules/**/.bun-tag-*',
    '**/.bun-tag-*',
    '../../node_modules/**/android/build/**/*',
    // Gradle's namespace fix-up rewrites library manifests in place on a local Android build
    '../../node_modules/**/android/src/main/AndroidManifest.xml',
    '../../node_modules/**/android/.cxx/**/*',
    '../../node_modules/**/android/.gradle/**/*',
  ],
}
