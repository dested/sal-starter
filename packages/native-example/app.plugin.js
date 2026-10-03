// Expo resolves `@app/native-example` in app.config.ts plugins to this file.
// Plugins run in Node at prebuild time, so they ship as committed CommonJS
// (plugin/build, compiled from plugin/src by `bun run build:plugin`).
module.exports = require('./plugin/build/index.js').default
