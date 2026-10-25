import { addEnvExample, addEnvKey, insertAfterLine, type Recipe } from '../lib'

export default function ai(): Recipe {
  return {
    name: 'ai',
    summary:
      'server/ai/claude.ts: Anthropic client, AI_FAKE mode, zod structured output, caching, cost log',
    details: [
      'Adds apps/web/server/ai/claude.ts (+ claude.test.ts) and @anthropic-ai/sdk.',
      '  generate({ label, system, prompt, schema, fake }) → { data, model, usage, costUsd }',
      '  - the client is lazy: the server boots without ANTHROPIC_API_KEY (optional key in env.ts)',
      '  - AI_FAKE=1 returns each call’s `fake` (e2e runs with it on; no API calls, no key)',
      '  - zod schema → output_config.format, re-parsed with zod, one retry with the issues',
      '  - `cache: true` on a system part puts a prompt-cache breakpoint after it',
      '  - every call logs tokens and $ cost; refusals fall back server-side (fallbacks: default)',
      '  - default model claude-opus-5-5; MODELS has sonnet / haiku',
    ].join('\n'),
    files: [
      { from: 'apps/web/server/ai/claude.ts' },
      { from: 'apps/web/server/ai/claude.test.ts' },
    ],
    dependencies: [{ name: '@anthropic-ai/sdk', range: '^1.1.0' }],
    edits: [
      // Each insert lands right under the anchor, so the last listed reads first.
      addEnvKey(
        'AI_FAKE',
        'z.stringbool().default(false)',
        'AI_FAKE=1: generate() returns each call’s fake, never the API'
      ),
      addEnvKey(
        'ANTHROPIC_API_KEY',
        'optionalSecret',
        'server/ai/claude.ts; unset = AI calls throw MissingEnvError'
      ),
      addEnvExample(
        'ANTHROPIC_API_KEY',
        '# Anthropic (bun run add:ai). Get one with `keys new anthropic --project <name>`.\nANTHROPIC_API_KEY=\n# AI_FAKE=1 answers every AI call with its fake (tests, e2e, no key).\n# AI_FAKE=1'
      ),
      insertAfterLine(
        'apps/web/playwright.config.ts',
        'e2e server runs AI_FAKE=1',
        "NODE_ENV: 'development',",
        "      AI_FAKE: '1',\n",
        'AI_FAKE:'
      ),
    ],
    next: [
      'Key: `keys new anthropic --project <name>` (lands in .env), then Drydock → Environment → ANTHROPIC_API_KEY.',
      'Use it: `const { data } = await generate({ label, system, prompt, schema, fake })` from server/ai/claude.ts.',
    ],
  }
}
