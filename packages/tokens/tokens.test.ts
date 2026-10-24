import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { emitColors, missingRoles, rootDeclarations, themeCss, toHex, tokensCss } from './css'

const project = z
  .object({
    name: z.string(),
    look: z.object({ scheme: z.enum(['light', 'dark']), direction: z.string() }).nullable(),
  })
  .parse(JSON.parse(readFileSync(new URL('../../project.json', import.meta.url), 'utf8')))

describe('tokens.css', () => {
  test('gives a value to every role theme.css maps (add the missing ones to :root)', () => {
    expect(missingRoles()).toEqual([])
  })

  test('colors.json is current (run `bun run tokens` after editing tokens.css)', () => {
    const json: unknown = JSON.parse(
      readFileSync(new URL('./colors.json', import.meta.url), 'utf8')
    )
    expect(json).toEqual(emitColors())
  })

  test('one theme: no .dark block, no OS color-scheme query', () => {
    for (const css of [tokensCss, themeCss]) {
      expect(css).not.toMatch(/\.dark\s*\{/)
      expect(css).not.toContain('prefers-color-scheme')
    }
  })

  test('oklch converts to the hex shadcn ships', () => {
    expect(toHex('oklch(1 0 0)')).toBe('#ffffff')
    expect(toHex('oklch(0 0 0)')).toBe('#000000')
    expect(toHex('oklch(0.145 0 0)')).toBe('#0a0a0a')
    expect(toHex('oklch(1 0 0 / 10%)')).toBe('#ffffff1a')
    expect(toHex('#ABCDEF')).toBe('#abcdef')
  })
})

describe('kickoff', () => {
  // The template itself ships the neutral placeholder; every fork must replace it.
  test.skipIf(project.name === 'sal-starter')(
    'the look is set (run the kickoff skill: .claude/skills/kickoff/SKILL.md)',
    () => {
      expect(project.look).not.toBeNull()
    }
  )

  test('project.json look.scheme matches tokens.css color-scheme', () => {
    const scheme = rootDeclarations(tokensCss).get('color-scheme')
    expect(scheme).toBe(project.look?.scheme ?? 'light')
  })
})
