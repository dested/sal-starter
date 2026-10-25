// demo: deleted by `bun run demo:drop`. In a fork this fails until then, so the
// template's Post demo can't ship unnoticed (the template itself keeps it).
import { describe, expect, test } from 'bun:test'
import project from '../../../project.json'

describe('template demo', () => {
  test('the Post demo is removed before shipping (run `bun run demo:drop`)', () => {
    expect(project.name).toBe('sal-starter')
  })
})
