# CLAUDE.md

Briefing for an LLM extending this codebase. Read this before changing files.

**0. Kickoff before any feature work.** While `project.json` `look` is `null`, this fork still wears the starter's neutral placeholder: dev shows a "Kickoff pending" ribbon and `bun run test` fails. Run the kickoff skill (`.claude/skills/kickoff/SKILL.md`, `/kickoff`) first: it asks Sal for the look (one scheme, never a dark mode), then builds tokens, fonts, primitives, the real `/`, the brand mark (icon, splash, favicon) and `ui.md`, and drops the Post demo (`bun run demo:drop`, rule 24).

## What this is

A starter template (cloned, then mutated into a real product). Every file is intentionally minimal — keep it that way. When asked to add a feature, add the feature; do not also "improve" surrounding files.

It's a Bun workspace: **`apps/web`** is the SSR web app _and_ the API server (Express + tRPC + better-auth + Prisma), the optional **`apps/mobile`** is an Expo dev-client app that talks to that same server, and the optional **`apps/desktop`** is an Electron app whose main process serves its own tRPC router over IPC. `project.json` `surfaces` says which a fork has: `bun run init <name>` keeps web only, `--mobile` / `--desktop` keep those too, `--desktop-only` keeps just the Electron app (no server, database or auth), `--no-auth` takes accounts out (Common tasks → Start a fork). `bun run add:mobile` / `add:desktop` bring a surface back; `bun run add:ai` / `add:ws` / `add:jobs` add an optional server slot. **Paths in hard rules 1–16, 24–27 and in the web sections below are relative to `apps/web/`.**

## Stack

| layer              | choice                           | notes                                                                                                                                                                                                  |
| ------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| runtime / pkg mgr  | Bun 1.4, workspaces              | one root `bun.lock`, `linker = "hoisted"` and a 3-day `minimumReleaseAge` (`bunfig.toml`), shared versions in the root `catalog` (`"react": "catalog:"`)                                               |
| server             | Express 5 + Vite 8 SSR           | `bun --watch server.ts`; vite middleware in dev, static `dist/client/` + SSR bundle in prod. **Express 5 is required** — routes use named wildcards (`*splat`).                                        |
| routing            | React Router 8 (`react-router`)  | `createBrowserRouter` (`RouterProvider` from `react-router/dom`) on the client, `createStaticHandler` + `createStaticRouter` on the server; loaders read a typed context (`src/lib/router-context.ts`) |
| db                 | Postgres + Prisma ORM (v7)       | `@prisma/client` via the **`pg` driver adapter** (`@prisma/adapter-pg`), not the binary engine. Schema changes ship as **committed migrations** (`prisma migrate`)                                     |
| auth               | better-auth                      | email + password, autoSignIn on sign-up; `SIGNUP_ALLOWLIST` + `ADMIN_EMAILS` (rule 25); `init --no-auth` removes it                                                                                    |
| api                | tRPC v11 + superjson             | `@trpc/tanstack-react-query` (`.queryOptions()` API), mounted as Express middleware at `/api/trpc`; superjson transformer, so `Date`s survive the wire and SSR                                         |
| validation         | zod 4                            | env, tRPC inputs, anything crossing a boundary                                                                                                                                                         |
| styles             | Tailwind v4 + shadcn (base-nova) | CSS-first config, oklch tokens in `packages/tokens`, ONE theme (no dark mode, no toggle); primitives wrap `@base-ui/react`; `cn` from shadcn's `cn` package; the kickoff sets the look                 |
| brand              | `packages/brand` + resvg         | one `mark.svg` + `brand.json` → every icon, splash, favicon and manifest (`bun run brand`), committed and test-checked                                                                                 |
| React Compiler     | babel-plugin-react-compiler 1.0  | web + desktop through `@rolldown/plugin-babel` + `reactCompilerPreset` (client build only); mobile through babel-preset-expo                                                                           |
| tests              | Playwright e2e + `bun:test`      | `e2e/` + committed screenshot baselines against an isolated, migrated test DB; unit tests are `*.test.ts` under `src/` / `server/` (`bun run test`)                                                    |
| deploy             | Drydock (`drydock.yaml`)         | only `apps/web` deploys (`rootDir: apps/web`, `workspace: "@app/web"`); mobile ships via EAS Build + EAS Update                                                                                        |
| analytics          | Crow's Nest                      | one `<script defer>` in `index.html` (silent on localhost); custom events via `cnEvent()` in `src/lib/crowsnest.ts`                                                                                    |
| mobile (optional)  | Expo SDK 58 + Expo Router        | dev client (never Expo Go), Uniwind over `@app/tokens`, better-auth Expo plugin, tRPC + superjson via `import type` from `@app/web/router`; iOS + Android profiles                                     |
| desktop (optional) | Electron 44 + electron-vite 6    | tRPC v11 over IPC (`@app/trpc-ipc`, no superjson), React 19 + Tailwind 4 over `@app/tokens`; unpacked builds via electron-builder, no installer                                                        |
| types              | TypeScript 7 `tsc`               | `strict` + `noUncheckedIndexedAccess` everywhere; `bun run typecheck` fans out over every workspace (root covers `scripts/` and `recipes/`)                                                            |

## Layout (load this mental model)

