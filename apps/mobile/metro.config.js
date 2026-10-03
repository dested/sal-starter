// Expo configures monorepo resolution itself (SDK 52+). Never hand-write
// watchFolders / nodeModulesPaths here (CLAUDE.md rule #21).
const { getDefaultConfig } = require('expo/metro-config')
const { withNativewind } = require('nativewind/metro')

module.exports = withNativewind(getDefaultConfig(__dirname))
