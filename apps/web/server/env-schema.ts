// The env helpers that never read process.env: schemas and the missing-key
// error. env.ts parses the real environment with them at import time; the
// rules tests import them from here, where nothing needs an environment.
import { z } from 'zod'

/** An optional key: unset and blank both mean "not configured". */
export const optionalSecret = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().optional()
)

/** A comma list ("a@x.com, @y.com"), trimmed and lowercased; blank is []. */
export const emailList = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e !== '')
  )

export class MissingEnvError extends Error {
  constructor(readonly key: string) {
    super(
      `${key} is not set. Add it in Drydock → Project → Environment (Apply + redeploy), or to the root .env in dev.`
    )
    this.name = 'MissingEnvError'
  }
}

/** `value`, or a MissingEnvError naming `key` when it's unset. */
export function requireValue(key: string, value: string | undefined): string {
  if (value === undefined) throw new MissingEnvError(key)
  return value
}
