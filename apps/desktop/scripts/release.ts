// `bun run release`: an unpacked build for this machine (no installer, no
// auto-update). electron-vite has already built ./out; this packages it into
// <repo>/release/win-unpacked (gitignored). Identity comes from project.json.

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { build, Platform } from 'electron-builder'
import { z } from 'zod'

const repoRoot = join(import.meta.dirname, '..', '..', '..')
const project = z
  .object({ name: z.string(), displayName: z.string(), appId: z.string() })
  .parse(JSON.parse(readFileSync(join(repoRoot, 'project.json'), 'utf8')))

// electron-builder can't resolve `catalog:`; hand it the installed version.
const electronPkg = createRequire(import.meta.url).resolve('electron/package.json')
const { version: electronVersion } = z
  .object({ version: z.string() })
  .parse(JSON.parse(readFileSync(electronPkg, 'utf8')))

await build({
  targets: Platform.current().createTarget('dir'),
  config: {
    appId: project.appId,
    electronVersion,
    productName: project.displayName,
    executableName: project.name,
    directories: { output: join(repoRoot, 'release') },
    // Everything is bundled into out/ by electron-vite; ship nothing else.
    files: ['out/**', 'package.json'],
    npmRebuild: false,
    asar: true,
    // Icon: drop build/icon.png (512x512) here and electron-builder picks it up.
  },
})
