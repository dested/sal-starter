# CLAUDE.md

Briefing for an LLM extending this codebase. Read this before changing files.

## What this is

A starter template (cloned, then mutated into a real product). Every file is intentionally minimal — keep it that way. When asked to add a feature, add the feature; do not also "improve" surrounding files.

## Stack

| layer | choice | notes |
| --- | --- | --- |
| runtime / pkg mgr | Bun ≥ 1.3 | both dev and prod |
| server | Express + Vite SSR | `bun --watch server.ts`; vite middleware in dev, static `dist/client/` + SSR bundle in prod |
| routing | React Router 7 (`react-router-dom`) | `createBrowserRouter` on the client, `createStaticHandler` + `createStaticRouter` on the server |
| db | Postgres + Prisma ORM (v6) | `@prisma/client`, default binary engine |
| auth | better-auth | email + password only, autoSignIn on sign-up |
| api | tRPC v11 | `@trpc/tanstack-react-query` (`.queryOptions()` API), mounted as Express middleware at `/api/trpc` |
| styles | Tailwind v4 + shadcn (new-york) | CSS-first config, oklch tokens |
| deploy | Render.com blueprint | `runtime: node` + `BUN_VERSION` env var |

## Layout (load this mental model)

```
server.ts            Express server entry. Bun runs this in dev and prod.
server/
├── env.ts           zod-validated env at import time
├── prisma.ts        PrismaClient singleton (survives HMR)
├── auth.ts          better-auth instance + Session type
├── trpc.ts          createContext + initTRPC + procedure builders
└── router.ts        appRouter (exports AppRouter type for the client)

src/
├── index.tsx              client entry (hydrateRoot + createBrowserRouter)
├── entry-server.tsx       SSR entry (createStaticHandler + renderToString)
├── App.tsx                top-level providers
├── app/
│   ├── routes.tsx         RouteObject[] tree
│   ├── layout.tsx         root layout (nav + <Outlet />)
│   ├── home.tsx           /
│   ├── sign-in.tsx        /sign-in
│   ├── sign-up.tsx        /sign-up
│   └── dashboard.tsx      /dashboard
├── components/ui/         shadcn primitives
├── lib/
│   ├── auth-client.ts     better-auth React client (signIn, signUp, useSession, signOut)
│   ├── trpc.tsx           TRPCProvider, useTRPC, AppProviders (QueryClient + tRPC client)
│   └── utils.ts           cn() helper
└── styles/app.css         Tailwind v4 import + shadcn tokens

index.html             Vite entry HTML with `<!--app-html-->` placeholder
prisma/schema.prisma   DB schema (User/Session/Account/Verification/Post)
```

## Hard rules

1. **Path alias is `~/*` → `src/*`** (client only). Defined in both `tsconfig.json` and `vite.config.ts` (`resolve.alias`). Server code under `./server/` uses relative imports.

2. **Server-only modules: anything under `./server/`.** These import secrets, the Prisma client, or Node-only deps. **Never import them from a `.tsx` file under `src/`** — that file ends up in the client bundle. The one exception is **type-only** imports: `src/lib/trpc.tsx` does `import type { AppRouter } from '../../server/router'`, which is erased at build time. Anything else from `./server/` is server-only.

3. **There is no file-based routing.** Routes are explicit `RouteObject[]` entries in `src/app/routes.tsx`. Add a new route by creating a component file in `src/app/<name>.tsx` and adding `{ path: '<name>', Component: <Component> }` to the tree.

4. **Server entry vs client entry.** `src/entry-server.tsx` runs under `vite.ssrLoadModule` in dev and as a built bundle under `./dist/server/entry-server.js` in prod — it exports `render(req)`. `src/index.tsx` runs in the browser and is loaded via `<script type="module" src="/src/index.tsx">` in `index.html`. Both wrap the app with `<App>` so providers (QueryClient, TRPC) are the same on both sides.

5. **API routes are Express mounts in `server.ts`** — not file-based:
   - `app.all('/api/auth/*splat', toNodeHandler(auth))` — better-auth
   - `app.use('/api/trpc', createExpressMiddleware({ router: appRouter, createContext }))` — tRPC
   If you add a new HTTP endpoint, mount it in `server.ts` BEFORE the SSR catch-all (`app.use('/*splat', ...)`) or it'll be swallowed.

6. **Env vars are zod-validated at import time** (`server/env.ts`). Any new required env var must be added there AND to `.env.example` AND to `render.yaml`. If `env.ts` throws, the server won't start — that's the design.

7. **better-auth's required schema lives in `prisma/schema.prisma`** (`User`, `Session`, `Account`, `Verification` models — mapped to lowercase tables via `@@map`). better-auth's `prismaAdapter` queries by camelCase Prisma field name, so don't rename fields without checking better-auth's docs. The snake_case `@map(...)` annotations are cosmetic — they preserve the column layout from the prior Drizzle schema.

