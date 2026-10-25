// The recipe engine behind `bun run add:<recipe>`. A recipe is files it copies
// into the fork (recipes/<name>/files/** → the same path in the repo), npm
// dependencies for apps/web, and anchored text edits to files the fork already
// has. Every step is idempotent: a file that exists is kept, a dependency that
// is declared is skipped, an edit whose result is already present is skipped.
// An edit whose anchor is gone (the fork rewrote that file) stops the run and
// prints the change to make by hand.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { c } from '../scripts/shell'

export type FileStep = {
  /** Path under recipes/<name>/files/ (or recipes/shared/ when `shared`) */
  from: string
  /** A file several recipes ship (recipes/shared/), copied by whichever runs first */
  shared?: boolean
  /** Repo-relative destination; defaults to `from` */
  to?: string
  /** True when the fork already has this (an equivalent file under another name) */
  present?: () => boolean
}

export type Dependency = { name: string; range: string; dev?: boolean }

export type EditStep = {
  /** Repo-relative file */
  file: string
  /** What the edit does, for the log */
  what: string
  /** The edit is already in place */
  done: (source: string) => boolean
  /** The edited source, or null when the anchor is missing */
  apply: (source: string) => string | null
  /** The change to make by hand when the anchor is missing */
  manual: string
}

export type Recipe = {
  name: string
  summary: string
  /** Printed by --help, below the summary */
  details: string
  files: FileStep[]
  dependencies: Dependency[]
  edits: EditStep[]
  /** Commands to run after files, deps and edits (e.g. db:generate) */
  after?: string[][]
  /** Printed when the recipe is done */
  next: string[]
}

export type Plan = {
  copies: { from: string; to: string }[]
  kept: string[]
  installs: Dependency[]
  edits: EditStep[]
  blocked: EditStep[]
}

const WEB_PACKAGE = 'apps/web/package.json'

function declared(name: string, root: string): boolean {
  const pkg: unknown = JSON.parse(readFileSync(join(root, WEB_PACKAGE), 'utf8'))
  if (typeof pkg !== 'object' || pkg === null) return false
  return ['dependencies', 'devDependencies'].some((field) => {
    const deps: unknown = Reflect.get(pkg, field)
    return typeof deps === 'object' && deps !== null && name in deps
  })
}

/** What applying `recipe` to the repo at `root` would do, without doing it. */
export function plan(recipe: Recipe, root: string, recipesDir: string): Plan {
  const copies: Plan['copies'] = []
  const kept: string[] = []
  for (const step of recipe.files) {
    const to = step.to ?? step.from
    if (existsSync(join(root, to)) || step.present?.()) kept.push(to)
    else {
      const base = step.shared ? join(recipesDir, 'shared') : join(recipesDir, recipe.name, 'files')
      copies.push({ from: join(base, step.from), to })
    }
  }
  const installs = recipe.dependencies.filter((d) => !declared(d.name, root))
  const edits: EditStep[] = []
  const blocked: EditStep[] = []
  for (const edit of recipe.edits) {
    const path = join(root, edit.file)
    if (!existsSync(path)) {
      blocked.push(edit)
      continue
    }
    const source = readFileSync(path, 'utf8')
    if (edit.done(source)) continue
    if (edit.apply(source) === null) blocked.push(edit)
    else edits.push(edit)
  }
  return { copies, kept, installs, edits, blocked }
}

/** Copies files and applies edits (dependencies and `after` are the caller's: they run commands). */
export function applyFiles(p: Plan, root: string): string[] {
  const touched: string[] = []
  for (const { from, to } of p.copies) {
    mkdirSync(dirname(join(root, to)), { recursive: true })
    writeFileSync(join(root, to), readFileSync(from))
    touched.push(to)
  }
  for (const edit of p.edits) {
    const path = join(root, edit.file)
    const next = edit.apply(readFileSync(path, 'utf8'))
    if (next === null)
      throw new Error(`${edit.file}: anchor vanished while applying "${edit.what}"`)
    writeFileSync(path, next)
    if (!touched.includes(edit.file)) touched.push(edit.file)
  }
  return touched
}

// ── Edit builders ──────────────────────────────────────────────────────────

