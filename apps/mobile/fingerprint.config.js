// The runtimeVersion is this fingerprint, so a local `eas update` must hash
// exactly what the EAS builder hashes, or updates never reach the build
// ("Runtime version mismatch"). SDK 58's `balanced` preset (the default, named
// here so it can't drift) does what this file used to do by hand: autolinked
// native modules and node_modules config plugins are hashed by `name@version`,
// so per-machine churn inside node_modules (Gradle output, Bun's .bun-tag-*
// markers, which plugin JS a process happened to load) never reaches the hash,
// and app version bumps and eas.json / .easignore edits are ignored. Still
// hashed: in-repo native code (modules/*/ios, packages/*/ios), in-repo config
// plugins, the resolved app config and assets.
/** @type {import('expo/fingerprint').Config} */
module.exports = {
  preset: 'balanced',
}