8. **shadcn components do NOT have `asChild` support here.** I dropped `@radix-ui/react-slot` to keep deps minimal. If you `bunx shadcn add` something that needs Slot, install `@radix-ui/react-slot` first.

## Architecture flows

### Auth (browser → cookie → session)

1. User submits the sign-in form → `authClient.signIn.email({ email, password })` (browser).
2. better-auth client POSTs to `/api/auth/sign-in/email` → caught by the `app.all('/api/auth/*splat', toNodeHandler(auth))` mount in `server.ts` → cookie set on the response.
3. Form handler navigates to `/dashboard` via `useNavigate()`.
4. `authClient.useSession()` (a better-auth React hook) reads the session by hitting `/api/auth/get-session`. Components use it directly in render. The session is not pre-fetched into router context — there's a brief flicker on initial load for signed-in users until `useSession()` resolves. If you need synchronous session access during SSR (e.g. to render the right nav state without flicker), pass it through `createStaticHandler.query(req, { requestContext })` and serialize via `window.__SESSION__`.

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

**No SSR data hydration is wired up** for tRPC queries. `posts.list` on the dashboard fetches client-side after hydration. If you want to prefetch on the server, you'll need to (a) build a per-request `QueryClient` + tRPC client, (b) prefetch in route loaders via `requestContext`, (c) `dehydrate(queryClient)` into the HTML, (d) hydrate with `<HydrationBoundary state={...}>` on the client.

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
2. `bun run db:push` — pushes schema directly (dev). Or `bun run db:migrate` to create a migration file.
3. `bun run db:generate` re-generates the Prisma client. (`bun install` runs this automatically via `postinstall`.)
4. Use it in tRPC procedures: `prisma.myModel.findMany(...)`.

### Add a shadcn component

```bash
bunx --bun shadcn@latest add <name>
```

It writes to `src/components/ui/`. `components.json` aliases already point at `~/components` and `~/lib/utils`.

### Add an env var

`server/env.ts` (zod schema) → `.env.example` (placeholder) → `render.yaml` (envVars block, with `sync: false` for secrets the user supplies, or `generateValue: true` if Render should generate it).

## Build / verify

```
bun run typecheck   # tsgo --noEmit (TypeScript Native Preview)
bun run build       # vite build (client) + vite build --ssr (server) → dist/client + dist/server
bun run dev         # bun --watch server.ts → http://localhost:3000
bun run start       # NODE_ENV=production bun server.ts
```

If you change anything touching tRPC/auth/Prisma types, run `typecheck`. If you edit `prisma/schema.prisma`, run `bun run db:generate` first so `@prisma/client` types update.

## Production server

Same `server.ts` runs in dev and prod, gated on `NODE_ENV`. In prod it:

- Skips the vite dev server.
- Serves `dist/client/` via `express.static` (with `compression()`).
- Reads pre-rendered `dist/client/index.html` for the template.
- Loads the SSR bundle at `dist/server/entry-server.js`.

The `// @ts-ignore` on that dist import is intentional — the file doesn't exist before first build.

## Render deploy gotchas

- `runtime: node`, NOT `runtime: bun`. Render's blueprint spec doesn't expose a bun runtime. Setting `BUN_VERSION` makes the node runtime install Bun and put it on PATH.
- `preDeployCommand: bunx prisma db push --accept-data-loss` — applies schema directly without migrations. Fine for a starter; switch to `prisma migrate deploy` for real production.
- `bunx prisma generate` runs in `buildCommand` so the client exists before `vite build` reads it.
- `BETTER_AUTH_URL` must be set to the public Render URL after first deploy (`sync: false` in the blueprint).
- The free Postgres plan expires after 30 days on Render — bump the plan when going past prototype.

## Versions to be aware of

- React Router 7.5+. The `RouteObject` shape uses `Component` (capital C). Don't reach for `element: <Foo />` unless you've got a reason.
- Tailwind v4 uses `@import 'tailwindcss'` (not `@tailwind base/components/utilities`). Theme tokens go in `@theme inline { ... }`. There is no `tailwind.config.ts`.
- Prisma 6.x — `prisma` CLI and `@prisma/client` MUST stay in lockstep on the same major.
- Vite 6.

## Don't

- Don't add `tailwind.config.{js,ts}` — Tailwind v4 doesn't use it; tokens are in `app.css`.
- Don't import server modules (`./server/*`) from anything under `./src/` except as `import type`. That file ends up in the client bundle and will either break the build or leak secrets.
- Don't add file-based routing back. The `RouteObject[]` in `src/app/routes.tsx` is the source of truth.
- Don't reach for `@trpc/react-query` (the old package) — we use `@trpc/tanstack-react-query` (the new one with `queryOptions()` / `mutationOptions()`).
- Don't commit `.env`, `dist/`, `node_modules/`. They're in `.gitignore`.
- Don't hand-edit anything under `node_modules/.prisma/` or `node_modules/@prisma/client/`. Re-run `bun run db:generate` after schema changes.