```
project.json         the ONE per-project identity file: name, displayName, scheme, bundleId,
                     appId, surfaces, apiPort, metroPort, desktopPort, db, easProjectId, easOwner,
                     appleTeamId, look ({ scheme, direction } or null until the kickoff);
                     `template: true` only in the template (init drops it) (rule #22)
.claude/skills/      kickoff (rule 0) and upgrade-expo: skills every fork inherits
package.json         workspace root: catalog (shared pins), proxy scripts
bunfig.toml          [install] linker = "hoisted", minimumReleaseAge = 3 days (every machine, every fork)
tsconfig.base.json   shared strict compiler options (apps extend it)
tsconfig.json        root typecheck: scripts/**, recipes/*.ts, recipes/*/recipe.ts, prettier.config.js
drydock.yaml         deploy seed (rootDir apps/web, workspace @app/web, predeploy = bun run db:deploy)
.easignore           EAS upload filter (EAS reads it instead of every .gitignore)
scripts/
├── init.ts          clone → rename, project.json, ports, drops surfaces (flags: Common tasks → Start a fork)
├── sync.ts          merge upstream/main, never commits; keeps identity, lock, dropped surfaces/pieces dropped
├── add-surface.ts   add:mobile / add:desktop from upstream
├── project.ts       project.json schema, SURFACE_PATHS, SURFACE_SCRIPTS, OPTIONAL_PATHS
├── demo.ts          bun run demo:drop [--check|--dry-run]: removes the Post demo (rule 24)
├── no-auth.ts       init --no-auth: checked edits that remove better-auth (--check)
├── eas-setup.ts     EAS project for mobile (init --mobile, or `bun run --cwd apps/mobile eas:setup`)
├── upgrade-expo.ts  bun run upgrade:expo [--check|--sdk n|--json]: Expo inside the release age
└── dev.ts, shell.ts web + Metro + electron-vite runner; git/run/fail helpers
recipes/             add:ai / add:ws / add:jobs: add.ts (runner), lib.ts (engine), <name>/recipe.ts + files/,
                     shared/ (server/shutdown.ts)
apps/web/            @app/web, everything below in this block lives here
apps/mobile/         @app/mobile (optional), see "Mobile" below
apps/desktop/        @app/desktop (optional), see "Desktop" below
packages/            tokens, brand, trpc-ipc (desktop's tRPC link), native-example (template-only mobile demo)

packages/tokens/
├── theme.css        Tailwind mapping (@theme inline roles, radius scale, shadow-card, `dark:` disabled); merges on sync
├── tokens.css       the look: ONE :root of values (fork-owned, merge=ours); color-scheme = look.scheme
├── colors.json      generated hex per role (`bun run tokens`); never edit by hand
├── index.ts         `colors` (+ ColorRole) for code that can't use classes: native, SVG, Electron
├── css.ts / emit.ts parser + oklch→hex, and the `bun run tokens` writer
└── tokens.test.ts   colors.json current, every role has a value, one theme, the kickoff ran

packages/brand/
├── mark.svg         the glyph, one color (`fill="currentColor"`), fork-owned
├── brand.json       token roles → icon (background, mark, markSize) and splash (background, mark, markWidth)
├── brand.ts / emit.ts / png.ts   the generator (`bun run brand`, @resvg/resvg-js)
├── brand.gen.json   generated: resolved hex, input hash, a hash per output
├── index.ts         `brand` for code (mobile's BrandSplash)
└── brand.test.ts    outputs current and untouched, PNG sizes/alpha, ICO entries, manifest

apps/web/
server.ts            Express server entry. Bun runs this in dev and prod.
server/
├── env.ts           zod-validated env at import time + optionalSecret / requireEnv / hasEnv (rule 6)
├── access.ts        SIGNUP_ALLOWLIST / ADMIN_EMAILS checks (+ test) (rule 25)
├── asset-path.ts    isAssetPath(): which paths 404 before SSR (+ test)
├── logger.ts        color request logging, startup banner, error formatting
├── prisma.ts        PrismaClient singleton (survives HMR; pg adapter)
├── auth.ts          better-auth instance + Session type; sign-up hook enforces the allowlist
├── trpc.ts          Context { session, isAdmin }, contextFor, public/protected/adminProcedure
├── router.ts        appRouter (exports AppRouter type for the client)
└── demo.ts          the Post demo router (+ demo.test.ts, the fork gate) (rule 24)

src/
├── index.tsx              client entry (hydrateRoot + createBrowserRouter with getContext)
├── entry-server.tsx       SSR entry (createStaticHandler + RouterContextProvider + renderToString)
├── App.tsx                top-level providers
├── app/
│   ├── routes.tsx         RouteObject[] tree + loaders (+ ErrorBoundary on root)
│   ├── layout.tsx         root layout (nav + <Outlet />, sign-out)
│   ├── error-boundary.tsx 404 + error UI (root route ErrorBoundary)
│   ├── home.tsx           /
│   ├── sign-in.tsx        /sign-in
│   ├── sign-up.tsx        /sign-up
│   └── dashboard.tsx      /dashboard (the signed-in page)
├── components/
│   ├── kickoff-ribbon.tsx dev-only "Kickoff pending" bar while project.json look is null
│   ├── demo/              posts-demo + template-demo-bar (deleted by demo:drop)
│   └── ui/                shadcn primitives on Base UI
├── lib/
│   ├── auth-client.ts     better-auth React client (signIn, signUp, useSession, signOut)
│   ├── crowsnest.ts       cnEvent(): typed Crow's Nest custom events
│   ├── loader.ts          requireSession / redirectIfSignedIn / safeNext / nextFromSearch (rule 26)
│   ├── router-context.ts  typed loader context (clientsContext, sessionContext) + browserContext()
│   ├── ssr-state.ts       superjson (de)serialization of the dehydrated React Query cache (SSR → client)
│   ├── trpc.tsx           TRPCProvider, useTRPC, getBrowserClients() (browser QueryClient + tRPC singletons)
│   └── utils.ts           cn re-export (shadcn's `cn` package)
└── styles/app.css         Tailwind v4 + @app/tokens (theme.css, tokens.css) + font mapping + base layer

public/                favicon.svg, apple-touch-icon.png, icon-192/512.png, manifest.webmanifest (all from
                       `bun run brand`), robots.txt
e2e/                   smoke + auth-next + demo specs, committed __screenshots__; db.ts = the isolated test DB URL
index.html             Vite entry HTML: stylesheet <link>, icon + manifest links, Crow's Nest tag, placeholders
vite.config.ts         `~` alias, React Compiler, themeMeta (color-scheme + theme-color), noTemplateDemo gate
prisma/schema.prisma   DB schema (User/Session/Account/Verification + the demo's Post)
prisma/migrations/     committed migrations — the only way schema reaches a database (Hard rule #15)
prisma.config.ts       Prisma 7 CLI config — loads the root .env itself (see Hard rule #12)
server/generated/      prisma-client generator output (gitignored; postinstall / db:generate)
```

## Hard rules

1. **Path alias is `~/*` → `src/*`** (client only). Defined in both `tsconfig.json` and `vite.config.ts` (`resolve.alias`). Server code under `./server/` uses relative imports.

2. **Server-only modules: anything under `./server/`.** These import secrets, the Prisma client, or Node-only deps. **Never import them from a `.tsx` file under `src/`** — that file ends up in the client bundle. The one exception is **type-only** imports: `src/lib/trpc.tsx` does `import type { AppRouter } from '../../server/router'` (and mobile does `import type { AppRouter } from '@app/web/router'`), which is erased at build time. Anything else from `./server/` is server-only.

3. **There is no file-based routing.** Routes are explicit `RouteObject[]` entries in `src/app/routes.tsx`. Add a new route by creating a component file in `src/app/<name>.tsx` and adding `{ path: '<name>', Component: <Component> }` to the tree.

4. **Server entry vs client entry, one loader context.** `src/entry-server.tsx` runs under `vite.ssrLoadModule` in dev and as a built bundle under `./dist/server/entry-server.js` in prod — it exports `render(req)`. `src/index.tsx` runs in the browser and is loaded via `<script type="module" src="/src/index.tsx">` in `index.html`. Both wrap the app with `<App>` so providers (QueryClient, TRPC) are the same on both sides. Loaders get one typed context on both sides:
   - `entry-server.tsx` fills a `RouterContextProvider` per request: `clientsContext` = the request's QueryClient + a tRPC proxy that calls the router directly with `contextFor(session)`; `sessionContext` = the request's session.
   - `index.tsx` passes `getContext: browserContext` to `createBrowserRouter`: the browser singletons, plus the session fetched lazily, at most once per navigation.
   - Read them with `context.get(clientsContext)` / `await context.get(sessionContext)()`, or `requireSession(args)` from `src/lib/loader.ts`. Never branch a loader on `typeof window`.
   - `getContext` makes every navigation start async: `await navigate(...)` before `revalidator.revalidate()`, or the revalidate re-runs the current page's loaders (sign-out landed on `/sign-in` that way).

