# sal-starter

An SSR React starter wired with a current, type-safe stack, plus an optional Expo app (iOS + Android) and an optional Electron desktop app that talk to the same server. Clone it, init it, ship.

> Already have a project cloned from an older sal-starter? A workspace fork pulls template changes with `bun run sync`; see [`MIGRATION.md`](./MIGRATION.md) for what a sync past the 2026-10-25 overhaul needs, the app-breaking fixes for old single-package clones, and the move to this monorepo layout.

| layer              | choice                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| runtime / pkg mgr  | **Bun** 1.4 workspaces (one `bun.lock`, shared versions in the root `catalog`, 3-day release age)     |
| server             | **Express 5** + **Vite 8** SSR (vite middleware in dev, static + SSR bundle in prod)                  |
| routing            | **React Router 8** (`createBrowserRouter` client, `createStaticHandler` server, typed loader context) |
| data               | **tRPC v11** + **TanStack Query** (`.queryOptions()` API) + **superjson**                             |
| validation         | **zod 4**                                                                                             |
| db                 | **Postgres** + **Prisma 7** (pg driver adapter, `prisma-client` generator, `migrate`)                 |
| auth               | **better-auth** (email + password, sign-up allowlist, admins; Expo plugin for the app)                |
| styles             | **Tailwind v4** + **shadcn/ui** on Base UI (one theme, oklch tokens shared with mobile)               |
| brand              | one mark → every icon, splash, favicon and manifest (`bun run brand`)                                 |
| mobile (optional)  | **Expo SDK 58** dev client + **Expo Router** + **Uniwind**, iOS + Android                             |
| desktop (optional) | **Electron 44** + **electron-vite 6**, tRPC over IPC, unpacked builds                                 |
| types              | **TypeScript 7** `tsc`, `strict` + `noUncheckedIndexedAccess` in every workspace                      |
| tests              | **Playwright** e2e with committed screenshot baselines + **bun:test** units                           |
| deploy             | **Drydock** (`drydock.yaml`, web only) · **EAS** for the app                                          |

## Quickstart

