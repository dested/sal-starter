import { describe, expect, test } from 'bun:test'
import { emitLaunch } from './launches'
import { appRouter } from './router'

const caller = appRouter.createCaller({})

describe('appRouter', () => {
  test('ping returns a Date', async () => {
    expect((await caller.ping()).at).toBeInstanceOf(Date)
  })

  test('echo reverses and validates', async () => {
    expect((await caller.echo({ text: 'abc' })).reversed).toBe('cba')
    expect(caller.echo({ text: 'x'.repeat(201) })).rejects.toThrow()
  })

  test('ticks stream until aborted', async () => {
    const ac = new AbortController()
    const seen: number[] = []
    for await (const tick of await appRouter
      .createCaller({}, { signal: ac.signal })
      .ticks({ everyMs: 50 })) {
      seen.push(tick.n)
      if (seen.length === 3) ac.abort()
    }
    expect(seen).toEqual([0, 1, 2])
  })

  test('launches forwards second-instance argv', async () => {
    const ac = new AbortController()
    const iterable = await appRouter.createCaller({}, { signal: ac.signal }).launches()
    const iterator = iterable[Symbol.asyncIterator]()
    const next = iterator.next()
    emitLaunch({ argv: ['app.exe', '.'], cwd: 'G:/code', at: new Date() })
    const first = await next
    expect(first.done).toBe(false)
    if (first.done !== true) expect(first.value.cwd).toBe('G:/code')
    ac.abort()
    await iterator.return?.()
  })
})