5. **API routes are Express mounts in `server.ts`** — not file-based:
   - `app.all('/api/auth/*splat', toNodeHandler(auth))` — better-auth (Express 5 named-wildcard syntax)
   - `app.use('/api/trpc', createExpressMiddleware({ router: appRouter, createContext }))` — tRPC
     If you add a new HTTP endpoint, mount it in `server.ts` BEFORE the final SSR handler (`app.use(async (req, res) => …)`) or it'll be swallowed. That handler short-circuits to a fast 404 for non-GET requests, asset paths (`server/asset-path.ts`: a known extension like `/favicon.ico`, `.map`, a `.php` probe), and unknown `/api/*` (JSON) — every other GET reaches the React renderer, dotted page paths (`/u/ada.lovelace`) included. SSR returns `routerContext.statusCode`, so unmatched routes get a real 404. `/healthz` (DB ping) is mounted up top.

6. **Env vars are zod-validated at import time** (`server/env.ts`). Any new required env var must be added there AND to `.env.example` AND to the Drydock portal (Project → Environment → Apply + redeploy). If `env.ts` throws, the server won't start — that's the design. **Third-party keys are optional at boot**, so a deploy never fails before a key is set: add `X: optionalSecret` to `optionalKeys` in `env.ts` (the `add:*` recipes do this; blank and unset both mean "not configured") and read it where it's used with `requireEnv('X')`, which throws `MissingEnvError` ("X is not set. Add it in Drydock → Project → Environment…"). `hasEnv('X')` for feature flags.

7. **better-auth's required schema lives in `prisma/schema.prisma`** (`User`, `Session`, `Account`, `Verification` models — mapped to lowercase tables via `@@map`). better-auth's `prismaAdapter` queries by camelCase Prisma field name, so don't rename fields without checking better-auth's docs. The snake_case `@map(...)` annotations are cosmetic — they preserve the column layout from the prior Drizzle schema.

8. **shadcn primitives are Base UI** (`components.json` style `base-nova`). There's no `asChild`/Slot. To render a primitive as another element use Base UI's `render` prop (`<Button nativeButton={false} render={<Link to="/x" />}>`), or put `buttonVariants()` on the element (`<Link className={buttonVariants()}>`, see `error-boundary.tsx`). Base UI's Button defaults to `type="button"`: pass `type="submit"` in forms. `bunx --bun shadcn@latest add <name>` output (which imports `cn` from `cn`) is used as written. Never add `@radix-ui/*` alongside.

9. **The stylesheet is linked from `index.html`, never imported from JS.** `<link rel="stylesheet" href="/src/styles/app.css">` is render-blocking in dev (Vite serves it as compiled CSS and HMR swaps the href) and gets content-hashed into `<head>` by `vite build`. Importing CSS from a component made Vite inject it only after the client module graph loaded, so every dev load painted unstyled SSR HTML first. Don't add `import './x.css'` to components — `@import` it from `app.css`.

10. **One theme, no dark mode, ever.** The look is `packages/tokens/tokens.css` (one `:root`); its `color-scheme` equals `project.json` `look.scheme`, and `vite.config.ts` injects `color-scheme` + `theme-color` from them. There is no `.dark` class, no toggle, no `prefers-color-scheme`, and `dark:` classes never match (`theme.css` redefines the variant). Don't add any of it back, on any surface. A color change is a `tokens.css` value + `bun run tokens` (then `bun run brand`, which reads the same roles); code that needs hex imports `colors` from `@app/tokens`.

11. **Dev is one port.** Vite's HMR websocket rides on the Express `http.Server` (`hmr: { server: httpServer }` in `server.ts`). Don't give it a fixed port — two clones of this template running at once would fight over it and HMR would silently die.

12. **`.env` lives at the repo root and is loaded by `prisma.config.ts` itself.** `apps/web` scripts pass `--env-file=../../.env` (Bun only autoloads `.env` from the cwd). Bun loads `.env` into its own runtime but NOT into the Prisma CLI (a Node subprocess), and Prisma 7 dropped auto-loading — so the config reads `.env` manually with a safe fallback (`prisma generate` works before `.env` exists). Don't delete that block. Runtime `PrismaClient` gets the URL via the pg adapter in `server/prisma.ts`.

13. **Dev port is `PORT` (default `project.json` `apiPort`, 4780 in the template), never 3000.** It's validated in `server/env.ts`; `BETTER_AUTH_URL` defaults to `http://localhost:$PORT`. Every project gets its own distinct, uncommon port — `bun run init` derives one from the name (or `--port <n>`) and rewrites `4780` everywhere. Never use 3000/3001/5173/5174/8000/8080/4200/5000. Record the port in `cliffnotes.md`. Playwright e2e runs on apiPort + 3 (`e2e/db.ts`); Drydock injects its own `PORT`. Metro (mobile) runs on `metroPort` = apiPort + 1, the desktop renderer dev server on `desktopPort` = apiPort + 2.

14. **superjson end to end.** `initTRPC` and every client link (`src/lib/trpc.tsx`, the SSR proxy in `entry-server.tsx`, the `add:ws` `wsLink`) use `transformer: superjson` — add it to any new link or the wire breaks. The dehydrated SSR cache goes through `src/lib/ssr-state.ts` (superjson), never raw `JSON.stringify`, so prefetched `Date`s are `Date`s on first client render. Return `Date`s from procedures; format them deterministically (e.g. `toISOString()`, or a fixed `timeZone` in `Intl`) so SSR and client markup match.

15. **Schema changes are migrations, never `db push`.** Edit `schema.prisma` → `bun run db:migrate --name <what>` → commit `prisma/migrations/<ts>_<what>/`. Production (Drydock `predeploy`) and e2e (`global-setup.ts`) both run `prisma migrate deploy`. Anything Prisma can't model — extensions, exclusion constraints, FTS `tsvector` columns/triggers, expression/partial indexes — is **hand-written SQL in a migration** (see "Raw SQL in a migration").

16. **Types are the guardrail.** `strict` + `noUncheckedIndexedAccess` are on in every workspace (`tsconfig.base.json`) and the tsconfigs cover `e2e/`, `scripts/`, `recipes/` and the configs. No `any` (use `unknown` + narrowing, generics, zod at boundaries), no `as` casts to paper over a mismatch, no `!` where narrowing works. Example: React Router 8 types loader `context` as a `RouterContextProvider`, and the values come from typed `createContext` keys (`src/lib/router-context.ts`), never casts. The one `@ts-ignore` (the `dist/` import in `server.ts`) carries its reason.

17. **Mobile imports `@app/web` as `import type` or CSS only.** `import type { AppRouter } from '@app/web/router'` is the whole contract (tokens come from `@app/tokens` and brand colors from `@app/brand`, which any app may import). Never a runtime import of web or server code from `apps/mobile`. Shared runtime code (zod schemas, pure logic) goes in a `packages/shared` workspace the day a second consumer needs it. `apps/web` never imports from `apps/mobile`.

18. **Never hand-edit `apps/mobile/ios/` or `android/`.** They're generated by `expo prebuild --clean` (Continuous Native Generation) and gitignored. Native config goes in `app.config.ts` or a config plugin; Swift goes in `apps/mobile/modules/<name>/` (app-only) or `packages/<name>/ios/` (shared).

19. **React, Tailwind and the shared stack are pinned in the root `catalog`.** Workspaces depend on them as `"catalog:"`. React must equal the Expo SDK's React (one copy: `bun pm why react`; `bun run upgrade:expo` keeps them aligned). Uniwind is pinned exactly in `apps/mobile` and compiles with `@tailwindcss/node`; keep the catalog's `tailwindcss` / `@tailwindcss/vite` on the same version Uniwind depends on (4.3.3 now) so web, desktop and mobile compile with one Tailwind. There is no `lightningcss` override. Expo-managed native packages are added with `bunx expo install`, never a bare `bun add`.

