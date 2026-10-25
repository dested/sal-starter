import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import babel from '@rolldown/plugin-babel'
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// Node loads the config's workspace imports unbundled, so JSON needs the attribute.
import colors from '@app/tokens/colors.json' with { type: 'json' }
import { z } from 'zod'

// One theme (tokens.css). The browser chrome follows it: color-scheme from
// project.json look.scheme, theme-color from the generated token hex. Injected
// into index.html in dev (server.ts runs transformIndexHtml) and in the build.
const look = z
  .object({ look: z.object({ scheme: z.enum(['light', 'dark']) }).nullable() })
  .parse(JSON.parse(readFileSync(new URL('../../project.json', import.meta.url), 'utf8'))).look

function themeMeta(): Plugin {
  return {
    name: 'theme-meta',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { name: 'color-scheme', content: look?.scheme ?? 'light' },
        injectTo: 'head-prepend',
      },
      {
        tag: 'meta',
        attrs: { name: 'theme-color', content: colors.background },
        injectTo: 'head-prepend',
      },
    ],
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // React Compiler through Babel (the stable compiler, same as mobile's
  // babel-preset-expo); plugin-react's Rust `compiler` option is experimental.
  plugins: [tailwindcss(), viteReact(), babel({ presets: [reactCompilerPreset()] }), themeMeta()],
})
