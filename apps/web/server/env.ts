import { z } from 'zod'
import project from '../../../project.json'

// Dev port: a distinct, uncommon number per project so clones never collide.
// Never 3000/3001/5173/5174/8000/8080/4200/5000. `bun run init` writes it to
// the repo-root `project.json` (the one identity file).
export const DEFAULT_PORT = project.apiPort

const schema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, { error: 'BETTER_AUTH_SECRET must be at least 32 chars' }),
    BETTER_AUTH_URL: z.url().optional(),
  })
  .transform((e) => ({ ...e, BETTER_AUTH_URL: e.BETTER_AUTH_URL ?? `http://localhost:${e.PORT}` }))

export const env = schema.parse(process.env)
