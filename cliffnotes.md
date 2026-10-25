# sal-starter — CliffNotes

> Living map of the project. Read this before any coding session.
> Last updated: 2026-10-25. Deep briefing → `CLAUDE.md` · human quickstart → `README.md`.

## What this is

An SSR React starter template, a Bun workspace with an optional Expo app (iOS + Android) and an optional Electron desktop app — clone it, run `bun run init <name> [--mobile] [--desktop | --desktop-only] [--no-auth]`, and build a real product on top. The whole point is a _minimal but bulletproof_ base: Express 5 + Vite 8 SSR, React Router 8, tRPC, Prisma 7, better-auth, Tailwind v4/shadcn on Base UI in `apps/web`; Expo SDK 58 + Expo Router + Uniwind in `apps/mobile`, talking to the same server; Electron 44 + electron-vite 6 in `apps/desktop`, with its own tRPC router over IPC. One mark generates every icon and splash (`packages/brand`). Keep files minimal; add features, don't gold-plate the scaffolding.

**Paths in the web sections below are relative to `apps/web/`** unless they start with `apps/`, `packages/`, `recipes/` or `scripts/`.

## Quick Reference

- **Ports:** API **4780** (web + `/api/*`), Metro **4781** (mobile only), desktop renderer **4782** (desktop dev only), Playwright e2e **4783** (apiPort + 3). All come from `project.json` (`apiPort`, `metroPort`, `desktopPort`); `init` picks a per-name base. Never 3000/3001/5173/5174/8000/8080/4200/5000
- **Dev:** `bun run dev` (root) → web on http://localhost:4780 (HMR shares the port) + Metro on 4781 if `apps/mobile` exists + the Electron window (renderer on 4782) if `apps/desktop` exists. `bun run dev web|mobile|desktop` for one
- **New project:** `git clone … <name> && git remote rename origin upstream && bun install && bun run init <name> [flags]` (flags: CLAUDE.md → Start a fork), then (web) `createdb <name>` → `bun run db:migrate` → `bun run dev`, then **the kickoff** (`.claude/skills/kickoff`, `/kickoff`) and **`bun run demo:drop`** before any feature: until `look` is set and the demo is gone, dev shows a "Kickoff pending" ribbon, `bun run test` fails and `bun run build` fails
- **Look:** ONE theme, no dark mode, no toggle. Values in `packages/tokens/tokens.css` → `bun run tokens` (regenerates `colors.json`) → `bun run brand` → `bun run test`
- **Brand:** `packages/brand/mark.svg` + `brand.json` → `bun run brand` → app icons, splash, favicon, manifest, desktop .ico (committed; `brand.test.ts` fails while stale)
- **Demo:** `bun run demo:drop` (`--check`, `--dry-run`) deletes the Post demo and writes the drop migration; the template keeps it (`project.json` `template: true`)
- **Server slots:** `bun run add:ai` · `add:ws` · `add:jobs` (`--help`, `--dry-run`; never commits)
- **Template updates:** `bun run sync` (merge `upstream/main`, never commits) · `bun run add:mobile` / `add:desktop` (bring a dropped app back)
- **Expo upgrades:** `bun run upgrade:expo --check` (newest patch inside the release age, what's blocked and when it clears; exit 3 = upgrade available) · `bun run upgrade:expo [--sdk <n>]`
- **Desktop release:** `bun run release` → `release/win-unpacked/<name>.exe` (`linux-unpacked` when run in WSL; unpacked, no installer)
- **Entry point:** `apps/web/server.ts` (Express; same file dev + prod) → SSR via `src/entry-server.tsx`; client hydrates via `src/index.tsx`. Mobile: `apps/mobile/src/app/_layout.tsx`
- **Type-check:** `bun run typecheck` (`tsc --noEmit`, TypeScript 7, root `scripts/` + `recipes/` + every workspace; `strict` + `noUncheckedIndexedAccess`)
- **Unit tests:** `bun run test` (`bun:test` in every workspace that has a `test` script)
- **Build:** `bun run build` → `apps/web/dist/client` + `dist/server`
- **E2E:** `bun run test:e2e` (Playwright; isolated DB `sal_starter_test` on the `.env` `DATABASE_URL` server, created + migrated + truncated by global-setup; :4783; committed screenshots)
- **Migrations:** `bun run db:migrate --name <what>` (dev) · `bun run db:migrate:create` (hand-written SQL) · `bun run db:migrate:sql -o <file>` (agent shells, where `migrate dev` refuses; CLAUDE.md → Add a DB table) · `bun run db:deploy` (prod/CI). Never `bunx prisma` (npm latest is the Prisma 8 RC)
- **Ship a mobile fix (OTA):** in `apps/mobile`: `bun run ota:preview --message "…"` → test on a preview build → `bun run ota:promote` (republishes that exact update to production). Hotfix straight to prod: `bun run ota:prod --message "…"`. Check `eas fingerprint:compare --build-id <id>` before the first update to a build. Run `eas` only in `apps/mobile`, never at the root
- **Mobile checks:** `bun run --cwd apps/mobile doctor` · `bun run --cwd apps/mobile test` · `bunx expo export --platform ios` (in `apps/mobile`) · `bun run --cwd apps/mobile fingerprint` (= Home's `fingerprint:` row)
- **Health:** `GET /healthz` (pings the DB)
- **Verification recipes:** `verify.md`
- **Day-one fact:** server-only code lives in `apps/web/server/` — never import it from `src/*.tsx` (or from mobile) except `import type`.

## Stack

| Layer              | Choice                           | Notes                                                                                                           |
| ------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Runtime / pkg mgr  | Bun 1.4, workspaces              | root `bun.lock`, hoisted linker, 3-day `minimumReleaseAge`, shared pins in the root `catalog`                   |
| Server             | **Express 5** + Vite 8 SSR       | required for `*splat` route wildcards                                                                           |
| Routing            | React Router 8                   | createBrowserRouter (client, `getContext: browserContext`) / createStaticHandler (server); typed loader context |
| State / data       | TanStack Query + tRPC v11        | `@trpc/tanstack-react-query` (`.queryOptions()`); **superjson** on the wire and in SSR state                    |
| Validation         | zod 4                            | env, tRPC inputs                                                                                                |
| API                | tRPC, Express mounts             | `/api/trpc`, `/api/auth/*`, `/healthz`                                                                          |
| Database / ORM     | Postgres + Prisma 7              | `pg` driver adapter (`@prisma/adapter-pg`); `prisma migrate`, committed migrations                              |
| Auth               | better-auth                      | email + password, autoSignIn; `SIGNUP_ALLOWLIST`, `ADMIN_EMAILS` + `adminProcedure`, `?next=`                   |
| Styling            | Tailwind v4 + shadcn (base-nova) | CSS-first, oklch tokens; Base UI primitives; `cn` from shadcn's `cn` package; see `ui.md`                       |
| Brand              | `packages/brand` (resvg)         | one mark → every icon, splash, favicon, manifest                                                                |
| React Compiler     | babel-plugin-react-compiler 1.0  | web + desktop via `@rolldown/plugin-babel` (client build only); mobile via babel-preset-expo                    |
| Tests              | Playwright + `bun:test`          | `e2e/` + committed `__screenshots__` baselines; unit `*.test.ts`                                                |
| Types              | TypeScript 7 `tsc`               | `tsconfig.base.json` shared by every workspace                                                                  |
| Deploy             | Drydock (`drydock.yaml`)         | `rootDir: apps/web`, `workspace: "@app/web"`, predeploy `bun run db:deploy`                                     |
| Analytics          | Crow's Nest                      | `<script defer src="https://cn.dested.com/cn.js">` in `index.html`; `cnEvent()` for custom events               |
| Mobile (optional)  | Expo SDK 58, RN 0.88, Router     | dev client only; Uniwind 1.13; better-auth Expo plugin; EAS for distribution (iOS + Android)                    |
| Desktop (optional) | Electron 44, electron-vite 6     | tRPC over IPC (`@app/trpc-ipc`), no superjson, no DB; electron-builder `--dir` releases                         |

## Directory structure

```
project.json             per-project identity (name, displayName, scheme, bundleId, appId, surfaces, apiPort, metroPort,
                         desktopPort, db, easProjectId, easOwner, appleTeamId, look; `template: true` in the template only)
package.json             workspace root: catalog, proxy scripts
bunfig.toml              linker = "hoisted", minimumReleaseAge = 259200 (3 days, in-repo so WSL/EAS/Drydock all get it)
tsconfig.base.json       shared strict compiler options
tsconfig.json            root typecheck: scripts/**, recipes/*.ts, recipes/*/recipe.ts (recipe files/ are checked by applying them)
drydock.yaml             deploy seed (merge=ours with project.json, see .gitattributes)
.easignore               EAS upload filter (replaces every .gitignore on EAS; keeps ios/, android/, plans out)
scripts/
├── init.ts              clone → rename, project.json, per-project ports, drops unwanted surfaces (own commit); --no-auth, EAS step
├── sync.ts              merge upstream/main without committing; keeps identity, lockfile, dropped surfaces, OPTIONAL_PATHS
│                        and a no-auth fork's NO_AUTH_PATHS dropped
├── add-surface.ts       `add:mobile` / `add:desktop`: copy a surface from upstream, restore its root scripts, commit
├── demo.ts              `bun run demo:drop [--check|--dry-run|--help]`: removes the Post demo + writes the drop migration
├── no-auth.ts           init --no-auth: checked edits that remove better-auth (`--check`); exports NO_AUTH_PATHS
├── eas-setup.ts         EAS project for mobile: create/link @<easOwner>/<name>, easProjectId, APP_VARIANT envs, protect production
├── upgrade-expo.ts      `bun run upgrade:expo [--check|--sdk n|--json]`: newest Expo inside the release age, catalog React, fingerprint diff
├── dev.ts               runs web + Metro (APP_VARIANT=development) + electron-vite, whichever exist
├── project.ts           zod schema for project.json, SURFACE_PATHS, SURFACE_SCRIPTS, OPTIONAL_PATHS, legacy-fork migration
└── shell.ts             git/run/fail helpers
recipes/                 add:* recipes: add.ts (runner), lib.ts (engine: copy, install, anchored edits), ai/ ws/ jobs/
                         (recipe.ts + files/), shared/ (server/shutdown.ts)
apps/mobile/             @app/mobile (optional; see Mobile below)
apps/desktop/            @app/desktop (optional; see Desktop below)
packages/tokens/         @app/tokens, used by every app: theme.css (Tailwind mapping, merges on sync), tokens.css (the look:
                         one :root, fork-owned), colors.json (generated hex) + index.ts (`colors`), css.ts/emit.ts, tokens.test.ts
packages/brand/          @app/brand: mark.svg + brand.json → bun run brand (resvg) → every icon/splash; brand.gen.json (hex + hashes),
                         brand.ts/emit.ts/png.ts (generator), index.ts (`brand`), brand.test.ts
.claude/skills/kickoff/  the kickoff skill (look → tokens, fonts, primitives, `/`, brand mark, ui.md, demo:drop, project.json look)
.claude/skills/upgrade-expo/  patch and major-SDK procedure + Limrun verify
packages/trpc-ipc/       @app/trpc-ipc: tRPC v11 over Electron IPC (main / preload / renderer entries + tests)
packages/native-example/ @app/native-example: Swift module + typed config plugin (plugin/build committed); template-only, init drops it

apps/web/                @app/web, the tree below
server.ts                Express entry: request logging, /healthz, auth + tRPC mounts,
                         vite (dev) / static+SSR (prod), startup banner. Dev AND prod.
server/
├── env.ts               zod-validated env (PORT, DATABASE_URL, BETTER_AUTH_*, SIGNUP_ALLOWLIST, ADMIN_EMAILS), parsed at import
│                        (throws → no boot); optionalSecret / optionalKeys / requireEnv / hasEnv (+ test)
├── access.ts            SIGNUP_ALLOWLIST + ADMIN_EMAILS checks: emailMatches, isAdminEmail, signUpAllowed (+ test)
├── asset-path.ts        isAssetPath(): known asset extensions 404 before SSR; dotted page paths render (+ test)
├── logger.ts            ANSI request logger, startup banner, formatError
├── prisma.ts            PrismaClient singleton (HMR-safe) via pg adapter, sessions pinned to UTC
├── auth.ts              better-auth instance + Session type; databaseHooks.user.create.before → 403 SIGNUP_CLOSED
├── trpc.ts              Context { session, isAdmin }, contextFor / contextFromHeaders, public/protected/adminProcedure
├── router.ts            appRouter (me with isAdmin, posts = demoRouter) + AppRouter type (exported as @app/web/router)
├── demo.ts              the Post demo router (posts.list, posts.create); the demo's marker file
├── demo.test.ts         fails in a fork until `bun run demo:drop`
└── generated/prisma/    prisma-client generator output (gitignored)
src/
├── index.tsx            client entry — hydrateRoot + createBrowserRouter(routes, { getContext: browserContext })
├── entry-server.tsx     SSR entry — RouterContextProvider per request + createStaticHandler.query + renderToString
├── App.tsx              providers: QueryClientProvider + HydrationBoundary + TRPCProvider
├── app/
│   ├── routes.tsx       RouteObject[] tree + loaders (context.get(...) and loader.ts helpers, same on SSR and browser)
│   ├── layout.tsx       nav + <Outlet/>; sign-out lives here (await navigate, then revalidate)
│   ├── error-boundary.tsx  root ErrorBoundary → 404 / error UI
│   ├── home.tsx         /
│   ├── sign-in.tsx      /sign-in (?next=)
│   ├── sign-up.tsx      /sign-up (?next=, shows the server's SIGNUP_CLOSED message)
│   └── dashboard.tsx    /dashboard (protected; the user's name as h1, `me` prefetched; + the demo block)
├── components/
│   ├── kickoff-ribbon.tsx dev-only "Kickoff pending" bar while project.json look is null
│   ├── demo/            posts-demo.tsx (list + create form), template-demo-bar.tsx ("Template demo · delete before shipping")
│   └── ui/              shadcn primitives on Base UI (button, card, input, label)
├── lib/
│   ├── auth-client.ts   better-auth React client
│   ├── crowsnest.ts     cnEvent(name, props): typed Crow's Nest custom events (no-op on the server)
│   ├── loader.ts        requireSession, redirectIfSignedIn, signInPath, safeNext / nextFromSearch, AFTER_SIGN_IN (+ test)
│   ├── router-context.ts  clientsContext, sessionContext (lazy, once per request/navigation), browserContext()
│   ├── trpc.tsx         TRPCProvider + useTRPC + getBrowserClients() (lazy browser QueryClient/tRPC singletons)
│   ├── ssr-state.ts     superjson (de)serialize of the dehydrated cache (+ ssr-state.test.ts)
│   └── utils.ts         cn re-export (shadcn's `cn` package)
└── styles/
    └── app.css          Tailwind v4 + @app/tokens theme.css/tokens.css + font mapping + base layer
public/                  favicon.svg, apple-touch-icon.png, icon-192/512.png, manifest.webmanifest (all `bun run brand`), robots.txt
e2e/                     smoke.spec.ts (routing, auth, 404, SSR Date via me.createdAt), auth-next.spec.ts (?next= round trip),
                         demo.spec.ts (posts flow), global-setup.ts (create DB, db:deploy, truncate every table),
                         db.ts (port + test DB URL from project.json), __screenshots__/
index.html               SSR template — Crow's Nest tag, stylesheet <link>, icon + manifest links, <!--app-html--> + <!--app-state-->
vite.config.ts           `~` alias, tailwind, react + React Compiler (babel), themeMeta (color-scheme + theme-color), noTemplateDemo
prisma/schema.prisma     User / Session / Account / Verification + the demo's Post (demo:start … demo:end)
prisma/migrations/       committed migrations (init + everything after); raw SQL lives here
prisma.config.ts         Prisma 7 CLI config; loads the root .env itself (Bun/Prisma don't)
```

```
apps/mobile/
├── app.config.ts        reads ../../project.json + packages/brand/brand.gen.json (zod); APP_VARIANT → name/bundle id/Android
│                        package/scheme; owner = easOwner; extra (apiPort, apiUrl, base scheme); plugins (expo-image, splash from
│                        brand, launch status bar from look.scheme); React Compiler; fingerprint runtimeVersion
├── eas.json             development / preview / production profiles, channels of the same names (bun 1.4.3 = local, node 22.22.2);
│                        Android apk for dev + preview, app-bundle for production
├── fingerprint.config.js `balanced` preset: native modules + node_modules plugins hashed by name@version, so local and EAS fingerprints match
├── expo-types.d.ts      committed reference to expo/types (require<T>, EXPO_PUBLIC_*); expo-env.d.ts is Metro's gitignored copy
├── scripts/fingerprint.ts `bun run fingerprint`: expo-updates hash per platform + variant (= Home's row; --platform, --variant, --json)
├── metro.config.js      withUniwindConfig(getDefaultConfig(__dirname), { cssEntryFile, dtsFile }), nothing else
├── global.css           tailwindcss + uniwind + @app/tokens theme.css/tokens.css; `light:` disabled; fonts go in @theme
├── uniwind-types.d.ts   generated by Metro (className types + theme names); committed, prettier-ignored
├── assets/              icon, splash-icon, adaptive-icon(+ monochrome): all from `bun run brand`
├── modules/app-native/  local Expo module (Swift nativeHello)
└── src/
    ├── app/             Expo Router: _layout (providers, BrandSplash, Stack.Protected with redirectTo), (auth)/, (app)/ — one-line re-exports
    ├── screens/         sign-in, sign-up, home (name + sign-out, the demo block, native examples + fingerprint row)
    ├── components/      screen (Screen: safe area, background, scroll, keyboard avoidance), brand-splash (BrandSplash: the JS hand-off
    │                    from the native splash and its exit; onGone), safe-area-view (withUniwind SafeAreaView), kickoff-ribbon,
    │                    native-example-row (init drops it), demo/posts-demo; ui/: button (haptic + press scale), card, input, label
    ├── lib/             api-url + resolve-api-url (env → LAN dev → deployed apiUrl; + test), auth-client (expoClient + SecureStore),
    │                    trpc, query-rn, app-config (validated extra + variant/appScheme from the native bundle id), fonts (FONTS),
    │                    nav-theme (navigation theme from colors), ota + ota-hold (useOtaHold; + test), build-fingerprint, utils
    └── env.ts           zod over EXPO_PUBLIC_API_URL
```

```
apps/desktop/
├── electron.vite.config.ts  main/preload/renderer builds; __DATA_DIR__; renderer port = desktopPort; CSP plugin; React Compiler
├── build/                   icon.png + icon.ico (from `bun run brand`)
├── scripts/release.ts       electron-builder --dir from project.json (appId, displayName, icons from build/) → <repo>/release
└── src/
    ├── main/            index.ts (lifecycle, pinned paths, single instance, window + icon via build/icon.png?asset, IPC handler),
    │                    router.ts (+ test), launches.ts (second-instance argv hub), window-state.ts (bounds), env.d.ts
    ├── preload/         index.ts: exposeTrpcIpc() only (built as CJS for the sandbox)
    └── renderer/        index.html (CSP meta, stylesheet link), src/{main.tsx, App.tsx (demo), lib/{trpc,utils}.ts,
                         components/ui/ (button, card, input, label mirrored from web), styles/app.css}
```

## File map (concept → path)

| Concept / task                    | Location                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| App providers                     | `src/App.tsx`                                                                                   |
| Routing + loaders                 | `src/app/routes.tsx`                                                                            |
| Loader context / auth helpers     | `src/lib/router-context.ts` · `src/lib/loader.ts`                                               |
| New page component                | `src/app/<name>.tsx`                                                                            |
| 404 / error UI                    | `src/app/error-boundary.tsx`                                                                    |
| tRPC procedures                   | `server/router.ts`                                                                              |
| tRPC context / procedure builders | `server/trpc.ts`                                                                                |
| Sign-up allowlist / admins        | `server/access.ts` · `server/auth.ts` (hook) · `SIGNUP_ALLOWLIST`, `ADMIN_EMAILS`               |
| DB schema                         | `prisma/schema.prisma`                                                                          |
| Migrations / raw SQL              | `prisma/migrations/` (see CLAUDE.md "Raw SQL in a migration")                                   |
| SSR state (superjson)             | `src/lib/ssr-state.ts`                                                                          |
| Auth config                       | `server/auth.ts` (server) · `src/lib/auth-client.ts` (client)                                   |
| HTTP mounts / SSR / 404 logic     | `server.ts`                                                                                     |
| Logging                           | `server/logger.ts`                                                                              |
| Env vars / dev port               | `server/env.ts` + `.env.example` (root) + `project.json`                                        |
| Project identity / ports          | `project.json` (read by `scripts/project.ts`, `app.config.ts`)                                  |
| Design tokens / the look          | `packages/tokens/tokens.css` (values) · `theme.css` (mapping) · `ui.md`                         |
| Token hex in code                 | `import { colors } from '@app/tokens'` (generated `colors.json`)                                |
| Icons, splash, favicon, manifest  | `packages/brand/{mark.svg,brand.json}` → `bun run brand`                                        |
| The Post demo                     | `server/demo.ts` + marked lines · `scripts/demo.ts` (`bun run demo:drop`)                       |
| Optional server slots             | `recipes/` (`bun run add:ai` / `add:ws` / `add:jobs`)                                           |
| Desktop main / router             | `apps/desktop/src/main/{index,router}.ts`                                                       |
| tRPC over IPC                     | `packages/trpc-ipc/src/{main,preload,renderer,protocol}.ts`                                     |
| Mobile screens / routes           | `apps/mobile/src/screens/` · `apps/mobile/src/app/`                                             |
| Mobile screen scaffold            | `apps/mobile/src/components/screen.tsx`                                                         |
| Mobile API base URL               | `apps/mobile/src/lib/{api-url,resolve-api-url}.ts`                                              |
| Mobile native config              | `apps/mobile/app.config.ts` · config plugins                                                    |
| Mobile OTA                        | `apps/mobile/src/lib/{ota,ota-hold}.ts`                                                         |
| Swift code                        | `apps/mobile/modules/<name>/` · `packages/<name>/ios/`                                          |
| EAS project / Expo upgrades       | `scripts/eas-setup.ts` · `scripts/upgrade-expo.ts` · `.claude/skills/upgrade-expo/`             |
| Template sync / init              | `scripts/{init,sync,add-surface,project,no-auth}.ts`                                            |
| Deploy                            | `drydock.yaml`                                                                                  |
| Browser chrome color              | `vite.config.ts` (themeMeta: color-scheme + theme-color)                                        |
| Kickoff                           | `.claude/skills/kickoff/SKILL.md` · `project.json` `look` · `src/components/kickoff-ribbon.tsx` |
| Browser query/tRPC singletons     | `src/lib/trpc.tsx` (`getBrowserClients()`)                                                      |
| E2E tests                         | `e2e/*.spec.ts`                                                                                 |

## Routes / URLs

Routes are explicit in `src/app/routes.tsx` (no file-based routing). All page routes nest under the root `Layout`.

| Route         | Serves                        | File                             | Loader                                                    |
| ------------- | ----------------------------- | -------------------------------- | --------------------------------------------------------- |
| `/`           | Placeholder until the kickoff | `src/app/home.tsx`               | `rootLoader` (session)                                    |
| `/sign-in`    | Sign in (`?next=`)            | `src/app/sign-in.tsx`            | `redirectIfSignedIn`                                      |
| `/sign-up`    | Sign up (`?next=`)            | `src/app/sign-up.tsx`            | `redirectIfSignedIn`                                      |
| `/dashboard`  | Protected signed-in page      | `src/app/dashboard.tsx`          | `dashboardLoader` (`requireSession` + prefetch me, posts) |
| `/healthz`    | DB health JSON                | `server.ts`                      | —                                                         |
| `/api/auth/*` | better-auth                   | `server.ts` (`toNodeHandler`)    | —                                                         |
| `/api/trpc/*` | tRPC                          | `server.ts` → `server/router.ts` | —                                                         |
| unmatched GET | 404 page (status 404)         | `error-boundary.tsx`             | —                                                         |

Signed out, `/dashboard` redirects to `/sign-in?next=%2Fdashboard`. `add:ws` adds `/api/trpc-ws` (WebSocket upgrade).

Mobile routes (Expo Router, file-based; each file re-exports a screen):

| Route      | Group    | File                                     | Screen                    |
| ---------- | -------- | ---------------------------------------- | ------------------------- |
| `/`        | `(app)`  | `apps/mobile/src/app/(app)/index.tsx`    | `src/screens/home.tsx`    |
| `/sign-in` | `(auth)` | `apps/mobile/src/app/(auth)/sign-in.tsx` | `src/screens/sign-in.tsx` |
| `/sign-up` | `(auth)` | `apps/mobile/src/app/(auth)/sign-up.tsx` | `src/screens/sign-up.tsx` |

`(app)` is guarded by `Stack.Protected guard={signedIn} redirectTo="/sign-in"`, `(auth)` by the inverse with `redirectTo="/"`, in `src/app/_layout.tsx`.

## Architecture

Browser ↔ Express 5 (`server.ts`) ↔ Postgres. One Express server runs in dev (Vite middleware + `ssrLoadModule`) and prod (static `dist/client` + built `dist/server/entry-server.js`), gated on `NODE_ENV`. SSR: `render(req)` builds a Fetch Request and a `RouterContextProvider` (the request's session in `sessionContext`, a per-request QueryClient + a tRPC proxy that calls the router directly with `contextFor(session)` in `clientsContext`), runs `createStaticHandler(routes).query()` to execute loaders, `renderToString`s with `<StaticRouterProvider>`, and dehydrates the QueryClient into `window.__SSR_STATE__` through superjson (`src/lib/ssr-state.ts`). The client deserializes and rehydrates that cache (Dates stay Dates), so `useQuery` has data on first paint. On client navigations `getContext: browserContext` fills the same keys with the browser singletons and a lazy session fetch, so loaders are one code path with no `typeof window` branch, and there is no "Loading…" flash either way. The stylesheet is a `<link>` in `index.html` (render-blocking in dev, hashed in prod), so there's no unstyled flash; there is one theme, so no theme script. In dev, Vite's HMR websocket shares the Express `http.Server` (one port).

## Data model

`prisma/schema.prisma` — better-auth's required models (`User`, `Session`, `Account`, `Verification`) mapped to lowercase tables via `@@map`; fields are camelCase (better-auth queries by name) with snake_case `@map` columns. Demo model: `Post` (id, title, content, `authorId` → User `onDelete: Cascade`, createdAt), inside `// demo:start` … `// demo:end`; `demo:drop` removes it with a `DROP TABLE` migration. FK relations to `User` should cascade. Every schema change is a committed migration in `prisma/migrations/`; extensions, exclusion constraints, FTS triggers and expression indexes are hand-written SQL in a migration. A `--no-auth` fork has no auth tables (its init migration is regenerated).

## Systems

### Auth (better-auth)

Email + password, `autoSignIn` on sign-up. Client (`auth-client.ts`) → `/api/auth/*` (`toNodeHandler`, mounted before `express.json`). Sign-up runs `databaseHooks.user.create.before`: outside `SIGNUP_ALLOWLIST` (emails and `@domain` entries; blank = open) it answers 403 `SIGNUP_CLOSED`, and `ADMIN_EMAILS` (exact addresses) may always sign up and get `ctx.isAdmin` / `adminProcedure`. SSR reads the session once per request into `sessionContext`; the root loader returns `{ session }`, read with `useRouteLoaderData('root')`. Protected loaders call `requireSession` (→ `/sign-in?next=…`); sign-in/up land on `nextFromSearch` (safe same-site paths only). **Lives in:** `server/{auth,access,trpc}.ts`, `src/lib/{auth-client,loader,router-context}.ts`, `src/app/{sign-in,sign-up,layout}.tsx`. Sign-in/up call `revalidator.revalidate()` so the nav reflects the new session; sign-out awaits `navigate('/')` before revalidating.

### tRPC

`publicProcedure` / `protectedProcedure` (401 without session) / `adminProcedure` (403 unless admin). Every context comes from `contextFor(session)` (`{ session, isAdmin }`); `contextFromHeaders` serves any adapter (HTTP here, WebSocket in `add:ws`). superjson transformer on the server and on every link (browser + SSR proxy). **Lives in:** `server/trpc.ts`, `server/router.ts`, `src/lib/trpc.tsx`.

### Look (one theme), the brand and the kickoff

There is one theme per project and no dark mode anywhere. `packages/tokens/tokens.css` holds the values (one `:root`, `color-scheme` = `project.json` `look.scheme`); `theme.css` maps them to Tailwind and redefines `dark:` to never match. `bun run tokens` turns the roles into hex in `colors.json`, which `@app/tokens` exports as `colors` for the places classes can't reach: `<meta name="theme-color">` (web `vite.config.ts` themeMeta, which also sets `color-scheme`), the root view and status bar (`_layout.tsx`), input placeholders, and the Electron window background. `packages/brand` renders `mark.svg` with token roles from `brand.json` into every icon, the splash mark, the favicon, the PWA manifest and the desktop icons (`bun run brand`, resvg); the splash is the brand color full-bleed with the bare mark, and mobile's `BrandSplash` takes over from the native splash pixel-identically, then animates out. `tokens.test.ts` keeps `colors.json` current, checks every mapped role has a value and the scheme matches, and fails while `look` is null (the template carries a placeholder `look`; `init` resets it to null); `brand.test.ts` fails on stale or hand-edited outputs. That, the dev ribbon (`kickoff-ribbon.tsx` on web and mobile) and the dev banner line push every fork through the kickoff skill, which replaces the neutral placeholder with a real direction and a real mark. On `bun run sync`, `tokens.css`, `colors.json`, the brand source and outputs, and `ui.md` keep the fork's copy (merge=ours). **Lives in:** `packages/tokens/`, `packages/brand/`, `.claude/skills/kickoff/`, `vite.config.ts`, `src/styles/app.css`.

### The Post demo

A working reference (table, router, SSR-prefetched list, create form, e2e flow, mobile list) that every fork must delete. Its own files (`server/demo.ts` is the marker) plus `// demo` line markers and `demo:start` … `demo:end` blocks (JSX: blocks only). In a fork (`project.json` without `template: true`), `noTemplateDemo` in `vite.config.ts` fails `vite build` and `server/demo.test.ts` fails `bun run test`; a dashed warning bar ("Template demo · delete before shipping: bun run demo:drop") shows on web and mobile. `bun run demo:drop` deletes it, writes `<ts>_drop_post_demo` (`DROP TABLE IF EXISTS "post"`) and runs `db:generate`. **Lives in:** `scripts/demo.ts`, the files listed in its `DEMO_FILES` / `MARKED_FILES`.

### Server slots (recipes)

`bun run add:<recipe>` (`recipes/add.ts`) plans the run (missing anchors fail with the change to make by hand), copies `recipes/<name>/files/` into the repo, runs `bun add` in apps/web, applies anchored edits (`lib.ts`: `insertAfterLine`, `addImport`, `addEnvKey` on `optionalKeys`, `addEnvExample`), formats and typechecks; it never commits and a second run is a no-op. **ai:** `server/ai/claude.ts` (lazy Anthropic client, `AI_FAKE`, zod structured output, `cache_control`, cost log). **ws:** `server/upgrades.ts` (`onUpgrade`, dev leaves unclaimed upgrades to Vite HMR) + tRPC on `/api/trpc-ws`, `splitLink` → `wsLink`. **jobs:** `job` table + `JobState`, `defineJob(...).enqueue`, `FOR UPDATE SKIP LOCKED`, backoff, `startJobs()` after listen, graceful stop via `server/shutdown.ts`. **Lives in:** `recipes/`.

### Mobile

Expo dev-client app (never Expo Go). Talks to the web server's `/api/trpc` + `/api/auth/*`; base URL from `EXPO_PUBLIC_API_URL`, else the dev LAN host (Metro `hostUri`) + `apiPort`, else the deployed `https://<name>.dested.com`. Auth: better-auth `expoClient` + SecureStore; the tRPC link sends the cookie as a header. Server trusts the app schemes via `expo()` plugin + `trustedOrigins`. Root layout: gesture root → keyboard provider → Query/tRPC → navigation theme from tokens → Stack (mounted once the session resolves) + sonner-native Toaster + ribbon, then `BrandSplash` (holds the native splash until it has drawn its copy, leaves once session + fonts are ready, holds OTA while up). Screens use `Screen` (safe area, scroll, keyboard). Variants (`APP_VARIANT`) coexist on one device; at runtime the variant/scheme come from the native bundle id, so an update bundle is variant-agnostic and `ota:promote` (republish preview → production) ships the tested artifact. One scheme: `userInterfaceStyle` from `look.scheme`, `Uniwind.setTheme(look.scheme)` in the root layout (the OS never flips it), root/stack background from `colors.json`, splash from `brand.gen.json`. Native changes need a new dev-client build (Limrun / expo-wsl-ios; compare `bun run fingerprint` with Home's row, which reads the hash the build wrote). EAS project: `init --mobile` runs `scripts/eas-setup.ts` under `project.json` `easOwner` (quickgame). EAS Update: `runtimeVersion` is the fingerprint, `updates.url` comes from `project.json` `easProjectId` (none → expo-updates off), each build profile has its own channel, and `src/lib/ota.ts` (mounted in the root layout) checks on launch and every foreground, fetches and `reloadAsync`s unless a `useOtaHold` is active; off in `__DEV__`. `.gitattributes` forces LF and `fingerprint.config.js` uses the `balanced` preset (node_modules hashed by `name@version`) so a local `eas update` fingerprints the same as the EAS build; the `ota:*` scripts set `APP_VARIANT` themselves (`eas update` ignores eas.json build env). Android: package with the variant suffix, apk/aab profiles. **Lives in:** `apps/mobile/`, `packages/brand/`, `apps/web/server/auth.ts`.

### Desktop

Electron main process owns everything Node: lifecycle, the window, and an `appRouter` served over IPC by `@app/trpc-ipc` (one channel, structured clone, no superjson; `ipcTransformer` is an identity transformer that only keeps tRPC's output types honest). The renderer is sandboxed (contextIsolation, no nodeIntegration) and only sees `window.trpcIpc`. TanStack Query never refetches on its own. All Electron state is pinned to `<repo>/data/.private/electron`. Single-instance lock forwards argv + cwd. The window and release icons come from `bun run brand`. Releases are unpacked (`release/win-unpacked`, `linux-unpacked` in WSL). **Lives in:** `apps/desktop/`, `packages/trpc-ipc/`.

### Template workflow

`project.json` `surfaces` (`web | mobile | desktop`) says what a fork has; `scripts/project.ts` maps each surface to its paths (web: `apps/web` + `drydock.yaml`; mobile: `apps/mobile` + `packages/native-example`; desktop: `apps/desktop` + `packages/trpc-ipc`) and root scripts (web: build/db/e2e/`demo:drop`; mobile: `upgrade:expo`; desktop: `release`). `init` renames identity strings in tracked files, writes `project.json` (drops `template: true`, resets `look` and `easProjectId`), picks ports, and drops the surfaces not asked for in one commit (`init: web-only`, `init: web + mobile (no native-example)`, …), refreshing `bun.lock`: from scratch when mobile is dropped (Bun keeps optional Expo peers otherwise), never when mobile stays (the template's lock is the proven Expo tree). With `--mobile` it drops `packages/native-example` unless `--native-example` and runs the EAS setup; with `--no-auth` it runs `scripts/no-auth.ts`. `sync` merges `upstream/main` with `--no-commit`, keeps `project.json`/`drydock.yaml` and the look/brand/log files (merge=ours driver) and the fork's `bun.lock`, re-deletes excluded surfaces' paths, dropped `OPTIONAL_PATHS` (native-example) and, in a no-auth fork (web without `apps/web/server/auth.ts`), `NO_AUTH_PATHS`, restores the right root scripts, fills in fields forks older than them lack (`surfaces`, `desktopPort`, `appId`, `look`, `easOwner`), then installs + typechecks. `add:mobile` / `add:desktop` check a surface out of upstream, restore its scripts and commit (then `eas:setup` for mobile). **Lives in:** `scripts/`.

### Logging & errors

Dependency-free ANSI logger: one line per request (method · status · path · timing), startup banner ("Express + React Router 8 SSR"), `formatError`. Loader/render errors and unmatched routes render the root `ErrorBoundary`. **Lives in:** `server/logger.ts`, `src/app/error-boundary.tsx`.

## Common tasks (how to modify)

### Add a route

1. Create `src/app/<name>.tsx` exporting `<NamePage>`.
2. Add `{ path: '<name>', Component: NamePage }` to `routes.tsx`; a protected page's loader calls `requireSession(args)`, a data page prefetches through `args.context.get(clientsContext)`.

### Add a tRPC procedure

Add to `appRouter` in `server/router.ts`; pick public/protected/admin; validate input with zod; return real `Date`s (superjson) and format them deterministically in render.

### Add a DB table

Edit `prisma/schema.prisma` → `bun run db:migrate --name <what>` (applies + regenerates the client) → read and commit `prisma/migrations/<ts>_<what>/` → use `prisma.x` in procedures. In an agent shell (`migrate dev` refuses): `bun run db:migrate:sql -o prisma/migrations/<ts>_<what>/migration.sql`, read it, `bun run db:deploy && bun run db:generate`. Raw SQL: `bun run db:migrate:create --name <what>`, append SQL, then `bun run db:migrate`.

### Change the icon or splash

Edit `packages/brand/mark.svg` or `brand.json` → `bun run brand` → `bun run test` → look at the PNGs. A new icon or splash needs a new dev-client build.

### Add AI, WebSockets or a job queue

`bun run add:ai|add:ws|add:jobs` (CLAUDE.md → Common tasks has what each adds), review the diff, commit.

### Add an e2e test

Add `e2e/*.spec.ts`; screenshot only stable views; `bun run test:e2e:update` to write baselines.

## Gotchas & hard rules

- **Path alias `~/*` → `src/*`** (client only, in web and in mobile); server uses relative imports.
- **Mobile ↔ web contract is `import type` only** (CLAUDE.md rule #17); tokens come from `@app/tokens`, brand colors from `@app/brand`. Identity only in `project.json` (#22). No hand edits to `ios/`/`android/` (#18), no custom Metro config (#21).
- **WSL mirrored networking drops connects to a closed `127.0.0.1` port** instead of refusing them, so a "is it up?" probe on `localhost` hangs ~2 min (the TCP SYN timeout). Playwright's `webServer.url` probes `[::1]` for that reason; do the same in any readiness check.
- **The e2e readiness probe is a static file** (`/robots.txt`), not `/healthz`: Playwright starts the server before global-setup creates a new fork's `_test` DB, so a DB ping never passes on a first run.
- **`init` renames every `sal-starter` / `sal_starter` / `Sal Starter` string** in tracked text files, so never compare against the template's name to detect "am I the template". Key off `project.json` `template: true` (init drops it).
- **JSX demo markers must be blocks** (`{/* demo:start */}` … `{/* demo:end */}`): a same-line `{/* demo */}` after an element leaves a stray text node on React Native.
- **`Stack.Protected` needs `redirectTo`** on SDK 58: the default falls back to the first open group's path, and `(auth)` has no index, so a signed-out launch at `/` landed on "Unmatched Route".
- **`require<T>()` and `EXPO_PUBLIC_*` typing lives in the committed `apps/mobile/expo-types.d.ts`.** Metro's `expo-env.d.ts` is gitignored and only appears after Metro runs, so a fresh clone or fork typechecked red without it.
- **`getContext` makes navigations async:** `await navigate(...)` before `revalidator.revalidate()`, or the revalidate re-runs the current page's loaders.
- **Root scripts proxy with `bun run --cwd apps/web <script>`** — `bun --cwd X run` silently prints the script list instead.
- **`./server/*` is server-only** — import into `src/*` only as `import type`.
- **Express 5 required** — `*splat` wildcards break on Express 4 (symptom: `/api/auth/*` 404s, auth dead).
- **`.env` loading**: Bun loads `.env` only into its own runtime, not the Prisma CLI (Node subprocess); Prisma 7 dropped auto-loading — `prisma.config.ts` loads it manually. Keep that block.
- **Run `bun run db:generate` after schema edits** (auto-runs on `bun install`).
- **superjson everywhere** — any new tRPC link needs `transformer: superjson`; SSR state goes through `ssr-state.ts`, never raw `JSON.stringify`. Format Dates deterministically (UTC / fixed `timeZone`) or SSR/hydration markup diverges.
- **Migrations, never `db push`** — and review generated SQL: Prisma can emit `DROP INDEX` for hand-made expression indexes.
- **Port** — `PORT` env (default `project.json` apiPort, 4780); Metro = apiPort + 1, desktop renderer + 2, e2e + 3; never 3000/3001/5173/5174/8000/8080/4200/5000.
- **Types** — `strict` + `noUncheckedIndexedAccess`; no `any`, no `as` casts to paper over mismatches; loader context values come from typed `createContext` keys.
- **Stylesheet is a `<link>` in `index.html`** — never `import` CSS from a component (Vite injects it after the module graph loads → unstyled flash in dev). `@import` new CSS from `app.css`.
- **One theme, never dark mode** — no `.dark`, `prefers-color-scheme`, toggle, `useColorScheme` or `nativeTheme` anywhere; `dark:` classes compile to nothing. After any `tokens.css` edit run `bun run tokens` (and `bun run brand`) or the tests fail.
- **`vite.config.ts` imports `@app/tokens/colors.json` with `with { type: 'json' }`** — Node loads the config's workspace imports unbundled; importing `@app/tokens` (index.ts) there fails with ERR_IMPORT_ATTRIBUTE_MISSING.
- **HMR has no fixed port** — it shares the Express server; giving it one collides with other clones running locally.
- **shadcn is Base UI, no `asChild`** — swap the element with the `render` prop or style a `Link` with `buttonVariants()`; Base UI's Button defaults to `type="button"`.
- **No `tailwind.config`** — Tailwind v4, tokens in `packages/tokens`. Tailwind 4.3.3 everywhere (catalog = the version Uniwind depends on, so mobile compiles with the same Tailwind). No lightningcss override.
- **Third-party native views need `withUniwind`** — Uniwind binds `className` on react-native's components only; elsewhere it typechecks and is silently dropped. SafeAreaView comes from `apps/mobile/src/components/safe-area-view.tsx`, never from `react-native-safe-area-context`. A Pressable style function next to `className` drops the className.
- **EAS runs from `apps/mobile` only.** At the root it creates a stray EAS project + root `app.json`/`eas.json`. `EAS_NO_VCS=1` uploads only the cwd: add `EAS_PROJECT_ROOT=../..` or Metro dies with ENOENT on workspace paths. `eas init` can't save the id into our dynamic `app.config.ts`, so `eas-setup.ts` runs it from a throwaway static `app.json`.
- Use `log.*` from `server/logger.ts`, not raw `console.log`, in server code.
- **Desktop IPC has no superjson** — never add a transformer other than `ipcTransformer` to the desktop router or `ipcLink`. Every procedure output must survive structured clone (no functions, no class instances you need back).
- **Desktop preload must stay tiny and CJS** — import only `@app/trpc-ipc/preload`; anything else lands in the sandboxed preload bundle.
- **Desktop dev in WSL needs the Linux Electron binary.** If `electron-vite dev` reports Electron missing, run `node node_modules/electron/install.js` (an install: take the install lock in a multi-agent run).
- **Every pin respects the 3-day `minimumReleaseAge`** in the repo `bunfig.toml`; a same-week release (Electron, Expo patches) won't install. Bump only to versions at least 3 days old. A `bunx <pkg>@x` outside the repo doesn't read the repo bunfig and can pull younger transitive packages.
- **After `bunx expo install --fix`, run `bun run doctor`.** An incremental install can leave same-version duplicates nested under `node_modules/expo*/node_modules/`; delete those folders and `bun install` (`upgrade:expo` warns about them).
- **Never `bunx prisma`** — outside the workspace it resolves npm `latest`, the Prisma 8 RC. Scripts and Drydock's predeploy use `bun run db:*`.
- **SSR asset 404s go through `server/asset-path.ts`** — add an extension there, never a regex on "has a dot" (that 404'd `/u/ada.lovelace`).
- **The agent-guard hook blocks `git clone` / `git init` in subagents**, so scratch-clone checks of `init` (verify.md → Fork recipes) run in the lead session.
- **`brand.test.ts` hashes the generator too** — any edit to `brand.ts`, `png.ts` or `emit.ts`, even a comment, asks for `bun run brand`.

## Status

- **Done** — SSR + hydration (typed loader context, server and client-nav prefetch), auth (email/pw, allowlist, admins, `?next=`), optional-key env helper, tRPC (public/protected/admin), Post demo with fork gates and `demo:drop`, logging, /healthz, 404/error handling, one-theme tokens + generated `colors` + kickoff skill/ribbon/test, brand pipeline (icons, splash, favicon, manifest, desktop icons) + BrandSplash, scroll restoration, immutable asset caching, init (rename, ports, `--mobile` with EAS setup, `--no-auth`, `--desktop[-only]`), Playwright e2e + screenshot baselines. Monorepo (`apps/web`, optional `apps/mobile`, optional `apps/desktop`), `project.json` identity + `surfaces`, `sync` / `add:mobile|add:desktop`, `add:ai|add:ws|add:jobs` recipes, `upgrade:expo`, `@app/tokens`, `@app/brand`, Electron desktop surface with tRPC over IPC (`@app/trpc-ipc`) and unpacked releases, Drydock seed, Expo SDK 58 mobile app (iOS + Android profiles) with auth, Screen scaffold, haptic Button, fonts, OTA hold, build fingerprint. React Router 8, Vite 8, React Compiler (web, desktop, mobile), shadcn on Base UI. Express 5 + Prisma 7. superjson (wire + SSR state), zod 4, `noUncheckedIndexedAccess`, `prisma migrate` workflow, `bun:test` unit tests.
- **Not built** — email verification, OAuth providers, rate limiting, CI, per-route head/meta.
- **Unverified** — the new dev client on Limrun (BrandSplash hand-off, the baseline native libraries, the fingerprint row reading `EXUpdates.bundle/fingerprint`, Button press scale, keyboard-controller, Toaster); a real `eas-setup` run against quickgame; `upgrade:expo` past `--check`; `ota:promote` end to end and fingerprint parity on a real EAS build; `add:ai` against the real API; `add:jobs` on Drydock; the desktop icon on a Windows taskbar. Drydock deploys of the workspace shape are proven by 10 forks.
- **Open** — the Expo 58.0.19 patch set clears the release age after 2026-10-26 ~23:30Z: then `bun run upgrade:expo` (until then `bun run doctor` fails its version check).
- **Next:** whatever the cloned product needs — this is a base.
