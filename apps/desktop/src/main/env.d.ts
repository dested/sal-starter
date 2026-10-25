/** Absolute `<repo>/data/.private/electron`, baked in by electron.vite.config.ts. */
declare const __DATA_DIR__: string

/** `import x from './file?asset'`: electron-vite copies the file into out/ and resolves its absolute path. */
declare module '*?asset' {
  const path: string
  export default path
}
