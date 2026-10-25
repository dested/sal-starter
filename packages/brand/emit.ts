// `bun run brand` (root): renders mark.svg + brand.json into every icon and
// splash image (brand.ts plans them), then records what they were made from in
// brand.gen.json. Run it after editing either file or the tokens; brand.test.ts
// fails while the outputs are stale. Rasterized with @resvg/resvg-js: prebuilt
// binaries for every OS, no system libraries, and the same pixels on each run.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { inputHash, plan, repoPath, resolved, sha256, surfaces } from './brand'
import { encodeIco, encodeOpaquePng } from './png'

function render(svg: string, opaque: boolean): Buffer {
  const image = new Resvg(svg, { font: { loadSystemFonts: false } }).render()
  return opaque ? encodeOpaquePng(image.width, image.height, image.pixels) : image.asPng()
}

const outputs: Record<string, string> = {}
for (const out of plan()) {
  const bytes =
    out.kind === 'png'
      ? render(out.svg, out.opaque)
      : out.kind === 'ico'
        ? encodeIco(out.images.map(({ size, svg }) => ({ size, png: render(svg, false) })))
        : out.content
  const file = repoPath(out.path)
  mkdirSync(dirname(fileURLToPath(file)), { recursive: true })
  writeFileSync(file, bytes)
  if (out.kind !== 'text' || out.hashed) outputs[out.path] = sha256(bytes)
  console.log(`  ${out.path}`)
}

const gen = { inputHash: inputHash(), ...resolved, outputs }
const genFile = new URL('./brand.gen.json', import.meta.url)
writeFileSync(genFile, JSON.stringify(gen, null, 2) + '\n')
console.log(
  `${relative(process.cwd(), fileURLToPath(genFile))}: ${Object.keys(outputs).length} outputs for ${surfaces.join(' + ')}`
)
