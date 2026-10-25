// Expo configures monorepo resolution itself (SDK 52+). Never hand-write
// watchFolders / nodeModulesPaths here (CLAUDE.md rule #21). Uniwind compiles
// global.css (Tailwind + @app/tokens) into native styles at bundle time.
const { getDefaultConfig } = require('expo/metro-config')
const { withUniwindConfig } = require('uniwind/metro')

module.exports = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
})
