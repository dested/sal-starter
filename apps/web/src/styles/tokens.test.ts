import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

// tokens.css repeats the dark palette for native (NativeWind can't read the
// web's `.dark` class). This keeps the two copies from drifting apart.
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

function declarations(block: string): Map<string, string> {
  const vars = new Map<string, string>()
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match
    if (name !== undefined && value !== undefined) vars.set(name, value.trim())
  }
  return vars
}

function blockAfter(marker: string): string {
  const start = css.indexOf(marker)
  if (start === -1) throw new Error(`tokens.css has no "${marker}" block`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

describe('tokens.css', () => {
  test('native dark palette matches .dark', () => {
    const web = declarations(blockAfter('\n.dark {'))
    const native = declarations(blockAfter('@media native and (prefers-color-scheme: dark)'))
    expect(web.size).toBeGreaterThan(0)
    expect(Object.fromEntries(native)).toEqual(Object.fromEntries(web))
  })
})
