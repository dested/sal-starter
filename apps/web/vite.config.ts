import { existsSync, readFileSync } from 'node:fs'
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
const project = z
  .object({
    name: z.string(),
    look: z.object({ scheme: z.enum(['light', 'dark']) }).nullable(),
  })
  .parse(JSON.parse(readFileSync(new URL('../../project.json', import.meta.url), 'utf8')))
const look = project.look

// The template's Post demo never ships: a fork's production build fails while
// it's present (scripts/demo.ts; the template itself keeps it as reference).
function noTemplateDemo(): Plugin {
  return {
    name: 'no-template-demo',
    apply: 'build',
    buildStart() {
      if (project.name === 'sal-starter') return
      if (!existsSync(new URL('./server/demo.ts', import.meta.url))) return
      this.error(
        'The template Post demo is still here and must not ship. Run `bun run demo:drop` (deletes it and writes the drop migration).'
      )
    },
  }
}

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
  plugins: [
    tailwindcss(),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
    themeMeta(),
    noTemplateDemo(),
  ],
})
