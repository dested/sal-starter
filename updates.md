# sal-starter — Updates

> Terse, newest-first log: what was asked → what was done. One entry per finished task.

## 2026-09-29 — template hardening (port, types, superjson, zod 4, migrations)
Ask: harden the template before the Frozen Ropes rebuild and future projects start from it.
Done: dev port = `PORT` (default 4780, init picks one per project, bans 3000 & co.); `noUncheckedIndexedAccess` + typecheck covers e2e/scripts/configs, all `as` casts removed; superjson on tRPC + SSR state with a unit and e2e proof that Dates survive hydration; zod 4; `prisma migrate` (initial migration, `db:migrate`/`db:migrate:create`/`db:deploy`, Render + e2e run `migrate deploy`, raw-SQL guide). Verified: typecheck, `bun run test` 3/3, build, e2e 4/4 on a throwaway local Postgres.
Touched: server.ts, server/{env,trpc,router,prisma}.ts, src/{index,entry-server}.tsx, src/lib/{trpc.tsx,ssr-state.ts,ssr-state.test.ts}, src/app/{routes,dashboard,home,layout}.tsx, e2e/*, playwright.config.ts, prisma.config.ts, prisma/migrations/, scripts/init.ts, render.yaml, tsconfig.json, package.json, .env.example, docs

## 2026-09-11 — kill the unstyled flash on load + other load-time jank
Ask: fix the FOUC every load; find similar jank; make it incredible.
Done: stylesheet moved to a head `<link>` (FOUC gone in dev); flash-free dark mode with nav toggle + `color-scheme` + synced `theme-color`; `<ScrollRestoration />`; client-nav tRPC prefetch via `getBrowserClients()`; HMR websocket shares the Express server (fixed-port collision between clones); immutable `Cache-Control` for hashed assets. e2e screenshot baselines NOT regenerated (no DB creds in this session) — run `bun run test:e2e:update`.
Touched: index.html, server.ts, src/App.tsx, src/index.tsx, src/app/layout.tsx, src/app/routes.tsx, src/lib/trpc.tsx, src/lib/theme.ts, src/components/theme-toggle.tsx, src/styles/app.css, CLAUDE.md, MIGRATION.md, cliffnotes.md, ui.md, decisions.md
