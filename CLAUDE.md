# CLAUDE.md

Briefing for an LLM extending this codebase. Read this before changing files.

## What this is

A starter template (cloned, then mutated into a real product). Every file is intentionally minimal — keep it that way. When asked to add a feature, add the feature; do not also "improve" surrounding files.

## Stack

| layer             | choice                              | notes                                                                                                                                                              |
| ----------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| runtime / pkg mgr | Bun ≥ 1.3                           | both dev and prod                                                                                                                                                  |
| server            | Express 5 + Vite SSR                | `bun --watch server.ts`; vite middleware in dev, static `dist/client/` + SSR bundle in prod. **Express 5 is required** — routes use named wildcards (`*splat`).    |
| routing           | React Router 7 (`react-router-dom`) | `createBrowserRouter` on the client, `createStaticHandler` + `createStaticRouter` on the server                                                                    |
| db                | Postgres + Prisma ORM (v7)          | `@prisma/client` via the **`pg` driver adapter** (`@prisma/adapter-pg`), not the binary engine. Schema changes ship as **committed migrations** (`prisma migrate`) |
| auth              | better-auth                         | email + password only, autoSignIn on sign-up                                                                                                                       |
| api               | tRPC v11 + superjson                | `@trpc/tanstack-react-query` (`.queryOptions()` API), mounted as Express middleware at `/api/trpc`; superjson transformer, so `Date`s survive the wire and SSR     |
| validation        | zod 4                               | env, tRPC inputs, anything crossing a boundary                                                                                                                     |
| styles            | Tailwind v4 + shadcn (new-york)     | CSS-first config, oklch tokens                                                                                                                                     |
| tests             | Playwright e2e + `bun:test`         | `e2e/` + committed screenshot baselines against an isolated, migrated test DB; unit tests are `*.test.ts` under `src/` / `server/` (`bun run test`)                |
| deploy            | Render.com blueprint                | `runtime: node` + `BUN_VERSION` env var                                                                                                                            |

## Layout (load this mental model)

```
server.ts            Express server entry. Bun runs this in dev and prod.
server/
├── env.ts           zod-validated env at import time
├── logger.ts        color request logging, startup banner, error formatting
├── prisma.ts        PrismaClient singleton (survives HMR; pg adapter)
├── auth.ts          better-auth instance + Session type
├── trpc.ts          createContext + initTRPC + procedure builders
└── router.ts        appRouter (exports AppRouter type for the client)

src/
├── index.tsx              client entry (hydrateRoot + createBrowserRouter)
├── entry-server.tsx       SSR entry (createStaticHandler + renderToString)
├── App.tsx                top-level providers
├── app/
│   ├── routes.tsx         RouteObject[] tree (+ ErrorBoundary on root)
│   ├── layout.tsx         root layout (nav + <Outlet />)
│   ├── error-boundary.tsx 404 + error UI (root route ErrorBoundary)
│   ├── home.tsx           /
│   ├── sign-in.tsx        /sign-in
│   ├── sign-up.tsx        /sign-up
│   └── dashboard.tsx      /dashboard
├── components/
│   ├── theme-toggle.tsx   light/dark toggle button (nav)
│   └── ui/                shadcn primitives
├── lib/
│   ├── auth-client.ts     better-auth React client (signIn, signUp, useSession, signOut)
│   ├── theme.ts           theme state: applyTheme/setTheme/toggleTheme/followSystemTheme
│   ├── ssr-state.ts       superjson (de)serialization of the dehydrated React Query cache (SSR → client)
│   ├── trpc.tsx           TRPCProvider, useTRPC, getBrowserClients() (browser QueryClient + tRPC singletons)
│   └── utils.ts           cn() helper
└── styles/app.css         Tailwind v4 import + shadcn tokens (light on :root, dark on .dark)

public/                favicon.svg + robots.txt (served statically by vite/express)
e2e/                   Playwright specs + committed __screenshots__ baselines; db.ts = the isolated test DB URL
scripts/init.ts        clone→rename initializer (`bun run init <name>`)
index.html             Vite entry HTML: stylesheet <link>, pre-paint theme script, `<!--app-html-->`/`<!--app-state-->` placeholders
prisma/schema.prisma   DB schema (User/Session/Account/Verification/Post)
prisma/migrations/     committed migrations — the only way schema reaches a database (Hard rule #15)
prisma.config.ts       Prisma 7 CLI config — loads .env itself (see Hard rule #12)
```

## Hard rules

1. **Path alias is `~/*` → `src/*`** (client only). Defined in both `tsconfig.json` and `vite.config.ts` (`resolve.alias`). Server code under `./server/` uses relative imports.

