import type { DehydratedState } from '@tanstack/react-query'
import superjson, { type SuperJSONResult } from 'superjson'

// The SSR → client handoff for the React Query cache. It rides through
// superjson (same as the tRPC wire) so Dates/Maps/Sets/BigInts in prefetched
// data are still Dates/Maps/Sets/BigInts after hydration — plain JSON.stringify
// would silently turn them into strings.

export type SsrState = { dehydratedState: DehydratedState }

declare global {
  interface Window {
    __SSR_STATE__?: SuperJSONResult
  }
}

// Server: a JS expression for `window.__SSR_STATE__ = …` in an inline script.
// `<` is escaped so a `</script>` inside data can't terminate the tag.
export function serializeSsrState(state: SsrState): string {
  return JSON.stringify(superjson.serialize(state)).replace(/</g, '\\u003c')
}

export function isSuperJSONResult(value: unknown): value is SuperJSONResult {
  return typeof value === 'object' && value !== null && 'json' in value
}

// Client: the payload the server embedded, back to a DehydratedState.
export function deserializeSsrState(payload: SuperJSONResult | undefined): DehydratedState | null {
  if (!payload) return null
  return superjson.deserialize<SsrState>(payload).dehydratedState
}
