import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import {
  genSchema,
  inputHash,
  manifest,
  parseMark,
  plan,
  repoPath,
  resolved,
  sha256,
} from './brand'
import { readIco, readPngHeader } from './png'

const gen = genSchema.parse(
  JSON.parse(readFileSync(new URL('./brand.gen.json', import.meta.url), 'utf8'))
)
const outputs = plan()
const bytes = (path: string) => readFileSync(repoPath(path))

describe('brand', () => {
  test('brand.gen.json is current (run `bun run brand` after editing mark.svg, brand.json or the tokens)', () => {
    expect(gen.inputHash).toBe(inputHash())
    expect({ icon: gen.icon, splash: gen.splash }).toEqual(resolved)
  })

  // A hand-dropped icon.png fails here: edit mark.svg / brand.json, then `bun run brand`.
  test('every output exists and is the one `bun run brand` wrote', () => {
    for (const out of outputs) {
      expect(existsSync(repoPath(out.path)), `${out.path} is missing: run \`bun run brand\``).toBe(
        true
      )
      if (out.kind === 'text' && !out.hashed) continue
      expect(sha256(bytes(out.path)), `${out.path} differs from \`bun run brand\``).toBe(
        gen.outputs[out.path] ?? 'not in brand.gen.json: run `bun run brand`'
      )
    }
  })

  test('PNGs have the planned size; opaque ones have no alpha channel (Apple rejects it)', () => {
    for (const out of outputs) {
      if (out.kind !== 'png') continue
      const header = readPngHeader(bytes(out.path))
      expect({ path: out.path, ...header }).toEqual({
        path: out.path,
        width: out.size,
        height: out.size,
        colorType: out.opaque ? 2 : 6,
      })
    }
  })

  test('icon.ico holds every planned size', () => {
    for (const out of outputs) {
      if (out.kind !== 'ico') continue
      const entries = readIco(bytes(out.path)).map(({ size, png }) => [size, png.width, png.height])
      expect(entries).toEqual(out.images.map(({ size }) => [size, size, size]))
    }
  })

  test('manifest.webmanifest matches project.json and the brand colors', () => {
    const path = 'apps/web/public/manifest.webmanifest'
    if (!outputs.some((out) => out.path === path)) return
    expect(JSON.parse(bytes(path).toString('utf8'))).toEqual(JSON.parse(manifest()))
  })

  test('mark.svg parsing', () => {
    expect(parseMark('<svg viewBox="0 0 10 20"><path d="M0 0h1"/></svg>').viewBox).toEqual([
      0, 0, 10, 20,
    ])
    expect(() => parseMark('<svg><path/></svg>')).toThrow(/viewBox/)
    expect(() => parseMark('<svg viewBox="0 0 1 1"></svg>')).toThrow(/empty/)
  })
})