2. **Server-only modules: anything under `./server/`.** These import secrets, the Prisma client, or Node-only deps. **Never import them from a `.tsx` file under `src/`** — that file ends up in the client bundle. The one exception is **type-only** imports: `src/lib/trpc.tsx` does `import type { AppRouter } from '../../server/router'`, which is erased at build time. Anything else from `./server/` is server-only.

3. **There is no file-based routing.** Routes are explicit `RouteObject[]` entries in `src/app/routes.tsx`. Add a new route by creating a component file in `src/app/<name>.tsx` and adding `{ path: '<name>', Component: <Component> }` to the tree.

4. **Server entry vs client entry.** `src/entry-server.tsx` runs under `vite.ssrLoadModule` in dev and as a built bundle under `./dist/server/entry-server.js` in prod — it exports `render(req)`. `src/index.tsx` runs in the browser and is loaded via `<script type="module" src="/src/index.tsx">` in `index.html`. Both wrap the app with `<App>` so providers (QueryClient, TRPC) are the same on both sides.

5. **API routes are Express mounts in `server.ts`** — not file-based:
   - `app.all('/api/auth/*splat', toNodeHandler(auth))` — better-auth (Express 5 named-wildcard syntax)
   - `app.use('/api/trpc', createExpressMiddleware({ router: appRouter, createContext }))` — tRPC
     If you add a new HTTP endpoint, mount it in `server.ts` BEFORE the final SSR handler (`app.use(async (req, res) => …)`) or it'll be swallowed. That handler short-circuits to a fast 404 for non-GET requests, paths with a file extension (e.g. `/favicon.ico`), and unknown `/api/*` (JSON) — only extension-less GETs reach the React renderer. SSR returns `routerContext.statusCode`, so unmatched routes get a real 404. `/healthz` (DB ping) is mounted up top.

6. **Env vars are zod-validated at import time** (`server/env.ts`). Any new required env var must be added there AND to `.env.example` AND to the Drydock portal (Project → Environment → Apply + redeploy). If `env.ts` throws, the server won't start — that's the design.

7. **better-auth's required schema lives in `prisma/schema.prisma`** (`User`, `Session`, `Account`, `Verification` models — mapped to lowercase tables via `@@map`). better-auth's `prismaAdapter` queries by camelCase Prisma field name, so don't rename fields without checking better-auth's docs. The snake_case `@map(...)` annotations are cosmetic — they preserve the column layout from the prior Drizzle schema.

8. **shadcn components do NOT have `asChild` support here.** I dropped `@radix-ui/react-slot` to keep deps minimal. If you `bunx shadcn add` something that needs Slot, install `@radix-ui/react-slot` first. To render a `Link` as a button, use `className={buttonVariants()}` (see `error-boundary.tsx`).

9. **The stylesheet is linked from `index.html`, never imported from JS.** `<link rel="stylesheet" href="/src/styles/app.css">` is render-blocking in dev (Vite serves it as compiled CSS and HMR swaps the href) and gets content-hashed into `<head>` by `vite build`. Importing CSS from a component made Vite inject it only after the client module graph loaded, so every dev load painted unstyled SSR HTML first. Don't add `import './x.css'` to components — `@import` it from `app.css`.

10. **Theme is applied before first paint by the inline script in `index.html`**; `src/lib/theme.ts` mirrors the same logic for post-hydration changes (keep them in sync). `.dark` on `<html>` drives the tokens. Components must render identical markup in both themes — swap with `dark:` classes (see `theme-toggle.tsx`), never branch on the theme in JS during render, or SSR and client markup diverge.

11. **Dev is one port.** Vite's HMR websocket rides on the Express `http.Server` (`hmr: { server: httpServer }` in `server.ts`). Don't give it a fixed port — two clones of this template running at once would fight over it and HMR would silently die.

12. **`.env` is loaded by `prisma.config.ts` itself.** Bun loads `.env` into its own runtime but NOT into the Prisma CLI (a Node subprocess), and Prisma 7 dropped auto-loading — so the config reads `.env` manually with a safe fallback (`prisma generate` works before `.env` exists). Don't delete that block. Runtime `PrismaClient` gets the URL via the pg adapter in `server/prisma.ts`.

13. **Dev port is `PORT` (default 4780), never 3000.** It's validated in `server/env.ts`; `BETTER_AUTH_URL` defaults to `http://localhost:$PORT`. Every project gets its own distinct, uncommon port — `bun run init` derives one from the name (or `--port <n>`) and rewrites `4780` everywhere. Never use 3000/3001/5173/5174/8000/8080/4200/5000. Record the port in `cliffnotes.md`. Playwright uses its own 3100; Render injects its own `PORT`.