20. **A native change means a new dev-client build.** JS (including worklets) hot-reloads; Swift, a native dependency, a config plugin, the icon/splash or `app.config.ts` native fields don't. Compare `bun run fingerprint` (in `apps/mobile`; ios + development by default, `--platform` / `--variant` for others) with the `fingerprint:` row on Home (dev only; it reads the hash the build wrote, `EXUpdates.bundle/fingerprint`). Different = rebuild: on Limrun for run and test (`lim xcode build`, the `limrun` skill), with expo-wsl-ios for Sal's device, with EAS for distribution; the Mac only for what those can't. Code moves between machines on a **branch**, never `master` (pushing `master` deploys web via Drydock).

21. **No hand-written Metro monorepo config.** `metro.config.js` is `withUniwindConfig(getDefaultConfig(__dirname), { cssEntryFile, dtsFile })` and nothing else. Expo resolves workspaces itself (SDK 52+); `watchFolders`/`nodeModulesPaths` hacks break it. No `babel.config.js` and no PostCSS config either (Uniwind needs neither).

22. **Identity lives only in `project.json`.** Name, scheme, bundle id, ports, db name, EAS project id + owner and Apple team id are read from it by `app.config.ts` (zod), `server/env.ts`, `server/auth.ts`, `scripts/*`. Don't hardcode them elsewhere. `.gitattributes` marks it (and `drydock.yaml`) `merge=ours` so a fork's identity survives `bun run sync`. `init` renames every `sal-starter` / `sal_starter` / `Sal Starter` string in tracked files, so a check that compares against the template's name stops working in the fork: key template-only behaviour off `project.json` `template: true` instead.

