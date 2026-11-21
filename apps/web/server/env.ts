import { z } from 'zod'
import project from '../../../project.json'
import { emailList, optionalSecret, requireValue } from './env-schema'

// The pieces that don't read process.env live in env-schema.ts (the rules
// tests import them without an environment); re-exported for callers here.
export { emailList, MissingEnvError, optionalSecret, requireValue } from './env-schema'

// Dev port: a distinct, uncommon number per project so clones never collide.
// Never 3000/3001/5173/5174/8000/8080/4200/5000. `bun run init` writes it to
// the repo-root `project.json` (the one identity file).
export const DEFAULT_PORT = project.apiPort

// Third-party keys and switches: optional at boot, so a deploy never fails
// before a key is set in Drydock → Environment. Read a key with requireEnv('X')
// where it's used; that throws a MissingEnvError naming it. `add:*` recipes
// add theirs here.
const optionalKeys = {
  // EXAMPLE_API_KEY: optionalSecret,
}

const schema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, { error: 'BETTER_AUTH_SECRET must be at least 32 chars' }),
    BETTER_AUTH_URL: z.url().optional(),
    /** Who may sign up: emails and `@domain` entries. Blank = anyone. Admins always may. */
    SIGNUP_ALLOWLIST: emailList,
    /** Emails whose sessions pass adminProcedure (ctx.isAdmin). */
    ADMIN_EMAILS: emailList,
    ...optionalKeys,
  })
  .transform((e) => ({ ...e, BETTER_AUTH_URL: e.BETTER_AUTH_URL ?? `http://localhost:${e.PORT}` }))

export const env = schema.parse(process.env)

type Env = typeof env

/** The keys declared optional (`string | undefined`): the ones requireEnv reads. */
export type OptionalEnvKey = {
  [K in keyof Env]-?: Env[K] extends string | undefined
    ? undefined extends Env[K]
      ? K
      : never
    : never
}[keyof Env]

/** Read an optional key at the point of use; throws MissingEnvError while it's unset. */
export function requireEnv(key: OptionalEnvKey): string {
  return requireValue(key, env[key])
}

/** Whether an optional key is set (feature flags, `AI: off` banners). */
export function hasEnv(key: OptionalEnvKey): boolean {
  return env[key] !== undefined
}
