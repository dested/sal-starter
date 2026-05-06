// Prisma 7 moved the connection URL out of `schema.prisma`. The CLI tooling
// (db push, migrate, studio) reads it from here. The runtime `PrismaClient`
// gets it via the pg driver adapter in `src/db/index.ts`.
//
// Bun loads `.env` automatically when running `bunx prisma ...`, so no
// `dotenv` import is needed.
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
})
