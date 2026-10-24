// Reads the token CSS: the :root values (tokens.css), the color roles exposed
// to Tailwind (theme.css), and each role as hex. Shared by emit.ts (writes
// colors.json) and tokens.test.ts (fails when colors.json is stale).
import { readFileSync } from 'node:fs'

export const tokensCss = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
export const themeCss = readFileSync(new URL('./theme.css', import.meta.url), 'utf8')

/** `--name: value;` pairs inside the first `:root { … }` block. */
export function rootDeclarations(css: string): Map<string, string> {
  const start = css.indexOf(':root {')
  if (start === -1) throw new Error('tokens.css has no `:root {` block')
  const body = css.slice(start + ':root {'.length, css.indexOf('}', start))
  const vars = new Map<string, string>()
  for (const match of body.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match
    if (name !== undefined && value !== undefined) vars.set(name, value.trim())
  }
  return vars
}

/** Color roles from `@theme inline`: `--color-card-foreground: var(--card-foreground)` → `card-foreground`. */
export function colorRoles(css: string): string[] {
  const roles = [...css.matchAll(/--color-([\w-]+)\s*:\s*var\(--([\w-]+)\)/g)].flatMap(
    ([, role, source]) => (role !== undefined && role === source ? [role] : [])
  )
  if (roles.length === 0) throw new Error('theme.css maps no `--color-<role>: var(--<role>)` roles')
  return roles
}

/** Roles theme.css maps that tokens.css gives no value. */
export function missingRoles(theme = themeCss, tokens = tokensCss): string[] {
  const root = rootDeclarations(tokens)
  return colorRoles(theme).filter((role) => !root.has(`--${role}`))
}

/** `card-foreground` → `cardForeground`. */
export function camel(name: string): string {
  return name.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())
}

/** Every color role resolved to hex, keyed in camelCase (the colors.json shape). */
export function emitColors(theme = themeCss, tokens = tokensCss): Record<string, string> {
  const root = rootDeclarations(tokens)
  const out: Record<string, string> = {}
  for (const role of colorRoles(theme)) {
    const value = root.get(`--${role}`)
    if (value === undefined) throw new Error(`tokens.css has no --${role} (theme.css maps it)`)
    out[camel(role)] = toHex(value)
  }
  return out
}

const OKLCH = /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?)\s*)?\)$/
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

const unit = (raw: string, percentScale: number) =>
  raw.endsWith('%') ? (Number(raw.slice(0, -1)) / 100) * percentScale : Number(raw)

/** `oklch(L C H [/ A])` or `#hex` → `#rrggbb` (or `#rrggbbaa` when not opaque). */
export function toHex(value: string): string {
  if (HEX.test(value)) return value.toLowerCase()
  const m = OKLCH.exec(value)
  if (m === null) throw new Error(`tokens.css: "${value}" is not oklch(L C H [/ A]) or #hex`)
  const [, rawL = '0', rawC = '0', rawH = '0', rawA] = m
  const L = unit(rawL, 1)
  const C = unit(rawC, 0.4)
  const h = (Number(rawH) * Math.PI) / 180
  const alpha = rawA === undefined ? 1 : unit(rawA, 1)

  // OKLCH → OKLab → LMS → linear sRGB (Björn Ottosson's matrices).
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ]
  const byte = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255)
  const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)
  const channels = linear.map((x) => byte(gamma(x)))
  if (alpha < 1) channels.push(byte(alpha))
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}