14. **superjson end to end.** `initTRPC` and every client link (`src/lib/trpc.tsx`, the SSR loopback in `entry-server.tsx`) use `transformer: superjson` — add it to any new link or the wire breaks. The dehydrated SSR cache goes through `src/lib/ssr-state.ts` (superjson), never raw `JSON.stringify`, so prefetched `Date`s are `Date`s on first client render. Return `Date`s from procedures; format them deterministically (e.g. `toISOString()`, or a fixed `timeZone` in `Intl`) so SSR and client markup match.

15. **Schema changes are migrations, never `db push`.** Edit `schema.prisma` → `bun run db:migrate --name <what>` → commit `prisma/migrations/<ts>_<what>/`. Production (Render `preDeployCommand`) and e2e (`global-setup.ts`) both run `prisma migrate deploy`. Anything Prisma can't model — extensions, exclusion constraints, FTS `tsvector` columns/triggers, expression/partial indexes — is **hand-written SQL in a migration** (see "Raw SQL in a migration").

16. **Types are the guardrail.** `strict` + `noUncheckedIndexedAccess` are on and `tsconfig` covers `e2e/`, `scripts/` and the configs. No `any` (use `unknown` + narrowing, generics, zod at boundaries), no `as` casts to paper over a mismatch, no `!` where narrowing works. Example: React Router types loader `context` as `any`; `routes.tsx` narrows it with `isSsrContext` instead of casting. The one `@ts-ignore` (the `dist/` import in `server.ts`) carries its reason.

## Architecture flows

### Auth (browser → cookie → session)

1. User submits the sign-in form → `authClient.signIn.email({ email, password })` (browser).
2. better-auth client POSTs to `/api/auth/sign-in/email` → caught by `app.all('/api/auth/*splat', toNodeHandler(auth))` in `server.ts` → cookie set on the response.
3. Form handler calls `revalidator.revalidate()` then `useNavigate()` to `/dashboard`. Revalidate re-runs loaders so the new session lands in route data.
4. On server-side SSR, `entry-server.tsx` calls `auth.api.getSession({ headers })` once per request and passes it through `createStaticHandler.query(req, { requestContext: { session, ... } })` to loaders. The root layout's loader returns `{ session }`; descendants read it via `useRouteLoaderData('root')`. **No client-side flicker** — the session is in the SSR HTML's RR hydration script and available on first paint.
5. On client navigations, loaders call `authClient.getSession()` (HTTP roundtrip to `/api/auth/get-session`). One extra request per navigation; cheap and means stale session never leaks across pages.

### tRPC

1. Client component does `const trpc = useTRPC()` then `useQuery(trpc.posts.list.queryOptions())`.
2. Request hits `/api/trpc/posts.list?batch=1&input=...` → Express tRPC middleware in `server.ts` → `appRouter` in `server/router.ts`.
3. `createContext` (in `server/trpc.ts`) calls `auth.api.getSession({ headers })` from the request and attaches it to `ctx`.
4. `protectedProcedure` throws `UNAUTHORIZED` if `ctx.session` is null. `publicProcedure` doesn't check.

### SSR

1. Express catch-all handles non-`/api/*` requests.
2. In dev: `vite.transformIndexHtml(url, indexHtml)` then `vite.ssrLoadModule('/src/entry-server.tsx').render(req)`.
3. In prod: read pre-built `dist/client/index.html`, import `dist/server/entry-server.js`, call `render(req)`.
4. `render(req)` builds a Fetch `Request` from the Express `req`, runs it through `createStaticHandler(routes).query(...)` to execute loaders, then `renderToString` with `<StaticRouterProvider>`.
5. The HTML returned has `<!--app-html-->` swapped for the rendered React tree. The client then hydrates via `src/index.tsx` and `<RouterProvider router={createBrowserRouter(routes)} />`.

**SSR data hydration IS wired up**. The pipeline:

- `entry-server.tsx` creates a per-request `QueryClient` plus a server-side `createTRPCOptionsProxy({ router: appRouter, ctx: { session }, queryClient })` — this proxy calls procedures **directly** (no HTTP), bypassing the network entirely.
- Both are passed to loaders via `requestContext`. Loaders prefetch with `ctx.queryClient.prefetchQuery(ctx.trpc.posts.list.queryOptions())` (see `src/app/routes.tsx` → `dashboardLoader`).
- After the static handler resolves, `dehydrate(queryClient)` is serialized **with superjson** (`serializeSsrState` in `src/lib/ssr-state.ts`) into `window.__SSR_STATE__` via the `<!--app-state-->` placeholder in `index.html`.
- On the client, `index.tsx` runs `deserializeSsrState(window.__SSR_STATE__)` and feeds the result to `<HydrationBoundary>` in `App.tsx`. Components reading `useQuery(trpc.posts.list.queryOptions())` get cached data instantly. No refetch, no flicker.