23. **Expo Router route files are one-line re-exports.** `apps/mobile/src/app/**` is file-based (the one exception to rule #3, decisions.md), so to keep "routes are data you can read": each route file is `export { XScreen as default } from '~/screens/x'`; screens live in `src/screens/`. Route groups are `(auth)` and `(app)` only. Layouts hold providers and the session guard (`Stack.Protected`, each with an explicit `redirectTo`), never data work. `typedRoutes` is on.

24. **The Post demo is template-only.** It's a reference (a table, a router, an SSR-prefetched page, an e2e flow), never a feature. It lives in its own files (`server/demo.ts` — the marker — and `demo.test.ts`, `src/components/demo/`, `e2e/demo.spec.ts`, `apps/mobile/src/components/demo/`) and in marked lines elsewhere (`server/router.ts`, `prisma/schema.prisma`, `src/app/dashboard.tsx`, `src/app/routes.tsx`, `apps/mobile/src/screens/home.tsx`). Two marker forms: a trailing `// demo` / `{/* demo */}` on one line, or a `demo:start` … `demo:end` block. **In JSX use block markers only**: a same-line `{/* demo */}` after an element leaves a stray text node on React Native. In a fork (no `template: true`) the `noTemplateDemo` Vite plugin fails `vite build` and `server/demo.test.ts` fails `bun run test` until `bun run demo:drop` runs. Copy the pattern into a real feature; never extend the demo.

25. **Who may sign up and who is admin.** `SIGNUP_ALLOWLIST` is a comma list of emails and `@domain` entries (blank = anyone; `@domain` matches that domain only, not subdomains). It's enforced server-side in better-auth's `databaseHooks.user.create.before` (`server/auth.ts`; logic in `server/access.ts`), which answers 403 `{ code: 'SIGNUP_CLOSED' }`; the sign-up forms show the server's message. `ADMIN_EMAILS` lists exact addresses (an `@domain` entry never makes anyone admin); those users get `ctx.isAdmin`, pass `adminProcedure` (signed out: UNAUTHORIZED, anyone else: FORBIDDEN) and may always sign up. A tRPC context is only ever built by `contextFor(session)` / `contextFromHeaders(headers)` in `server/trpc.ts`: HTTP, the SSR proxy and WebSocket adapters all go through it.

26. **Protected pages and `?next=`.** A protected route's loader calls `requireSession(args)` from `~/lib/loader`; signed out, it redirects to `/sign-in?next=<path+search>`. `/sign-in` and `/sign-up` use `redirectIfSignedIn` and keep `?next=` on their cross links. After sign-in or sign-up, navigate only to `nextFromSearch(search)` (it runs `safeNext`: same-site paths only, no `//host`, `/\host`, absolute URLs or control characters, encoded or not; default `/dashboard`). Never navigate to a raw `next`.

27. **Icons and splash are generated.** `packages/brand/mark.svg` + `brand.json` → `bun run brand` writes every icon, the splash mark, the favicon, `manifest.webmanifest` and the desktop `.png`/`.ico`, and records hashes in `brand.gen.json`. Never hand-edit or hand-drop an output: `brand.test.ts` fails. Rerun `bun run brand` after `bun run tokens` and after any change to the generator.

## Architecture flows

### Auth (browser → cookie → session)

1. User submits the sign-in form → `authClient.signIn.email({ email, password })` (browser).
2. better-auth client POSTs to `/api/auth/sign-in/email` → caught by `app.all('/api/auth/*splat', toNodeHandler(auth))` in `server.ts` → cookie set on the response. Sign-up runs the allowlist hook first (rule 25).
3. The form calls `revalidator.revalidate()` then `navigate(nextFromSearch(search))` (`?next=` or `/dashboard`). Revalidate re-runs loaders so the new session lands in route data.
4. On SSR, `entry-server.tsx` calls `auth.api.getSession({ headers })` once per request and sets it on the per-request `RouterContextProvider` (`sessionContext`) passed to `createStaticHandler.query(req, { requestContext })`. The root layout's loader returns `{ session }`; descendants read it via `useRouteLoaderData('root')`. **No client-side flicker** — the session is in the SSR HTML's RR hydration script and available on first paint.
5. On client navigations, `sessionContext`'s getter calls `authClient.getSession()` the first time a loader asks, at most once per navigation. Stale sessions never leak across pages.

### tRPC

1. Client component does `const trpc = useTRPC()` then `useQuery(trpc.posts.list.queryOptions())`.
2. Request hits `/api/trpc/posts.list?batch=1&input=...` → Express tRPC middleware in `server.ts` → `appRouter` in `server/router.ts`.
3. `createContext` (in `server/trpc.ts`) reads the session from the request headers and returns `contextFor(session)`: `{ session, isAdmin }`.
4. `protectedProcedure` throws `UNAUTHORIZED` if `ctx.session` is null; `adminProcedure` also throws `FORBIDDEN` unless `ctx.isAdmin`. `publicProcedure` doesn't check.

### SSR

1. Express catch-all handles non-`/api/*` requests.
2. In dev: `vite.transformIndexHtml(url, indexHtml)` then `vite.ssrLoadModule('/src/entry-server.tsx').render(req)`.
3. In prod: read pre-built `dist/client/index.html`, import `dist/server/entry-server.js`, call `render(req)`.
4. `render(req)` builds a Fetch `Request` from the Express `req`, runs it through `createStaticHandler(routes).query(...)` with the request's `RouterContextProvider` to execute loaders, then `renderToString` with `<StaticRouterProvider>`.
5. The HTML returned has `<!--app-html-->` swapped for the rendered React tree. The client then hydrates via `src/index.tsx` and `<RouterProvider router={createBrowserRouter(routes, { getContext: browserContext })} />`.

**SSR data hydration IS wired up**. The pipeline:

- `entry-server.tsx` creates a per-request `QueryClient` plus a server-side `createTRPCOptionsProxy({ router: appRouter, ctx: contextFor(session), queryClient })` — this proxy calls procedures **directly** (no HTTP), bypassing the network entirely.
- Both go on the request's `RouterContextProvider` as `clientsContext`. Loaders prefetch with `const { queryClient, trpc } = context.get(clientsContext); await queryClient.prefetchQuery(trpc.me.queryOptions())` (see `dashboardLoader` in `src/app/routes.tsx`, which runs `requireSession` and the prefetches in parallel).
- After the static handler resolves, `dehydrate(queryClient)` is serialized **with superjson** (`serializeSsrState` in `src/lib/ssr-state.ts`) into `window.__SSR_STATE__` via the `<!--app-state-->` placeholder in `index.html`.
- On the client, `index.tsx` runs `deserializeSsrState(window.__SSR_STATE__)` and feeds the result to `<HydrationBoundary>` in `App.tsx`. Components reading `useQuery(trpc.me.queryOptions())` get cached data instantly. No refetch, no flicker.

**Date handling note**: procedures return real `Date`s (superjson on the wire and in the SSR payload — `src/lib/ssr-state.test.ts` and the e2e smoke, through `me.createdAt`, prove a `Date` is still a `Date` after hydration). What must stay deterministic is the _formatting_: `toLocaleString()` without a fixed locale/timeZone differs between server and browser and React will warn about a hydration mismatch. Format with `toISOString().slice(0, 10)` or a fixed `timeZone`.

**Client-nav prefetch IS wired up too**: `src/lib/trpc.tsx` exports `getBrowserClients()` — lazy module singletons (`queryClient`, `trpcClient`, and a `createTRPCOptionsProxy` bound to them). `index.tsx` hands the same instances to `<App>`, and `browserContext()` puts them in `clientsContext`, so the same loader code prefetches on a client navigation — no "Loading…" flash, and no loader branches on where it runs.

### Logging & errors

`server/logger.ts` is dependency-free (ANSI, gated on TTY + `NO_COLOR`). `requestLogger` logs one line per request (`method · status · path · timing`, color-coded), skipping vite/HMR/asset noise in dev. `startupBanner` prints mode/URLs/db-host/routes on listen. Use `log.info/warn/error/success` for server-side messages and `formatError` for exceptions — don't sprinkle raw `console.log`. Client/loader errors surface through the root `ErrorBoundary` (`src/app/error-boundary.tsx`); it shows a 404 for `isRouteErrorResponse(err) && status === 404`, a stack in dev otherwise.

## Mobile (apps/mobile)

- **Talks to the web server.** Same `/api/trpc` and `/api/auth/*`; there is no second API. `src/lib/resolve-api-url.ts` (pure, tested) resolves the base URL, wrapped by `src/lib/api-url.ts`: `EXPO_PUBLIC_API_URL` if set, otherwise in `__DEV__` the LAN host from Metro's `hostUri` (IPv6 hosts keep their brackets) plus `project.json` `apiPort` (passed through `app.config.ts` `extra`), otherwise the deployed server `extra.apiUrl` (`https://<name>.dested.com`). Never a throw: an OTA bundle that can't start gets rolled back silently.
- **Auth.** `src/lib/auth-client.ts` = better-auth `expoClient` with SecureStore (cookie + cached session, so a cold start has no signed-out flash). The tRPC link sends the cookie as a `Cookie` header with `credentials: 'omit'`. Server side, `server/auth.ts` has `plugins: [expo()]` and `trustedOrigins` for the app schemes (`exp://` dev only). A refused sign-up is `error.code === 'SIGNUP_CLOSED'` (status 403); show `error.message`.
- **Root layout.** `GestureHandlerRootView` → `KeyboardProvider` → React Query/tRPC → navigation `ThemeProvider` (`src/lib/nav-theme.ts`, from `colors`; dark = `look.scheme`) → StatusBar, Stack, sonner-native `Toaster`, `KickoffRibbon`; then `<BrandSplash ready onGone />` last, rendered from the first frame. The native splash is held until BrandSplash has drawn its exact copy and hides it; BrandSplash leaves once the cached session and the fonts (`src/lib/fonts.ts` `FONTS`) are ready. The Stack mounts only after the session resolves, so the guard never flashes the wrong side.
- **Screens use `Screen`** (`src/components/screen.tsx`): safe area (`edges`), background, scroll and keyboard avoidance (react-native-keyboard-controller). Don't hand-roll SafeAreaView + ScrollView + KeyboardAvoidingView.
- **Button** (`src/components/ui/button.tsx`): light haptic + Reanimated press scale (skipped with reduced motion). Never give a Pressable a `({ pressed }) => …` style function next to `className`: Uniwind drops the className.
- **Icons:** `lucide-react-native` (same names as web's `lucide-react`); color from `colors.<role>` (the `color` prop takes hex).
- **Fonts:** `bunx expo install @expo-google-fonts/<family>`, add the weights to `FONTS` in `src/lib/fonts.ts`, map them in `global.css` `@theme` (one family name per weight). Runtime-loaded, so a font swap is JS-only (hot reload / OTA).
- **Variants.** `APP_VARIANT` = development / preview / production picks name, bundle id / Android package (`.dev`/`.preview`) and scheme, so all three installs coexist. `bun run dev` serves Metro as `development` to match the dev client. At runtime the variant and scheme come from the installed binary's bundle id (`variant` / `appScheme` in `src/lib/app-config.ts`), never from the JS bundle, so one update bundle is valid in preview and production.
- **EAS project.** `init --mobile` runs `scripts/eas-setup.ts` (rerun: `bun run --cwd apps/mobile eas:setup`): it creates or links `@<easOwner>/<name>` (project.json `easOwner`, default quickgame), writes `easProjectId`, sets `APP_VARIANT` per EAS environment and protects the production channel. It drives eas-cli from a throwaway folder with a static `app.json` (decisions.md). `--no-eas` skips it; `--dry-run-eas` prints the commands. Without eas-cli or a login it prints the command for later and init carries on. It refuses to run in the template (exit 2).
- **EAS Update lanes.** `bun run ota:preview --message "…"` publishes to the preview channel; test it on a preview build; `bun run ota:promote` republishes that exact update to production (`eas update:republish`, no rebuild); `bun run ota:prod --message "…"` publishes straight to production (hotfix). Each script sets `APP_VARIANT` itself: `eas update` never reads eas.json's build `env`. The runtimeVersion is the fingerprint; `fingerprint.config.js` names SDK 58's `balanced` preset (node_modules hashed by `name@version`), which keeps it identical locally and on EAS, and eas.json's `bun` equals the local Bun. Check `eas fingerprint:compare --build-id <id>` before the first update to a new build.
- **OTA policy.** `src/lib/ota.ts` reloads into a new update at once on launch and on resume (decision Q3). A critical flow (a game round, a checkout) wraps itself in `useOtaHold(true)`; the update applies when the last hold releases. The root layout holds it while the splash is up.
- **Android.** `android.package` is the bundle id plus the variant suffix, with adaptive + monochrome icons from `bun run brand`. `build:android:dev|preview|prod` (apk for dev and preview, aab for production), `submit:android:prod`.
- **Styling.** Uniwind: `global.css` imports `tailwindcss`, `uniwind`, then `@app/tokens/theme.css` and `tokens.css`; Uniwind compiles it to native styles at bundle time (the token `var()` chain resolves to the same hex as `colors.json`). It binds `className` on react-native's own components only: a third-party view needs `withUniwind` (SafeAreaView: import it from `src/components/safe-area-view.tsx`, never from `react-native-safe-area-context`). `uniwind-types.d.ts` is generated by Metro (committed, prettier-ignored). One scheme: `app.config.ts` sets `userInterfaceStyle` from `look.scheme` and the splash from `brand.gen.json`; `_layout.tsx` pins `Uniwind.setTheme(look.scheme)` so the OS never flips it, paints the root view and stack with `colors.background` and fixes the status bar; `dark:` and Uniwind's `light:` never match. Never `useColorScheme`. UI primitives in `src/components/ui/` mirror web's cva variants.
- **Types.** `expo-types.d.ts` (committed) references `expo/types` (`require<T>()`, `EXPO_PUBLIC_*`); `expo-env.d.ts` is Metro's gitignored copy, so a fresh clone typechecks without Metro having run.
- **React Query on native.** `src/lib/query-rn.ts` wires `focusManager` to AppState and `onlineManager` to expo-network.
- **Native code.** `modules/app-native` (local Expo module) stays in forks. `packages/native-example` (workspace package + typed config plugin with committed `plugin/build`) is the template's demo: `init --mobile` drops it (with `src/components/native-example-row.tsx`) unless `--native-example`, and `sync` keeps it dropped. Both use `requireOptionalNativeModule` so a stale dev client renders a hint instead of crashing.
- **Machines.** Windows/WSL: editor, Postgres, `bun run dev` (API + Metro). Run and test on Limrun (the `limrun` skill: `lim xcode build`, then a simulator with a tunnel to Metro + API). Sal's iPhone: expo-wsl-ios (`npx expo-wsl-ios run`). Distribution: EAS (`build:*`, `ota:*`). The Mac (`ios:prebuild`, `ios:device`) only for what those can't do.
- **Upgrading Expo.** `bun run upgrade:expo [--check] [--sdk <n>] [--json]` (the `upgrade-expo` skill for a major). It respects the 3-day release age, lists what's blocked and when it clears, aligns the catalog React, and says from the fingerprints whether the dev client needs a rebuild.
- **Fork gotchas.** Stacks keep `fullScreenGestureEnabled: false` (iOS 26 otherwise turns any sideways drag into go-back). App Store Connect can reject an upload for a missing `NSMicrophoneUsageDescription` when a linked SDK references the mic API, even if the app never records: add a plain "never uses the microphone" string. Expo runs config-plugin mods last-registered first: a plugin whose Info.plist mod must run after `expo-build-properties` is listed before it.
- **Checks.** `bun run doctor` (expo-doctor + `expo-modules-autolinking verify`), `bun run test` (`bun test src`), `bunx expo export --platform ios` (bundles without a device). No linter, no `expo lint`.

## Desktop (apps/desktop)

- **Shape.** electron-vite 6 builds three targets: `src/main` (Node: lifecycle, window, the tRPC router), `src/preload` (only `exposeTrpcIpc()`), `src/renderer` (React 19 + Tailwind 4 + TanStack Query, React Compiler on). Everything is bundled (all deps are devDependencies), so the packaged app ships no `node_modules`. Rollup options are `rolldownOptions`.
- **API = tRPC over IPC.** `@app/trpc-ipc` (packages/trpc-ipc): `createIpcHandler` in main, `exposeTrpcIpc` in preload, `ipcLink` in the renderer, one channel `trpc`. Queries, mutations and async-generator subscriptions; an AbortSignal cancels; unsubscribing returns the generator. **No superjson**: structured clone carries Date/Map/Set. The router uses `initTRPC.create({ transformer: ipcTransformer })`, an identity transformer whose only job is to make tRPC type outputs as real Dates instead of JSON strings. Never add superjson to this link.
- **Nothing refetches on its own.** The QueryClient has `staleTime: Infinity`, no refetch on focus/reconnect, no retry. Invalidate after actions.
- **State lives in the repo.** `userData`, `sessionData`, `crashDumps`, `logs` are pinned to `<repo>/data/.private/electron` (`__DATA_DIR__`, baked in at build), never `%APPDATA%`. Window bounds are saved there and restored only while on a connected display.
- **Security.** `contextIsolation`, `sandbox`, no `nodeIntegration`; the preload is CommonJS (sandbox requirement) and tiny; the CSP meta tag is strict in builds and relaxed in dev for Vite (`electron.vite.config.ts`); external links open in the OS browser and the window never navigates away.
- **Single instance.** A second launch focuses the running window and forwards argv + cwd (the `launches` subscription).
- **Icon.** `build/icon.png` (window, Linux) and `build/icon.ico` (Windows) come from `bun run brand`; main imports the PNG as `?asset`, `scripts/release.ts` hands both to electron-builder.
- **Ship.** `bun run release` → `release/win-unpacked/<name>.exe` (`linux-unpacked` when run in WSL; gitignored). No installer, no auto-update. `scripts/release.ts` passes the installed Electron version to electron-builder (it can't read `catalog:`). Electron versions newer than three days are blocked by the bunfig `minimumReleaseAge`.
- **One theme.** The window's `backgroundColor` is `colors.background` from `@app/tokens` (no `nativeTheme`), so it opens in the look's color with no flash; the renderer has no theme code. UI primitives are copies of web's (Base UI, `cn`).
- **Desktop-only forks** have no web server, database, auth or `drydock.yaml`. If one needs data, it talks to its web app's tRPC, which owns Postgres.

## Common tasks

### Start a fork

```bash
git clone https://github.com/dested/sal-starter.git <name> && cd <name>
git remote rename origin upstream && bun install
bun run init <name> [flags]
```

| flag               | effect                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| (none)             | web only                                                                                                                              |
| `--mobile`         | keep `apps/mobile`; creates the EAS project (`eas-setup.ts`) and drops `packages/native-example`                                      |
| `--native-example` | with `--mobile`: keep `packages/native-example`                                                                                       |
| `--no-eas`         | with `--mobile`: skip the EAS project (later: `bun run --cwd apps/mobile eas:setup`)                                                  |
| `--dry-run-eas`    | with `--mobile`: print the EAS commands instead of running them                                                                       |
| `--desktop`        | keep `apps/desktop` next to web                                                                                                       |
| `--desktop-only`   | only the Electron app: no web server, database or auth                                                                                |
| `--no-auth`        | no accounts: drops better-auth, sign-in/up and the auth tables from web (and mobile); posts stay, anonymous, on a public `/dashboard` |
| `--port <n>`       | base port (API n, Metro n + 1, desktop n + 2, e2e n + 3); default derived from the name                                               |
| `--fresh-git`      | new history: no `sync`, no `add:*` from upstream                                                                                      |

Then follow init's next steps: `createdb`, `bun run db:migrate`, `/kickoff`, `bun run demo:drop`. `bun scripts/no-auth.ts --check` keeps the no-auth edits honest (run it after editing any file it lists). `sync` keeps a no-auth fork's auth files deleted (it detects one by `apps/web/server/auth.ts` being gone).

### Add a route

Create `src/app/<name>.tsx` exporting a `<NamePage>` component. Add it to `src/app/routes.tsx`:

```ts
{ path: '<name>', Component: NamePage, loader: nameLoader }
```

A protected page's loader starts with `await requireSession(args)` (rule 26). A data page prefetches through `context.get(clientsContext)`, which works on both sides. Nested paths work the same as standard RR — see https://reactrouter.com/start/data/routing.

### Add a tRPC procedure

In `server/router.ts`, add to the `appRouter` tree. Choose `publicProcedure`, `protectedProcedure` or `adminProcedure`. Validate inputs with zod. Return data — don't `Response.json`. Type flows automatically to the client via `AppRouter`.

### Add a DB table

1. Edit `prisma/schema.prisma` (FK relations to `User` should be `onDelete: Cascade`).
2. `bun run db:migrate --name add_my_model` — generates `prisma/migrations/<ts>_add_my_model/migration.sql`, applies it to your dev DB, and regenerates the client. **Read the SQL** and commit the folder with the schema change.
   In an agent shell `prisma migrate dev` refuses (non-interactive). Instead, with the dev DB at the latest migration, in `apps/web`: `mkdir -p prisma/migrations/<YYYYMMDDHHMMSS>_<name> && bun run db:migrate:sql -o prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql` (the diff from the dev DB to the schema), read the SQL, then `bun run db:deploy && bun run db:generate`.
3. Use it in tRPC procedures: `prisma.myModel.findMany(...)`. e2e's global-setup truncates every table, so a new model needs no e2e change.

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

### Drop the demo

`bun run demo:drop` (`--dry-run` lists the changes, `--check` exits 1 while the demo is present; in the template itself it refuses with exit 2, since the template keeps the demo). It deletes the demo files, strips the markers, writes `prisma/migrations/<ts>_drop_post_demo/migration.sql` (`DROP TABLE IF EXISTS "post"`) and runs `db:generate`. Then `bun run db:deploy`, `bun run typecheck`, `bun run test:e2e:update`. Keep the pattern (`me` prefetched in `dashboardLoader`) for the first real feature.

### Add AI, WebSockets or a job queue

`bun run add:ai` · `bun run add:ws` · `bun run add:jobs` (each takes `--help`, `--dry-run`, `--no-check`). A recipe copies its files into `apps/web`, installs its deps, makes anchored edits (or prints the change to make by hand), formats, and typechecks. Running it again is a no-op, and it never commits: review the diff.

- **ai:** `server/ai/claude.ts`. `generate({ label, system, prompt, schema, fake })` returns zod-checked data and logs cost. `ANTHROPIC_API_KEY` comes from `keys new anthropic --project <name>`; `AI_FAKE=1` (on in e2e) returns each call's `fake`. Default model `claude-opus-5-5`.
- **ws:** `server/upgrades.ts` (`onUpgrade(path, handler)`, coexists with Vite HMR) and tRPC subscriptions on `/api/trpc-ws` (`splitLink` sends subscriptions to a lazy superjson `wsLink`). Write subscriptions as async generators and use them with `useSubscription(trpc.x.subscriptionOptions())`.
- **jobs:** a Postgres `job` table. Define jobs with `defineJob(kind, schema, handler)` and enqueue with `.enqueue(data, { key, runAfter, tx })`. Delivery is at least once, so handlers must be safe to run twice. The runner starts after listen and stops on SIGTERM (`server/shutdown.ts`). Then `bun run db:deploy` and commit `prisma/migrations/*_add_job_queue`.

### Add a shadcn component

```bash
bunx --bun shadcn@latest add <name>
```

It writes Base UI (base-nova) components to `src/components/ui/`. Their `import { cn } from "cn"` works as is (`~/lib/utils` re-exports the same function). Then restyle to `ui.md`.

### Change the look

Edit values in `packages/tokens/tokens.css` (the one `:root`), then `bun run tokens` (regenerates `colors.json`), `bun run brand` and `bun run test`. Switching light ↔ dark means rewriting the palette and setting both `color-scheme` there and `project.json` `look.scheme`; the test fails if they differ. A new role: map it in `theme.css`, give it a value in `tokens.css`. Fonts: `@fontsource-variable/*` imported in `app.css`, then `--font-body` / `--font-heading` in `tokens.css` (mobile: `FONTS` in `src/lib/fonts.ts`). Follow `ui.md`.

### Change the icon or splash

- Edit `packages/brand/mark.svg` (one color, `fill="currentColor"`, a viewBox drawn tight to the glyph) or `brand.json` (token roles: icon background/mark/markSize, splash background/mark/markWidth).
- Then `bun run brand`, then `bun run test`. It writes the iOS icon, the splash mark, the Android adaptive and monochrome icons, `favicon.svg`, the apple-touch and PWA icons, `manifest.webmanifest` and the desktop `icon.png`/`icon.ico`, for whichever apps exist.
- A new icon or splash is a native change (new dev-client build). Mobile code reads the colors with `import { brand } from '@app/brand'`.

### Upgrade Expo

`bun run upgrade:expo --check` shows the newest installable patch and what the release age still blocks (exit 3 when an upgrade is available). `bun run upgrade:expo` applies it; `--sdk <n>` moves to a new major (follow the `upgrade-expo` skill: changelog first, Uniwind floor). It ends by saying whether the native fingerprint changed; if so, rebuild the dev client (rule 20).

### Add an env var

`server/env.ts` (zod schema; a third-party key goes in `optionalKeys` as `optionalSecret`, rule 6) → `.env.example` (placeholder) → Drydock portal (Project → Environment → Apply + redeploy). Drydock seeds `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` itself.

### Add an e2e test

Specs live in `e2e/*.spec.ts` (Playwright). Tests run against an isolated DB on apiPort + 3 (4783 here): `e2e/db.ts` takes the dev `DATABASE_URL`'s server and credentials and swaps the database for `<project.json db>_test` (`sal_starter_test`); override with `E2E_DATABASE_URL` (the name must end in `_test`). Playwright starts the server first (its readiness probe is `/robots.txt` over `[::1]`, a static file, so a fork whose test DB doesn't exist yet still boots); `e2e/global-setup.ts` then creates the DB if missing, runs `prisma migrate deploy` on it and truncates every table so screenshots are deterministic. The screenshot tolerance is 0.2% of pixels: a mostly white page differs from a different page by under 2%. Add visual coverage with `await expect(page).toHaveScreenshot('name.png')` on a STABLE view (no dynamic dates/ids), then `bun run test:e2e:update` to write the baseline (committed under `e2e/__screenshots__/`). Run with `bun run test:e2e`. Don't screenshot pages with per-run dynamic content unless you mask it.

## Build / verify

```
bun run typecheck   # tsc --noEmit (TypeScript 7) in the root (scripts/, recipes/) and every workspace
bun run test        # bun:test unit tests in every workspace (a fork fails here until the kickoff and demo:drop)
bun run build       # vite build (client) + vite build --ssr (server) → dist/client + dist/server (a fork fails while the demo is present)
bun run test:e2e    # Playwright against the isolated, migrated test DB on :4783 (apiPort + 3)
bun run dev         # web: bun --watch server.ts → http://localhost:4780 (HMR on the same port) + Metro on 4781 if apps/mobile exists
bun run start       # NODE_ENV=production bun server.ts
```

A change isn't done while `typecheck` is red. If you edit `prisma/schema.prisma`, `bun run db:migrate` regenerates `@prisma/client` (or `bun run db:generate` alone). `verify.md` has the full recipes.

## Production server

Same `server.ts` runs in dev and prod, gated on `NODE_ENV`. In prod it:

- Skips the vite dev server.
- Serves `dist/client/` via `express.static` (with `compression()`).
- Reads pre-rendered `dist/client/index.html` for the template.
- Loads the SSR bundle at `dist/server/entry-server.js`.

The `// @ts-ignore` on that dist import is intentional — the file doesn't exist before first build.

## Drydock deploy gotchas

- Only `apps/web` deploys. `drydock.yaml` (root) sets `rootDir: apps/web`, `workspace: "@app/web"` (Drydock installs from the root `bun.lock` with `--filter`), `kind: ssr`, `runtime: bun`, `build: bun run build`, `start: bun run start`.
- `predeploy: bun run db:deploy` applies committed migrations only, with the workspace's pinned Prisma CLI. Never let it fall back to Drydock's `db push --accept-data-loss` default.
- `start` must not use `--env-file`: prod env comes from Drydock (it seeds `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`). Use `bun run start:local` to run a prod build against the local `.env`.
- A fork's build fails while the Post demo is present (rule 24), so it can't deploy until `bun run demo:drop`.
- Every push to `master`/`main` redeploys web, even for mobile-only commits. The container disk is wiped on every deploy.

## Versions to be aware of

- React Router 8.5 (`react-router`; `react-router-dom` no longer exists). `RouteObject` uses `Component` / `ErrorBoundary`. Middleware and `RouterContextProvider` context are always on. Route `middleware` runs in the browser; the static handler runs it only with `generateMiddlewareResponse`, which `entry-server.tsx` doesn't pass.
- Vite 8.3 (Rolldown) + @vitejs/plugin-react 6. React Compiler via `@rolldown/plugin-babel` + `reactCompilerPreset` (plugin-react's Rust `compiler` option is experimental). Rollup options are `rolldownOptions`. electron-vite 6 (Vite 8).
- Tailwind v4 uses `@import 'tailwindcss'` (not `@tailwind base/components/utilities`). Theme tokens go in `@theme inline { ... }`. There is no `tailwind.config.ts`.
- shadcn on Base UI 1.9 (`@base-ui/react`, catalog). `cn` 0.5 on web and desktop (shadcn's, replaces clsx + tailwind-merge); mobile keeps tailwind-merge 3 + clsx.
- Prisma 7.10 — `prisma` CLI and `@prisma/client` MUST stay in lockstep (`~7.10.1` in the catalog). npm `latest` is the Prisma 8 RC (a rewrite: no `PrismaClient`, `Temporal` dates, no better-auth adapter), so run the CLI through `bun run db:*` scripts, never `bunx prisma` / `bun add prisma` outside the catalog. Sessions are pinned to UTC in `server/prisma.ts`. Uses the `pg` driver adapter and the `prisma-client` generator (output `server/generated/prisma`, import from `./generated/prisma/client`).
- Express 5.x — required for the named-wildcard route syntax. Don't downgrade to Express 4.
- Bun 1.4. The repo `bunfig.toml` sets `minimumReleaseAge` (3 days), so a version younger than that won't install anywhere. A `bunx <pkg>@x` run outside the repo doesn't read it.
- Expo SDK 58 / RN 0.88.0 / React 19.3.0 (web and desktop share the catalog's React). Uniwind 1.13.0 (exact; 1.13.0 is the floor for RN 0.88, it forwards every react-native export). React Compiler is on (`experiments.reactCompiler`; babel-preset-expo carries the plugin). RN 0.88's strict TypeScript API is the default: no deep `react-native/Libraries/*` imports. The iOS scene delegate is generated by prebuild (no `enableSceneSupport`). Move to a new SDK in this template first (`bun run upgrade:expo --sdk <n>`), then forks pick it up with `bun run sync`.
- `bunx expo install --fix` asks Expo's API for the newest patch, which the 3-day `minimumReleaseAge` can block ("blocked by minimum-release-age"). Run it as `EXPO_OFFLINE=1 bunx expo install --fix` (what `upgrade:expo` does). `expo-doctor` checks the same API, so a patch younger than three days fails its version check until it clears the window.
- No `lru-cache` pin any more (decisions 2026-10-24). If Metro fails with `_lruCache is not a constructor`, a resolve hoisted lru-cache 11 over Babel's 5: add `lru-cache@5.1.1` back as an `apps/mobile` devDependency.
- better-auth and `@better-auth/expo` move in lockstep (both 1.7.12 in the catalog).
- zod 4 — top-level formats (`z.url()`, `z.email()`), `{ error }` for custom messages.
- superjson 2 — the tRPC transformer; in tRPC v11 it goes on each link (`httpBatchLink({ transformer })`) and in `initTRPC.create()`.

## Don't

- Don't add dark mode in any form: a `.dark` block, `prefers-color-scheme`, a theme toggle, `useColorScheme`, `nativeTheme`, `dark:` classes (rule 10).
- Don't add `tailwind.config.{js,ts}` — Tailwind v4 doesn't use it; tokens are in `packages/tokens`.
- Don't import server modules (`./server/*`) from anything under `./src/` except as `import type`. That file ends up in the client bundle and will either break the build or leak secrets.
- Don't add file-based routing back. The `RouteObject[]` in `src/app/routes.tsx` is the source of truth.
- Don't import `react-router-dom` (gone in v8), and don't branch a loader on `typeof window` (rule 4).
- Don't add `@radix-ui/*` or Slot: primitives are Base UI (`render` prop).
- Don't reach for `@trpc/react-query` (the old package) — we use `@trpc/tanstack-react-query` (the new one with `queryOptions()` / `mutationOptions()`).
- Don't build on the Post demo or ship it (rule 24), and don't key template-only behaviour off the project name (rule 22).
- Don't navigate to a raw `?next=` (rule 26), and don't build a tRPC context outside `contextFor` (rule 25).
- Don't hand-edit icons, the splash, the favicon or the manifest (rule 27).
- Don't commit `.env`, `dist/`, `node_modules/`, or Playwright run artifacts (`test-results/`, `playwright-report/`). They're in `.gitignore`. DO commit `e2e/__screenshots__/` baselines.
- Don't hand-edit anything under `apps/web/server/generated/`. Re-run `bun run db:generate` after schema changes.
- Don't add ESLint, `expo lint` or any linter. `tsc` is the gate, Prettier formats.
- Don't use Expo Go or write code that branches on it. The dev client is the only dev runtime.
- Don't `prisma db push`, and don't edit a migration that has already been applied anywhere shared — add a new one.
- Don't `bunx prisma`: outside the workspace it pulls npm `latest`, the Prisma 8 RC. Use the `bun run db:*` scripts.
- Don't run the dev server on 3000 (or 3001/5173/5174/8000/8080/4200/5000).
- Don't downgrade to Express 4 — the route wildcards (`*splat`) need Express 5.
- Don't sprinkle raw `console.log` in `./server/` — use `log.*` / `formatError` from `server/logger.ts` so output stays consistent.
