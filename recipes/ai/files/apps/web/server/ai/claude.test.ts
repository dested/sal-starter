import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { env } from '../env'
import { costUsd, generate } from './claude'

// The parsed env is a plain object; flip the switch for this file.
env.AI_FAKE = true

describe('generate under AI_FAKE', () => {
  const schema = z.object({ title: z.string().min(1), tags: z.array(z.string()).max(3) })

  test('returns the call’s fake, parsed with its schema, without calling the API', async () => {
    const result = await generate({
      label: 'test.title',
      system: [{ text: 'You title things.', cache: true }],
      prompt: 'Title this.',
      schema,
      fake: () => ({ title: 'A title', tags: ['x'] }),
    })
    expect(result).toEqual({
      data: { title: 'A title', tags: ['x'] },
      model: 'fake',
      usage: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      costUsd: 0,
    })
  })

  test('a fake that breaks the schema throws, so fakes stay honest', async () => {
    const call = generate({
      label: 'test.bad',
      system: [],
      prompt: '',
      schema,
      fake: () => ({ title: '', tags: [] }),
    })
    await expect(call).rejects.toThrow()
  })
})

describe('costUsd', () => {
  test('prices input, cache writes (1.25×), cache reads and output per million', () => {
    const usage = {
      input: 1_000_000,
      output: 1_000_000,
      cacheWrite: 1_000_000,
      cacheRead: 1_000_000,
    }
    expect(costUsd('claude-opus-5-5', usage)).toBeCloseTo(4 + 5 + 0.2 + 20)
    expect(costUsd('claude-haiku-5-5', usage)).toBeCloseTo(0.1 + 0.125 + 0.01 + 0.5)
  })
  test('an unpriced model is null, not zero', () => {
    expect(
      costUsd('claude-unknown', { input: 1, output: 1, cacheWrite: 0, cacheRead: 0 })
    ).toBeNull()
  })
})
