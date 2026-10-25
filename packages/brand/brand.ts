// The brand: one glyph (mark.svg) and the token roles that colour it
// (brand.json), composed into every icon and splash the apps ship. Pure: it
// plans each output as SVG and never rasterizes. Shared by emit.ts (`bun run
// brand` renders and writes the plan) and brand.test.ts (fails when it's stale).
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { colors } from '@app/tokens'
import { z } from 'zod'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
export const repoPath = (path: string) => new URL(`../../${path}`, import.meta.url)

export const markSvg = read('./mark.svg')
export const brandJson = read('./brand.json')
const projectJson = read('../../project.json')

/** A color role as tokens.css / theme.css name it (`primary-foreground`). */
const role = z.string().regex(/^[a-z]+(-[a-z]+)*$/, 'a theme.css color role, e.g. "primary"')

export const brandSchema = z.strictObject({
  // The app icon: a full-bleed square of `background` (iOS, Android and the
  // browsers mask it themselves) with the mark centred. markSize is the mark's
  // longer side as a fraction of the icon.
  icon: z.strictObject({ background: role, mark: role, markSize: z.number().min(0.3).max(0.7) }),
  // Launch: a solid `background` with the bare mark, markWidth points wide,
  // centred. Native (expo-splash-screen) and the JS hand-off (BrandSplash) draw
  // the same thing, so the switch is invisible.
  splash: z.strictObject({
    background: role,
    mark: role,
    markWidth: z.number().int().min(48).max(240),
  }),
})
export type BrandConfig = z.infer<typeof brandSchema>

export const config = brandSchema.parse(JSON.parse(brandJson))
const project = z.object({ displayName: z.string().min(1) }).parse(JSON.parse(projectJson))

const palette = new Map<string, string>(Object.entries(colors))
/** `primary-foreground` → its hex from @app/tokens colors.json. */
export function hex(name: string): string {
  const value = palette.get(name.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()))
  if (value === undefined) {
    throw new Error(
      `brand.json: "${name}" is not a color role (one of: ${[...palette.keys()].join(', ')})`
    )
  }
  return value
}

/** brand.json with every role resolved: what brand.gen.json records for code. */
export const resolved = {
  icon: { background: hex(config.icon.background), mark: hex(config.icon.mark) },
  splash: {
    background: hex(config.splash.background),
    mark: hex(config.splash.mark),
    markWidth: config.splash.markWidth,
  },
}

type Mark = { viewBox: [number, number, number, number]; inner: string }

/** mark.svg's viewBox and contents. The root's `fill` is replaced; style the paths themselves. */
export function parseMark(svg: string): Mark {
  const open = /<svg\b[^>]*>/.exec(svg)
  const close = svg.lastIndexOf('</svg>')
  if (open === null || close === -1) throw new Error('mark.svg: no <svg>…</svg>')
  const viewBox = /\bviewBox="([^"]+)"/
    .exec(open[0])?.[1]
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  const [x = NaN, y = NaN, w = NaN, h = NaN] = viewBox ?? []
  if (viewBox?.length !== 4 || ![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) {
    throw new Error(
      'mark.svg: the root needs a viewBox="x y width height" drawn tight to the glyph'
    )
  }
  const inner = svg.slice(open.index + open[0].length, close).trim()
  if (inner === '') throw new Error('mark.svg is empty')
  return { viewBox: [x, y, w, h], inner }
}

const mark = parseMark(markSvg)
const n = (v: number) => String(Math.round(v * 1000) / 1000)

/** The mark, its longer side `size`, centred on (cx, cy), every fill `color`. */
function placeMark(cx: number, cy: number, size: number, color: string): string {
  const [x, y, w, h] = mark.viewBox
  const scale = size / Math.max(w, h)
  const [width, height] = [w * scale, h * scale]
  const inner = mark.inner.replaceAll('currentColor', color)
  return `<svg x="${n(cx - width / 2)}" y="${n(cy - height / 2)}" width="${n(width)}" height="${n(height)}" viewBox="${x} ${y} ${w} ${h}" fill="${color}">${inner}</svg>`
}

type Canvas = {
  /** Fill behind the mark; omitted = transparent. */
  background?: string
  /** Corner radius as a fraction of the size (a tile); 0 = full bleed. */
  radius?: number
  /** The mark's longer side as a fraction of the size. */
  markSize: number
  mark: string
}