/** Insert `text` right after the first line containing `anchor`. Done when `marker` is present. */
export function insertAfterLine(
  file: string,
  what: string,
  anchor: string,
  text: string,
  marker: string = text.trim()
): EditStep {
  return {
    file,
    what,
    done: (s) => s.includes(marker),
    apply: (s) => {
      const at = s.indexOf(anchor)
      if (at === -1) return null
      const eol = s.indexOf('\n', at)
      const cut = eol === -1 ? s.length : eol + 1
      return s.slice(0, cut) + text + s.slice(cut)
    },
    manual: `In ${file}, after the line containing \`${anchor.trim()}\`, add:\n${text}`,
  }
}

/** Add `name` to the named imports of `module` in `file`, or add the import line after the last import. */
export function addImport(file: string, module: string, names: string[]): EditStep {
  const line = `import { ${names.join(', ')} } from '${module}'\n`
  return {
    file,
    what: `import ${names.join(', ')} from ${module}`,
    done: (s) => {
      const existing = importOf(s, module)
      return existing !== null && names.every((n) => existing.names.includes(n))
    },
    apply: (s) => {
      const existing = importOf(s, module)
      if (existing) {
        const isType = (n: string) => n.startsWith('type ')
        const merged = [
          ...new Set([
            ...existing.names.filter((n) => !isType(n)),
            ...names,
            ...existing.names.filter(isType),
          ]),
        ]
        return s.replace(existing.text, `import { ${merged.join(', ')} } from '${module}'`)
      }
      const imports = [...s.matchAll(/^import [^\n]*\n/gm)]
      const last = imports.at(-1)
      if (!last || last.index === undefined) return line + s
      const cut = last.index + last[0].length
      return s.slice(0, cut) + line + s.slice(cut)
    },
    manual: `In ${file}, add: ${line}`,
  }
}

function importOf(source: string, module: string): { text: string; names: string[] } | null {
  const escaped = module.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  const match = new RegExp(`import \\{([^}]*)\\} from '${escaped}'`).exec(source)
  if (!match || match[1] === undefined) return null
  const names = match[1]
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n !== '')
  return { text: match[0], names }
}

/** Add a key to env.ts's `optionalKeys` block (the env helper's anchor). */
export function addEnvKey(key: string, schema: string, comment: string): EditStep {
  return insertAfterLine(
    'apps/web/server/env.ts',
    `env key ${key}`,
    'const optionalKeys = {',
    `  /** ${comment} */\n  ${key}: ${schema},\n`,
    `${key}:`
  )
}

/** Append lines to the root .env.example, once. */
export function addEnvExample(key: string, lines: string): EditStep {
  return {
    file: '.env.example',
    what: `.env.example ${key}`,
    done: (s) => new RegExp(`^#? ?${key}=`, 'm').test(s),
    apply: (s) => `${s.trimEnd()}\n\n${lines.trimEnd()}\n`,
    manual: `Append to .env.example:\n${lines}`,
  }
}

/** The newest migration folder name, so a recipe's migration sorts after it. */
export function migrationStamp(root: string, now: Date = new Date()): string {
  const dir = join(root, 'apps/web/prisma/migrations')
  const latest = existsSync(dir)
    ? readdirSync(dir)
        .filter((d) => /^\d{14}_/.test(d))
        .sort()
        .at(-1)
    : undefined
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  const latestStamp = latest?.slice(0, 14)
  if (latestStamp !== undefined && latestStamp >= stamp) return String(BigInt(latestStamp) + 1n)
  return stamp
}

/** Whether a migration whose folder ends in `_<name>` exists. */
export function hasMigration(root: string, name: string): boolean {
  const dir = join(root, 'apps/web/prisma/migrations')
  return existsSync(dir) && readdirSync(dir).some((d) => d.endsWith(`_${name}`))
}

export function describePlan(recipe: Recipe, p: Plan): string {
  const lines: string[] = []
  for (const { to } of p.copies) lines.push(`  ${c.green('add')}     ${to}`)
  for (const to of p.kept) lines.push(`  ${c.dim('keep')}    ${to} ${c.dim('(already there)')}`)
  for (const d of p.installs)
    lines.push(`  ${c.green('install')} ${d.name}@${d.range}${d.dev ? c.dim(' (dev)') : ''}`)
  for (const e of p.edits) lines.push(`  ${c.green('edit')}    ${e.file} ${c.dim(e.what)}`)
  for (const e of p.blocked) lines.push(`  ${c.red('blocked')} ${e.file} ${c.dim(e.what)}`)
  if (lines.length === 0)
    lines.push(`  ${c.dim(`nothing to do: ${recipe.name} is already applied`)}`)
  return lines.join('\n')
}