Requires [Bun](https://bun.sh) 1.4 and a reachable Postgres.

**Start a new project from this template:**

```bash
git clone https://github.com/dested/sal-starter.git my-app && cd my-app
git remote rename origin upstream   # keeps `bun run sync` working; add your own origin later
bun install
bun run init my-app                 # web only; --mobile / --desktop keep those apps, --desktop-only keeps just Electron, --no-auth drops accounts
createdb my_app                     # or point .env's DATABASE_URL at any Postgres
bun run db:migrate                  # apply prisma/migrations
bun run dev                         # → http://localhost:<the port init printed>
```

Then, before building anything:

1. **The kickoff:** `/kickoff` in Claude Code (`.claude/skills/kickoff`). It settles the product's look with you (three directions or "wing it", one light or dark scheme, never a toggle) and builds it into the tokens, fonts, components, the real home page and the brand mark (icon, splash, favicon). Until it runs, `project.json` `look` is `null`: dev shows a "Kickoff pending" ribbon and `bun run test` fails.
2. **Drop the demo:** `bun run demo:drop`. The Post demo is the template's working example of a table, a router and an SSR-prefetched page; in a fork `bun run build` and `bun run test` fail until it's gone, so it can't ship.

`init` renames everything, writes `project.json` (the project's identity: name, scheme, bundle id, surfaces, ports, db, EAS owner), picks per-project ports and writes a fresh `.env` (web only). Surfaces you didn't ask for are deleted in their own commit ("init: web-only", "init: desktop-only", …); `bun run add:mobile` / `add:desktop` bring one back any time. With `--mobile` it creates the EAS project (`--no-eas` skips it, `--dry-run-eas` prints the commands) and drops the template's native-example package (`--native-example` keeps it). `--no-auth` removes better-auth, sign-in/up and the auth tables. `--port <n>` picks the API port yourself (Metro gets n + 1, the desktop renderer n + 2, e2e n + 3). `--fresh-git` wipes history instead, which also cuts you off from `sync`.

**Ports:** every project gets its own distinct, uncommon set and records it in `cliffnotes.md`. Never 3000/3001/5173/5174/8000/8080/4200/5000. The template uses 4780 (API), 4781 (Metro), 4782 (desktop) and 4783 (e2e).

**Pull template improvements later:**

```bash
bun run sync                        # merges upstream/main, never commits
git diff --cached && git commit
```

Your `project.json`, `drydock.yaml`, `bun.lock`, look, brand and logs stay yours; surfaces and pieces your fork dropped stay dropped (in a `--no-auth` fork, the auth files too). Real conflicts are listed for you to resolve.

## Scripts

All run from the repo root.

| script                                   | what it does                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `bun run dev`                            | web (HMR + SSR on 4780) + Metro on 4781 + the desktop window, whichever exist  |
| `bun run dev web` / `mobile` / `desktop` | just one of them                                                               |
| `bun run init <name>`                    | rename the template, write `project.json` + `.env` (flags above)               |
| `bun run sync`                           | merge `upstream/main` into this fork without committing                        |
| `bun run add:mobile` / `add:desktop`     | add the Expo / Electron app to a fork without it, from upstream                |
| `bun run add:ai` / `add:ws` / `add:jobs` | copy in an optional server slot: Claude module, WebSockets, Postgres job queue |
| `bun run demo:drop`                      | delete the Post demo and write its drop migration (`--check`, `--dry-run`)     |
| `bun run upgrade:expo`                   | newest Expo the release age allows (`--check`, `--sdk <n>`, `--json`)          |
| `bun run tokens`                         | regenerate `packages/tokens/colors.json` from `tokens.css`                     |
| `bun run brand`                          | render every icon, splash, favicon and the manifest from `packages/brand`      |
| `bun run release`                        | desktop: unpacked build in `release/win-unpacked/`                             |
| `bun run build`                          | build client (`apps/web/dist/client`) + SSR bundle (`dist/server`)             |
| `bun run start`                          | run the production server (`NODE_ENV=production`)                              |
| `bun run typecheck`                      | `tsc --noEmit` in the root and every workspace                                 |
| `bun run test`                           | `bun:test` in every workspace                                                  |
| `bun run test:e2e`                       | Playwright e2e + screenshot comparison                                         |
| `bun run test:e2e:update`                | regenerate screenshot baselines                                                |
| `bun run db:migrate`                     | create + apply a migration, regenerate the client (dev)                        |
| `bun run db:migrate:create`              | create a migration without applying (for raw SQL)                              |
| `bun run db:migrate:sql`                 | write the schema diff to a file (agent shells, where `migrate dev` refuses)    |
| `bun run db:deploy`                      | apply committed migrations (prod / CI)                                         |
| `bun run db:generate`                    | regenerate the Prisma client (auto-runs on install)                            |
| `bun run db:studio`                      | Prisma Studio                                                                  |
| `bun run prettier`                       | format the repo                                                                |

Mobile-only scripts live in `apps/mobile/package.json`: `doctor`, `test`, `fingerprint`, `eas:setup`, `ios:prebuild`, `ios:device`, `ios:sim`, `add-device`, `build:dev|preview|prod`, `submit:prod`, `build:android:dev|preview|prod`, `submit:android:prod`, `ota:preview|promote|prod`.

## Layout

```
project.json             identity: name, scheme, bundleId, appId, surfaces, ports, db, easProjectId, easOwner, appleTeamId, look
package.json             workspace root: catalog, proxy scripts
drydock.yaml             deploy seed (web only)
scripts/                 init, sync, add-surface, demo, no-auth, eas-setup, upgrade-expo, dev
recipes/                 add:ai / add:ws / add:jobs
apps/web/                the SSR app and the API server
├── server.ts            Express entry: logging, /healthz, auth + tRPC mounts, vite/SSR
├── server/              env, access, logger, prisma, auth, trpc, router (exports AppRouter), demo
├── src/                 client: routes, pages, shadcn primitives, lib, styles
├── prisma/              schema + committed migrations
└── e2e/                 Playwright specs + __screenshots__
apps/mobile/             Expo app (optional)
├── app.config.ts        reads project.json + the brand; APP_VARIANT picks dev/preview/prod identity
├── eas.json             build profiles (iOS + Android)
├── modules/app-native/  local Expo module (Swift)
└── src/                 app/ (Expo Router), screens/, components/, lib/
apps/desktop/            Electron app (optional)
packages/tokens/         the look: tokens.css → Tailwind mapping + generated hex
packages/brand/          the mark → every icon and splash
packages/trpc-ipc/       tRPC over Electron IPC
packages/native-example/ shared Expo module + config plugin (the template's native demo; init drops it)
```

## How it fits together

**Auth.** Sign-in/up call `authClient` → POST `/api/auth/*` (mounted via `toNodeHandler(auth)`) → session cookie. Sign-up checks `SIGNUP_ALLOWLIST` (emails and `@domain` entries, blank = open) on the server; `ADMIN_EMAILS` get `adminProcedure`. A protected page sends a signed-out visitor to `/sign-in?next=<page>` and back after sign-in. On SSR, `entry-server.tsx` reads the session once per request and puts it in the loaders' typed context, so the first paint already knows who you are. The app uses better-auth's Expo client: the cookie lives in SecureStore and the tRPC link sends it as a header.

**tRPC.** Components call `useQuery(trpc.me.queryOptions())` → `/api/trpc/*` → `appRouter`. The context carries the session and `isAdmin`; `protectedProcedure` 401s without a session, `adminProcedure` 403s for non-admins. Mobile imports only the `AppRouter` type from `@app/web/router`.

**SSR + hydration.** Loaders prefetch tRPC queries into a per-request `QueryClient` (via a direct, no-HTTP options proxy) on the server, and into the browser's singletons on client navigations: the same loader code, from React Router 8's typed context. The cache is dehydrated into `window.__SSR_STATE__` through superjson and rehydrated on the client, so `useQuery` has data on first render and `Date`s are still `Date`s.

**Migrations.** Schema changes are committed `prisma migrate` migrations, never `db push`. Postgres features Prisma can't model are hand-written SQL in a migration. See `CLAUDE.md` → "Raw SQL in a migration".

**Styling.** One theme, no dark mode: oklch tokens in `packages/tokens/tokens.css` (`@app/tokens`), mapped to Tailwind by `theme.css`. Web and desktop import both from `app.css`; mobile imports them through Uniwind, which compiles them to native styles at bundle time. `bun run tokens` writes the hex copies (`colors.json`, exported as `colors`) that the browser chrome, Electron window and SVG props use. `bun run brand` renders `packages/brand/mark.svg` in token colors into every icon, the splash, the favicon and the PWA manifest.

## Mobile

The app runs as a **development build** (a dev client), never Expo Go.

- **Daily** (Windows/WSL): editor, Postgres, `bun run dev` (API on 4780 + Metro on 4781). JS changes hot-reload.
- **Run and test:** Limrun, a cloud Xcode sandbox and iOS simulator (`lim xcode build`, then a simulator tunnelled to Metro and the API).
- **Your iPhone:** expo-wsl-ios (`npx expo-wsl-ios run` in `apps/mobile`), built and signed locally.
- **Distribution:** EAS (`build:preview`, `build:prod`, `submit:prod`, the Android equivalents, `ota:*`).
- **The Mac** only for what those can't do (`bun run ios:prebuild`, `bun run ios:device`).

When do you need a new build? When the native fingerprint changes: run `bun run fingerprint` in `apps/mobile` and compare with the fingerprint row at the bottom of the app's Home screen. Swift, native dependencies, config plugins, the icon and splash, and native `app.config.ts` fields change it; JS doesn't. Move code between machines on a branch, never `master` (pushing `master` deploys web).

**EAS project.** `init --mobile` creates `@<easOwner>/<name>` (default owner quickgame), writes `easProjectId` to `project.json`, sets `APP_VARIANT` in each EAS environment and protects the production channel. If it was skipped (no eas-cli, not logged in, `--no-eas`): `eas login`, then `bun run --cwd apps/mobile eas:setup`. Set `appleTeamId` in `project.json` for iOS signing. Distribution builds: `bun run build:preview` (internal, devices registered via `bun run add-device`), `bun run build:prod` + `bun run submit:prod`.

**Run `eas` only inside `apps/mobile`.** Run at the repo root, it offers to create a new EAS project with a root `app.json`/`eas.json`; say no and `cd apps/mobile`. EAS uploads the whole git repo, so the workspace (root `bun.lock`, `packages/*`, `@app/web` types) comes along. With `EAS_NO_VCS=1` it uploads only the current directory: set `EAS_PROJECT_ROOT=../..` too, or Metro fails at "Bundle JavaScript" on missing workspace paths.

**Ship a fix (OTA).** JS-only changes go out without a store build. In `apps/mobile`: `bun run ota:preview --message "what changed"`, check it on a preview build, then `bun run ota:promote` republishes that exact update to production (the bundle doesn't depend on the variant: the app reads it from its own bundle id). `bun run ota:prod --message "…"` publishes straight to production for a hotfix. Each script sets `APP_VARIANT` itself, because `eas update` never reads eas.json's build `env`. Installed apps check on launch and on every return to the foreground, download, and reload at once (`src/lib/ota.ts`), unless a screen holds updates with `useOtaHold`. An update only reaches builds with the same fingerprint `runtimeVersion`: check with `eas fingerprint:compare --build-id <id>` first. Native changes (fingerprint differs) need a new `build:prod`.

**Upgrading Expo.** `bun run upgrade:expo --check` shows the newest patch the 3-day release age allows and what's still blocked; `bun run upgrade:expo` applies it and says whether the dev client needs a rebuild.

## Testing

Playwright e2e lives in `apps/web/e2e/`. `bun run test:e2e` boots the app on port 4783 (`project.json` apiPort + 3) against an **isolated test database** (`sal_starter_test`, from `project.json` db, on the server and credentials of your `.env` `DATABASE_URL`), creates it if missing, applies the committed migrations and truncates every table, and runs the specs: smoke (home, sign-up → dashboard → sign-out, the 404 page, a `Date` surviving SSR), the `?next=` round trip, and the Post demo flow. Visual baselines are committed under `e2e/__screenshots__/`; update them with `bun run test:e2e:update`.

```bash
bun run test:e2e                                 # or E2E_DATABASE_URL=postgres://…/x_test bun run test:e2e
```

The e2e DB name must end in `_test`. Screenshots are OS/font specific; regenerate on the platform your CI uses.

Unit tests: `bun run test`. `ssr-state.test.ts` proves a `Date` survives SSR dehydrate → hydrate; `tokens.test.ts` keeps `colors.json` in step with `tokens.css` and fails until the kickoff has set the look; `brand.test.ts` fails on stale or hand-edited icons; `demo.test.ts` fails in a fork until `bun run demo:drop`.

Mobile has no device test runner in the template. `bunx expo export --platform ios` (in `apps/mobile`) proves the app bundles; `bun run doctor` checks the Expo setup. `verify.md` lists every check.

## Deploy

**Web: Drydock.** `drydock.yaml` at the root deploys `apps/web` (`kind: ssr`, `runtime: bun`, `workspace: "@app/web"`). `predeploy` runs `bun run db:deploy`, so committed migrations only; a failed migration fails the deploy. Drydock provides `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`; other keys go in Project → Environment. Every push to `master` redeploys. A fork's build fails while the Post demo is present.

**App: EAS.** See "Mobile" above. Builds and OTA updates are separate from the web deploy.

## Gotchas

- **Express 5 is required.** The route patterns (`/api/auth/*splat`) use named wildcards.
- **`.env` lives at the repo root.** `apps/web` scripts pass `--env-file=../../.env`, and `prisma.config.ts` loads it for the Prisma CLI.
- **Server-only code lives in `apps/web/server/`.** Never import it from `src/*.tsx` or from mobile except as `import type`.
- **Identity lives in `project.json`.** Don't hardcode the name, scheme, bundle id or ports anywhere else.
- **Never edit `apps/mobile/ios/` or `android/`.** They're generated by prebuild and gitignored.
- **Never hand-edit an icon, the splash or the favicon.** Edit `packages/brand/mark.svg` and run `bun run brand`.

For the deeper "how to extend this" briefing (hard rules, common tasks, architecture flows), read [`CLAUDE.md`](./CLAUDE.md) and [`cliffnotes.md`](./cliffnotes.md).