/** A square `size` px SVG: optional (rounded) background, the mark centred. */
export function canvas(size: number, c: Canvas): string {
  const bg =
    c.background === undefined
      ? ''
      : `<rect width="${size}" height="${size}" rx="${n(size * (c.radius ?? 0))}" fill="${c.background}"/>`
  const glyph = placeMark(size / 2, size / 2, size * c.markSize, c.mark)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg}${glyph}</svg>\n`
}

// Android's adaptive icon is a 108dp layer the launcher masks to its central
// 72dp, so the mark shrinks by 72/108 to read the same size as on iOS.
const ADAPTIVE_VISIBLE = 72 / 108
// Tiles (favicon, desktop): rounded corners, since nothing masks them.
const TILE_RADIUS = 0.22
// At 16–48 px the glyph needs more of the tile to stay legible.
const SMALL_MARK = 0.64

const iconSquare = (size: number) =>
  canvas(size, {
    background: resolved.icon.background,
    markSize: config.icon.markSize,
    mark: resolved.icon.mark,
  })
const tile = (size: number) =>
  canvas(size, {
    background: resolved.icon.background,
    radius: TILE_RADIUS,
    markSize: size <= 48 ? SMALL_MARK : config.icon.markSize,
    mark: resolved.icon.mark,
  })

export type Output =
  | { kind: 'png'; path: string; size: number; opaque: boolean; svg: string }
  | { kind: 'ico'; path: string; images: Array<{ size: number; svg: string }> }
  // `hashed: false` = checked by content in brand.test.ts instead: `bun run
  // init` rewrites the display name inside it.
  | { kind: 'text'; path: string; content: string; hashed: boolean }

export type Surface = 'web' | 'mobile' | 'desktop'
/** The app folders this repo still has (`init` can drop mobile, desktop or web). */
export const surfaces = (['web', 'mobile', 'desktop'] as const).filter((s) =>
  existsSync(repoPath(`apps/${s}`))
)

/** The web app manifest: installable name and colors. */
export function manifest(): string {
  const icon = (size: number, purpose: string) => ({
    src: `/icon-${size}.png`,
    sizes: `${size}x${size}`,
    type: 'image/png',
    purpose,
  })
  return (
    JSON.stringify(
      {
        name: project.displayName,
        short_name: project.displayName,
        start_url: '/',
        display: 'standalone',
        // theme_color = the page (vite.config.ts themeMeta); the launch screen = the splash.
        theme_color: colors.background,
        background_color: resolved.splash.background,
        icons: [icon(192, 'any'), icon(512, 'any'), icon(512, 'maskable')],
      },
      null,
      2
    ) + '\n'
  )
}

/** Every file `bun run brand` writes, for the surfaces present. */
export function plan(present: readonly Surface[] = surfaces): Output[] {
  const outputs: Output[] = []
  if (present.includes('mobile')) {
    const a = 'apps/mobile/assets'
    const adaptive = config.icon.markSize * ADAPTIVE_VISIBLE
    outputs.push(
      { kind: 'png', path: `${a}/icon.png`, size: 1024, opaque: true, svg: iconSquare(1024) },
      {
        kind: 'png',
        path: `${a}/splash-icon.png`,
        size: 1024,
        opaque: false,
        // The canvas is the image expo-splash-screen sizes to markWidth: the mark fills it.
        svg: canvas(1024, { markSize: 1, mark: resolved.splash.mark }),
      },
      {
        kind: 'png',
        path: `${a}/adaptive-icon.png`,
        size: 1024,
        opaque: false,
        svg: canvas(1024, { markSize: adaptive, mark: resolved.icon.mark }),
      },
      {
        kind: 'png',
        path: `${a}/adaptive-icon-monochrome.png`,
        size: 1024,
        opaque: false,
        // Android themes it from the alpha alone.
        svg: canvas(1024, { markSize: adaptive, mark: '#ffffff' }),
      }
    )
  }
  if (present.includes('web')) {
    const p = 'apps/web/public'
    outputs.push(
      { kind: 'text', path: `${p}/favicon.svg`, content: tile(32), hashed: true },
      {
        kind: 'png',
        path: `${p}/apple-touch-icon.png`,
        size: 180,
        opaque: true,
        svg: iconSquare(180),
      },
      { kind: 'png', path: `${p}/icon-192.png`, size: 192, opaque: true, svg: iconSquare(192) },
      { kind: 'png', path: `${p}/icon-512.png`, size: 512, opaque: true, svg: iconSquare(512) },
      { kind: 'text', path: `${p}/manifest.webmanifest`, content: manifest(), hashed: false }
    )
  }
  if (present.includes('desktop')) {
    const b = 'apps/desktop/build'
    outputs.push(
      { kind: 'png', path: `${b}/icon.png`, size: 512, opaque: false, svg: tile(512) },
      {
        kind: 'ico',
        path: `${b}/icon.ico`,
        images: [16, 32, 48, 256].map((size) => ({ size, svg: tile(size) })),
      }
    )
  }
  return outputs
}

/** What the outputs are made from. brand.gen.json records it; the test compares. */
export function inputHash(): string {
  const hash = createHash('sha256')
  for (const part of [
    markSvg,
    brandJson,
    JSON.stringify(resolved),
    colors.background,
    read('./brand.ts'),
    read('./png.ts'),
    read('./emit.ts'),
  ]) {
    hash.update(part).update('\0')
  }
  return hash.digest('hex')
}

export const sha256 = (bytes: Uint8Array | string) =>
  createHash('sha256').update(bytes).digest('hex')

export const genSchema = z.object({
  inputHash: z.string(),
  icon: z.object({ background: z.string(), mark: z.string() }),
  splash: z.object({ background: z.string(), mark: z.string(), markWidth: z.number() }),
  outputs: z.record(z.string(), z.string()),
})
