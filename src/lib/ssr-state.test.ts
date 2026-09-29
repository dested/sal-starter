import { describe, expect, test } from 'bun:test'
import { dehydrate, hydrate, QueryClient } from '@tanstack/react-query'
import type { SuperJSONResult } from 'superjson'
import { deserializeSsrState, isSuperJSONResult, serializeSsrState } from './ssr-state'

// What the browser does with `window.__SSR_STATE__ = <expr>`: evaluate the
// inline expression. It is a JSON literal, so JSON.parse is equivalent.
function evaluateInlineExpression(expr: string): SuperJSONResult {
  const value: unknown = JSON.parse(expr)
  if (!isSuperJSONResult(value)) throw new Error('not a superjson payload')
  return value
}

describe('SSR state round-trip', () => {
  test('a Date in prefetched data is still a Date after hydration', () => {
    const createdAt = new Date('2026-09-29T12:34:56.000Z')
    const server = new QueryClient()
    server.setQueryData(['posts'], [{ id: 'p1', createdAt }])

    const expr = serializeSsrState({ dehydratedState: dehydrate(server) })
    const state = deserializeSsrState(evaluateInlineExpression(expr))
    expect(state).not.toBeNull()

    const client = new QueryClient()
    hydrate(client, state)
    const [post] = client.getQueryData<Array<{ id: string; createdAt: Date }>>(['posts']) ?? []
    expect(post?.createdAt).toBeInstanceOf(Date)
    expect(post?.createdAt.getTime()).toBe(createdAt.getTime())
  })

  test('escapes `<` so data cannot close the inline <script>', () => {
    const server = new QueryClient()
    server.setQueryData<string>(['x'], '</script><script>alert(1)</script>')
    const expr = serializeSsrState({ dehydratedState: dehydrate(server) })
    expect(expr).not.toContain('<')
    const client = new QueryClient()
    hydrate(client, deserializeSsrState(evaluateInlineExpression(expr)))
    expect(client.getQueryData<string>(['x'])).toBe('</script><script>alert(1)</script>')
  })

  test('missing payload hydrates nothing', () => {
    expect(deserializeSsrState(undefined)).toBeNull()
  })
})
