// electron-vite: three Vite builds (main, preload, renderer) from one config.
// Everything is bundled (all deps are devDependencies), so the packaged app
// ships no node_modules. The renderer dev server runs on project.json
// `desktopPort`; the CSP is strict in builds and relaxed in dev for Vite's
// inline React-refresh preamble and HMR socket.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import { z } from 'zod'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const project = z
  .object({ desktopPort: z.number().int() })
  .parse(JSON.parse(readFileSync(join(repoRoot, 'project.json'), 'utf8')))

const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
].join('; ')
const DEV_CSP = PROD_CSP.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'").replace(
  "connect-src 'self'",
  `connect-src 'self' ws://localhost:${project.desktopPort}`
)

function csp(): Plugin {
  return {
    name: 'desktop-csp',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) => html.replace('__CSP__', ctx.server ? DEV_CSP : PROD_CSP),
    },
  }
}

export default defineConfig({
  main: {
    // All app state lives in the repo (data/.private), dev and packaged alike.
    define: { __DATA_DIR__: JSON.stringify(join(repoRoot, 'data', '.private', 'electron')) },
    build: { externalizeDeps: false },
  },
  preload: {
    // Sandboxed preloads must be CommonJS.
    build: {
      externalizeDeps: false,
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } },
    },
  },
  renderer: {
    resolve: { alias: { '~': fileURLToPath(new URL('./src/renderer/src', import.meta.url)) } },
    server: { port: project.desktopPort, strictPort: true },
    plugins: [csp(), tailwindcss(), react()],
  },
})
