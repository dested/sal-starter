# tan-starter

SSR React starter wired with the latest stack.

- **TanStack Start** (Vite-based SSR + file-based routing)
- **Prisma ORM 6** + **PostgreSQL**
- **better-auth** (email + password)
- **tRPC v11** + **TanStack Query** (`.queryOptions()` style)
- **Tailwind v4** + **shadcn/ui** (new-york style, oklch tokens)
- **Bun** (runtime, package manager, production server)
- **Render.com** blueprint deploy (web service + managed Postgres)

## Quickstart

Requires [Bun](https://bun.sh) ≥ 1.1 and a local Postgres (or any reachable Postgres URL).

```bash
bun install
cp .env.example .env
# edit .env: set DATABASE_URL, replace BETTER_AUTH_SECRET with 32+ random chars
bun run db:push       # sync schema to your database
bun run dev           # http://localhost:3000
```

To generate a secret quickly: `bunx --bun openssl rand -base64 32` (or any 32+ char string).

## Scripts

| script | what it does |
| --- | --- |
| `bun run dev` | dev server with HMR on :3000 |
| `bun run build` | produces `dist/server/server.js` and `dist/client/*` |
| `bun run start` | runs the Bun production server (`server.ts`) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run db:push` | sync `prisma/schema.prisma` directly into Postgres |
| `bun run db:migrate` | create + apply a migration under `./prisma/migrations` (dev) |
| `bun run db:generate` | regenerate the Prisma client (auto-runs on `bun install`) |
| `bun run db:studio` | Prisma Studio |

## Project layout

```
src/
├── components/ui/         shadcn components (button, input, label, card)
├── db/
│   └── index.ts           PrismaClient singleton (HMR-safe)
├── lib/
│   ├── auth.ts            better-auth server config
│   ├── auth-client.ts     better-auth React client
│   ├── env.ts             zod-validated env
│   └── utils.ts           cn()
├── trpc/
│   ├── init.ts            initTRPC + publicProcedure / protectedProcedure
│   ├── router.ts          appRouter (`me`, `posts.list`, `posts.create`)
│   └── react.tsx          TRPCReactProvider
├── routes/
│   ├── __root.tsx         layout, navbar, session loader
│   ├── index.tsx          public landing
│   ├── sign-in.tsx        email + password
│   ├── sign-up.tsx        email + password
│   ├── dashboard.tsx      protected, exercises tRPC + Prisma
│   └── api/
│       ├── auth/$.ts      mounts better-auth at /api/auth/*
│       └── trpc/$.ts      mounts tRPC at /api/trpc/*
├── styles/app.css         Tailwind v4 + shadcn tokens
└── router.tsx             createRouter

prisma/
└── schema.prisma          User / Session / Account / Verification + Post
```

## How auth flows

1. `__root.tsx` calls a server function that reads the session cookie and returns it as router context.
2. Every route can read `Route.useRouteContext().session`.
3. Protected routes (`dashboard`) check `context.session` in `beforeLoad` and `redirect()` if missing.
4. `authClient.signIn.email({ email, password })` POSTs to `/api/auth/sign-in/email`; cookie is set; `router.invalidate()` re-runs the root loader so `session` is populated.
5. `auth.handler(request)` is mounted at `routes/api/auth/$.ts` (catch-all splat).

## How tRPC flows

- `routes/api/trpc/$.ts` is a catch-all server route that dispatches to `appRouter` via `fetchRequestHandler`.
- The tRPC context calls `auth.api.getSession({ headers: req.headers })` so every procedure sees `ctx.session`.
- `protectedProcedure` throws `UNAUTHORIZED` when there is no session.
- The client uses `@trpc/tanstack-react-query`: `useTRPC()` exposes `trpc.posts.list.queryOptions()` etc.

## SSR data hydration

`getRouter()` creates a per-request `QueryClient` + `TRPCClient` + `createTRPCOptionsProxy` and hands them to `setupRouterSsrQueryIntegration`. That dehydrates queries into the SSR HTML and rehydrates them into a fresh `QueryClient` on the browser. Prefetch in a route loader:

```ts
export const Route = createFileRoute('/dashboard')({
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery(context.trpc.posts.list.queryOptions())
  },
  component: DashboardPage,
})
```

The component reads the same query with `useQuery(useTRPC().posts.list.queryOptions())` and gets cached data with no flicker.

Cookies are forwarded into the SSR-side tRPC client via `httpBatchLink({ headers })`, so `auth.api.getSession()` works inside the tRPC context during SSR. Both `publicProcedure` and `protectedProcedure` queries are safe to prefetch from loaders. The wiring uses a server-only helper (`src/lib/ssr-cookie-headers.ts`) gated by `createIsomorphicFn` so the import is tree-shaken out of the client bundle — see `CLAUDE.md` for the rules around editing it.

## Deploy to Render

1. Push this repo to GitHub.
2. In Render, click **Blueprints → New Blueprint Instance**, point at the repo. The `render.yaml` provisions a managed Postgres database and a web service.
3. After the first deploy, set `BETTER_AUTH_URL` to the public URL Render assigned (e.g. `https://tan-starter.onrender.com`) and redeploy.
4. `preDeployCommand` runs `prisma db push --accept-data-loss` so your schema is applied automatically on every deploy. For real production workflows, commit migrations (`bun run db:migrate` locally) and switch the pre-deploy step to `prisma migrate deploy`.

`DATABASE_URL` is wired to the managed Postgres automatically. `BETTER_AUTH_SECRET` is generated by Render once.

**Why `runtime: node` instead of `runtime: bun`?** Render's blueprint spec doesn't have a `bun` runtime — but the Node runtime ships with Bun preinstalled, and setting `BUN_VERSION` in `envVars` activates it. Your build/start commands then just use `bun` directly. Bump `BUN_VERSION` in `render.yaml` to upgrade.

## Adding a shadcn component

```bash
bunx --bun shadcn@latest add dialog
```

It will land in `src/components/ui/` and respect the aliases in `components.json`.
