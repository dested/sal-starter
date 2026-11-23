// The runtimeVersion is this fingerprint, so the machine that builds a binary
// (EAS, the Mac, expo-wsl-ios, Limrun) and the one that runs `eas update` (WSL)
// must hash exactly the same inputs, or updates never reach the build
// ("Runtime version mismatch"). What keeps the hashes equal:
//   - SDK 58's `balanced` preset (the default, named here so it can't drift):
//     autolinked native modules and node_modules config plugins are hashed by
//     `name@version`, so per-machine churn inside node_modules (Gradle output,
//     Bun's .bun-tag-* markers, which plugin JS a process loaded) never reaches
//     the hash; app version bumps and eas.json / .easignore edits are ignored.
//   - No absolute path in the resolved app config. It is hashed as JSON, and
//     only paths under apps/mobile get relativized: a font, asset or plugin
//     option pointing into the repo-root node_modules or packages/ (say
//     `require.resolve(...)`) hashes /w/code/… on WSL and /Users/…/code/… on the
//     Mac. Pass `relative(__dirname, path)`. fingerprint.rule.test.ts runs
//     `expo-updates fingerprint:generate --debug` for every variant and platform
//     and fails on any absolute path in what it hashes.
//   - LF checkouts everywhere (.gitattributes): file sources are hashed by bytes.
//   - The same dependency versions everywhere: one bun.lock, eas.json `bun` =
//     the local Bun.
// Still hashed: in-repo native code (modules/*/ios, packages/*/ios), in-repo
// config plugins, the resolved app config, assets and package.json scripts. A
// prebuilt ios/ or android/ folder (gitignored) shows up as a source with a null
// hash and doesn't change it. Compare machines with `bun run fingerprint
// --variant production` on each, or `eas fingerprint:compare`.
/** @type {import('expo/fingerprint').Config} */
module.exports = {
  preset: 'balanced',
}
