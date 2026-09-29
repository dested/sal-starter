import { z } from 'zod'

// Dev port: a distinct, uncommon number per project so clones never collide.
// Never 3000/3001/5173/5174/8000/8080/4200/5000. `bun run init` rewrites 4780.
export const DEFAULT_PORT = 4780

const schema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 chars'),
    BETTER_AUTH_URL: z.string().url().optional(),
  })
  .transform((e) => ({ ...e, BETTER_AUTH_URL: e.BETTER_AUTH_URL ?? `http://localhost:${e.PORT}` }))

export const env = schema.parse(process.env)