**Date handling note**: procedures return real `Date`s (superjson on the wire and in the SSR payload — `src/lib/ssr-state.test.ts` and the e2e smoke prove a `Date` is still a `Date` after hydration). What must stay deterministic is the _formatting_: `toLocaleString()` without a fixed locale/timeZone differs between server and browser and React will warn about a hydration mismatch. `dashboard.tsx` uses `createdAt.toISOString().slice(0, 10)`.

**Client-nav prefetch IS wired up too**: `src/lib/trpc.tsx` exports `getBrowserClients()` — lazy module singletons (`queryClient`, `trpcClient`, and a `createTRPCOptionsProxy` bound to them). `index.tsx` hands the same instances to `<App>`, and the client branch of `dashboardLoader` calls `queryClient.prefetchQuery(trpc.posts.list.queryOptions())` so a client navigation renders with data — no "Loading…" flash. Follow that pattern for any new data route: prefetch in both branches of the loader.

### Logging & errors

`server/logger.ts` is dependency-free (ANSI, gated on TTY + `NO_COLOR`). `requestLogger` logs one line per request (`method · status · path · timing`, color-coded), skipping vite/HMR/asset noise in dev. `startupBanner` prints mode/URLs/db-host/routes on listen. Use `log.info/warn/error/success` for server-side messages and `formatError` for exceptions — don't sprinkle raw `console.log`. Client/loader errors surface through the root `ErrorBoundary` (`src/app/error-boundary.tsx`); it shows a 404 for `isRouteErrorResponse(err) && status === 404`, a stack in dev otherwise.

## Common tasks

### Add a route

Create `src/app/<name>.tsx` exporting a `<NamePage>` component. Add it to `src/app/routes.tsx`:

```ts
{ path: '<name>', Component: NamePage }
```

Nested paths work the same as standard RR7 — see https://reactrouter.com/start/data/routing.

### Add a tRPC procedure

In `server/router.ts`, add to the `appRouter` tree. Choose `publicProcedure` or `protectedProcedure`. Validate inputs with zod. Return data — don't `Response.json`. Type flows automatically to the client via `AppRouter`.

### Add a DB table

1. Edit `prisma/schema.prisma` (FK relations to `User` should be `onDelete: Cascade`).
2. `bun run db:migrate --name add_my_model` — generates `prisma/migrations/<ts>_add_my_model/migration.sql`, applies it to your dev DB, and regenerates the client. **Read the SQL** and commit the folder with the schema change.
3. Use it in tRPC procedures: `prisma.myModel.findMany(...)`.

Never `prisma db push` — it skips the migration history and silently drops anything Prisma doesn't model (FTS indexes, triggers).

### Raw SQL in a migration

Prisma can't express Postgres extensions, exclusion constraints, full-text search (`tsvector` columns, GIN expression indexes, update triggers), partial/expression indexes or check constraints. They live in migration SQL:

1. `bun run db:migrate:create --name add_booking_overlap_guard` — writes the migration **without applying it**.
2. Append SQL to its `migration.sql`, e.g.
   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   ALTER TABLE "booking" ADD CONSTRAINT "booking_no_overlap"
     EXCLUDE USING gist ("room_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&);
   ```
   (FTS: a `tsvector` column is `Unsupported("tsvector")?` in `schema.prisma`; the GIN index and the trigger that fills it are SQL.)
3. `bun run db:migrate` — applies it.
4. On every later migration, **review the generated SQL**: Prisma's diff can emit `DROP INDEX` for indexes it doesn't know about (expression/partial ones). Delete those lines before applying (`db:migrate:create` first when in doubt).

### Add a shadcn component

```bash
bunx --bun shadcn@latest add <name>
```

It writes to `src/components/ui/`. `components.json` aliases already point at `~/components` and `~/lib/utils`.

### Add an env var

`server/env.ts` (zod schema) → `.env.example` (placeholder) → Drydock portal (Project → Environment → Apply + redeploy). Drydock seeds `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` itself.

### Add an e2e test

Specs live in `e2e/*.spec.ts` (Playwright). Tests run against an isolated DB (`sal_starter_test`, URL in `e2e/db.ts`, override with `E2E_DATABASE_URL` — the name must end in `_test`) on port 3100; `e2e/global-setup.ts` runs `prisma migrate deploy` on it and then truncates it so screenshots are deterministic. Create it once with `createdb sal_starter_test`. Add visual coverage with `await expect(page).toHaveScreenshot('name.png')` on a STABLE view (no dynamic dates/ids), then `bun run test:e2e:update` to write the baseline (committed under `e2e/__screenshots__/`). Run with `bun run test:e2e`. Don't screenshot pages with per-run dynamic content unless you mask it.

## Build / verify

```
bun run typecheck   # tsgo --noEmit (TypeScript Native Preview) — strict + noUncheckedIndexedAccess
bun run test        # bun:test unit tests (*.test.ts under src/ and server/)
bun run build       # vite build (client) + vite build --ssr (server) → dist/client + dist/server
bun run test:e2e    # Playwright against the isolated, migrated test DB on :3100
bun run dev         # bun --watch server.ts → http://localhost:4780 (HMR on the same port)
bun run start       # NODE_ENV=production bun server.ts
```

A change isn't done while `typecheck` is red. If you edit `prisma/schema.prisma`, `bun run db:migrate` regenerates `@prisma/client` (or `bun run db:generate` alone).

## Production server

Same `server.ts` runs in dev and prod, gated on `NODE_ENV`. In prod it:

- Skips the vite dev server.
- Serves `dist/client/` via `express.static` (with `compression()`).
- Reads pre-rendered `dist/client/index.html` for the template.
- Loads the SSR bundle at `dist/server/entry-server.js`.

The `// @ts-ignore` on that dist import is intentional — the file doesn't exist before first build.

## Render deploy gotchas

- `runtime: node`, NOT `runtime: bun`. Render's blueprint spec doesn't expose a bun runtime. Setting `BUN_VERSION` makes the node runtime install Bun and put it on PATH.
- `preDeployCommand: bunx prisma migrate deploy` — applies committed migrations only; it never generates or resets anything. A failed migration fails the deploy before traffic moves.
- `bunx prisma generate` runs in `buildCommand` so the client exists before `vite build` reads it.
- `BETTER_AUTH_URL` must be set to the public Render URL after first deploy (`sync: false` in the blueprint).
- The free Postgres plan expires after 30 days on Render — bump the plan when going past prototype.

## Versions to be aware of

- React Router 7.5+. The `RouteObject` shape uses `Component` (capital C) and `ErrorBoundary` (capital E). Don't reach for `element: <Foo />` unless you've got a reason.
- Tailwind v4 uses `@import 'tailwindcss'` (not `@tailwind base/components/utilities`). Theme tokens go in `@theme inline { ... }`. There is no `tailwind.config.ts`.
- Prisma 7.x — `prisma` CLI and `@prisma/client` MUST stay in lockstep on the same major. Uses the `pg` driver adapter (`@prisma/adapter-pg`).
- Express 5.x — required for the named-wildcard route syntax. Don't downgrade to Express 4.
- Vite 6.
- zod 4 — top-level formats (`z.url()`, `z.email()`), `{ error }` for custom messages.
- superjson 2 — the tRPC transformer; in tRPC v11 it goes on each link (`httpBatchLink({ transformer })`) and in `initTRPC.create()`.

## Don't

- Don't add `tailwind.config.{js,ts}` — Tailwind v4 doesn't use it; tokens are in `app.css`.
- Don't import server modules (`./server/*`) from anything under `./src/` except as `import type`. That file ends up in the client bundle and will either break the build or leak secrets.
- Don't add file-based routing back. The `RouteObject[]` in `src/app/routes.tsx` is the source of truth.
- Don't reach for `@trpc/react-query` (the old package) — we use `@trpc/tanstack-react-query` (the new one with `queryOptions()` / `mutationOptions()`).
- Don't commit `.env`, `dist/`, `node_modules/`, or Playwright run artifacts (`test-results/`, `playwright-report/`). They're in `.gitignore`. DO commit `e2e/__screenshots__/` baselines.
- Don't hand-edit anything under `node_modules/.prisma/` or `node_modules/@prisma/client/`. Re-run `bun run db:generate` after schema changes.
- Don't `prisma db push`, and don't edit a migration that has already been applied anywhere shared — add a new one.
- Don't run the dev server on 3000 (or 3001/5173/5174/8000/8080/4200/5000).
- Don't downgrade to Express 4 — the route wildcards (`*splat`) need Express 5.
- Don't sprinkle raw `console.log` in `./server/` — use `log.*` / `formatError` from `server/logger.ts` so output stays consistent.
