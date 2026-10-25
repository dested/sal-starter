// The one Anthropic boundary: nothing else imports @anthropic-ai/sdk.
//
// generate() makes one structured call: system parts (stable first; `cache:
// true` puts a prompt-cache breakpoint after a part), a prompt, and a zod
// schema the answer must match. The schema goes to the API as the output
// format and the answer is parsed again with the full zod schema (the API's
// grammar drops constraints such as lengths and patterns); one retry feeds the
// issues back. Every call logs its tokens and cost.
//
// AI_FAKE=1 (tests, e2e, a fork without a key yet) never calls the API: each
// call returns its own `fake`, parsed with the same schema.
//
// The client is created on first use, so the server boots without
// ANTHROPIC_API_KEY; a call without it throws MissingEnvError (env.ts).

import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { env, hasEnv, requireEnv } from '../env'
import { log } from '../logger'

export const MODELS = {
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
  haiku: 'claude-haiku-5-5',
} as const
export type Model = (typeof MODELS)[keyof typeof MODELS]
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/** The default model for a call that doesn't pick one. */
export const DEFAULT_MODEL: Model = MODELS.opus

// $ per million tokens. Cache writes are the 5-minute TTL (1.25× input).
const PRICES: Record<Model, { input: number; output: number; cacheRead: number }> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01 },
}

export type Usage = { input: number; output: number; cacheWrite: number; cacheRead: number }
const NO_USAGE: Usage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }

/** What `usage` cost, in dollars; null for a model with no price row (a fallback model). */
export function costUsd(model: string, usage: Usage): number | null {
  const price = Object.entries(PRICES).find(([id]) => id === model)?.[1]
  if (!price) return null
  return (
    (usage.input * price.input +
      usage.cacheWrite * price.input * 1.25 +
      usage.cacheRead * price.cacheRead +
      usage.output * price.output) /
    1_000_000
  )
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: 'refusal' | 'truncated' | 'invalid' | 'api'
  ) {
    super(message)
    this.name = 'AiError'
  }
}

/** A system part; `cache: true` adds a breakpoint after it (at most 4, stable content first). */
export type SystemPart = { text: string; cache?: boolean }

export type GenerateCall<S extends z.ZodType> = {
  /** Names the call in logs */
  label: string
  system: SystemPart[]
  prompt: string
  schema: S
  /** What AI_FAKE=1 returns instead of calling the API */
  fake: () => z.input<S>
  model?: Model
  /** Thinking depth and spend. Opus 5.5 defaults to medium */
  effort?: Effort
  maxTokens?: number
  signal?: AbortSignal
}

export type GenerateResult<T> = {
  data: T
  /** The model that answered (a refusal fallback can differ from the one asked for) */
  model: string
  usage: Usage
  costUsd: number | null
}

/** Whether calls do something: a key is set, or AI_FAKE is on. */
export function aiEnabled(): boolean {
  return env.AI_FAKE || hasEnv('ANTHROPIC_API_KEY')
}

let client: Anthropic | undefined
function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY'), maxRetries: 2 })
  return client
}

function systemBlocks(parts: SystemPart[]): Anthropic.Beta.BetaTextBlockParam[] {
  const breakpoints = parts.filter((p) => p.cache).length
  if (breakpoints > 4) throw new Error(`${breakpoints} cache breakpoints; the API allows 4`)
  return parts.map((p) =>
    p.cache
      ? { type: 'text', text: p.text, cache_control: { type: 'ephemeral' } }
      : { type: 'text', text: p.text }
  )
}

function addUsage(total: Usage, u: Anthropic.Beta.BetaUsage): Usage {
  return {
    input: total.input + u.input_tokens,
    output: total.output + u.output_tokens,
    cacheWrite: total.cacheWrite + (u.cache_creation_input_tokens ?? 0),
    cacheRead: total.cacheRead + (u.cache_read_input_tokens ?? 0),
  }
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    const value: unknown = JSON.parse(text)
    return { ok: true, value }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

function logCall(label: string, model: string, usage: Usage, started: number, note = 'ok') {
  const cost = costUsd(model, usage)
  log.info(
    `[ai] ${label} ${note} · ${model} · ${((Date.now() - started) / 1000).toFixed(1)}s · in ${usage.input} · cache w ${usage.cacheWrite} r ${usage.cacheRead} · out ${usage.output} · ${cost === null ? 'cost ?' : `$${cost.toFixed(4)}`}`
  )
}

export async function generate<S extends z.ZodType>(
  call: GenerateCall<S>
): Promise<GenerateResult<z.output<S>>> {
  if (env.AI_FAKE) {
    return { data: call.schema.parse(call.fake()), model: 'fake', usage: NO_USAGE, costUsd: 0 }
  }
  const model = call.model ?? DEFAULT_MODEL
  const started = Date.now()
  let usage = NO_USAGE
  let answeredBy: string = model
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: call.prompt }]

  for (let attempt = 1; attempt <= 2; attempt++) {
    let message: Anthropic.Beta.BetaMessage
    try {
      // Streaming keeps a long answer clear of HTTP timeouts. `fallbacks:
      // 'default'` re-runs a refused request on a model the API picks.
      message = await anthropic()
        .beta.messages.stream(
          {
            model,
            max_tokens: call.maxTokens ?? 32_000,
            system: systemBlocks(call.system),
            messages,
            output_config: {
              format: zodOutputFormat(call.schema),
              ...(call.effort ? { effort: call.effort } : {}),
            },
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
          },
          { signal: call.signal }
        )
        .finalMessage()
    } catch (e) {
      logCall(call.label, answeredBy, usage, started, 'failed')
      if (e instanceof Anthropic.APIError) {
        throw new AiError(`${call.label}: Anthropic API ${e.status ?? ''} ${e.message}`, 'api')
      }
      throw e
    }
    usage = addUsage(usage, message.usage)
    answeredBy = message.model

    if (message.stop_reason === 'refusal') {
      logCall(call.label, answeredBy, usage, started, 'refused')
      const category = message.stop_details?.category ?? 'unspecified'
      throw new AiError(`${call.label}: the model declined (${category})`, 'refusal')
    }
    if (message.stop_reason === 'max_tokens') {
      logCall(call.label, answeredBy, usage, started, 'truncated')
      throw new AiError(`${call.label}: the answer ran past max_tokens`, 'truncated')
    }
    const text = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    const json = parseJson(text)
    const parsed = json.ok ? call.schema.safeParse(json.value) : null
    if (parsed?.success) {
      logCall(call.label, answeredBy, usage, started)
      return { data: parsed.data, model: answeredBy, usage, costUsd: costUsd(answeredBy, usage) }
    }
    const problems = parsed ? z.prettifyError(parsed.error) : json.ok ? '' : json.error
    log.warn(`[ai] ${call.label} attempt ${attempt} failed validation:\n${problems}`)
    // Append-only retry: the answer, then what was wrong with it.
    messages.push(
      { role: 'assistant', content: message.content },
      {
        role: 'user',
        content: `That answer failed validation:\n${problems}\nReturn the whole corrected answer.`,
      }
    )
  }
  logCall(call.label, answeredBy, usage, started, 'invalid')
  throw new AiError(`${call.label}: the answer failed validation twice`, 'invalid')
}
