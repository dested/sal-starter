# sal-starter — Updates

> Terse, newest-first log: what was asked → what was done. One entry per finished task.

## 2026-10-25 — docs pass: the kit matches HEAD after phases C, D, E, brand and the demo gate

Asked: fold the five agents' reports into the doc kit, verified against the code. Done: CLAUDE.md rewritten (stack rows, layout, rules 4/6/8/16/20/22/23 revised, new rules 24 demo, 25 allowlist/admin, 26 `?next=`, 27 brand; flows on the RR8 context; mobile and desktop sections; new tasks: start a fork, drop the demo, add:ai/ws/jobs, change the icon or splash, upgrade Expo); cliffnotes.md (map, routes, systems, gotchas, status), ui.md (Base UI, `cn`, icon and splash, Screen), decisions.md (12 entries), verify.md (fork recipes, upgrade:expo, no-auth check, brand), README.md, the plan, the kickoff skill (demo:drop step, FONTS). `sync` keeps a no-auth fork's `NO_AUTH_PATHS` deleted; root tsc covers `recipes/` (653a79a). Verified: typecheck, unit tests.
Touched: CLAUDE.md, cliffnotes.md, ui.md, decisions.md, updates.md, verify.md, README.md, plans/2026-10-24-starter-overhaul.md, .claude/skills/kickoff/SKILL.md, scripts/sync.ts, tsconfig.json

## 2026-10-25 — Post demo: template-only, gated in forks, `bun run demo:drop`

Asked (Sal): nine forks shipped the Post demo; show it's a template and make it go before prod. Done: the demo moved into its own files (`server/demo.ts` marker, `demo.test.ts`, `components/demo/`, `e2e/demo.spec.ts`, mobile `components/demo/`) plus `// demo` / `demo:start…end` markers; a dashed warning bar on web and mobile; in a fork (`project.json` without `template: true`, which init drops) `vite build` and `bun run test` fail until `bun run demo:drop` (deletes it, writes the drop migration, regenerates the client; `--check`, `--dry-run`). The dashboard is the signed-in page (`me` prefetched; smoke e2e proves SSR Dates via `me.createdAt`). e2e global-setup truncates every table; the Playwright probe is `/robots.txt` (a new fork's test DB doesn't exist yet when the server starts). Banner says React Router 8; app.config `owner` = easOwner + the expo-image plugin; eas-setup refuses in the template. Verified in scratch forks: `init demo-app --mobile --dry-run-eas` (build and test fail until demo:drop, then typecheck/build/tests green apart from the kickoff test, e2e 7/7, expo export) and `init noauth-app --no-auth` (e2e 2/2 after demo:drop).
Commits: 2d62573, 3f5ae7f, 757a90e, 39968eb, 1e5b136, f0e1c7e

## 2026-10-25 — phase E: server slots, allowlist + admins, `?next=`, `init --no-auth`

Done: `server/env.ts` `optionalSecret` / `optionalKeys` / `requireEnv` / `hasEnv` (+ test); `SIGNUP_ALLOWLIST` + `ADMIN_EMAILS` (`server/access.ts`, better-auth create hook → 403 `SIGNUP_CLOSED`), `Context { session, isAdmin }` via `contextFor`, `adminProcedure`, `me.isAdmin`; `src/lib/loader.ts` (`requireSession`, `redirectIfSignedIn`, `safeNext`, `nextFromSearch`) and `?next=` on sign-in/up (+ `auth-next.spec.ts`); `recipes/` with `add:ai` (Anthropic module, AI_FAKE, zod output, cost log), `add:ws` (upgrade registry + tRPC over WebSocket) and `add:jobs` (Postgres queue, SKIP LOCKED, graceful stop); `scripts/no-auth.ts` wired into `init --no-auth`. Verified: unit tests, e2e 7/7 (before the demo rework), bx allowlist pass, each recipe in a scratch clone and on a no-auth copy (typecheck, tests, ws and jobs live), no-auth prod server routes. Not verified: `add:ai` against the real API, `add:jobs` on Drydock.
Commits: e67d630, 3e5b01c, a161fa4, 4ccc2bf, f237e71, 9e4c188, 6bc4ba4

## 2026-10-25 — phase D: React Router 8, Vite 8, React Compiler, Base UI, `cn`

Done: `react-router` 8.5 (no `react-router-dom`), typed loader context (`src/lib/router-context.ts`, `getContext: browserContext`, `RouterContextProvider` per SSR request) replacing `isSsrContext` and the `typeof window` branches; sign-out awaits the navigation before revalidating (a regression found with bx). Vite 8.3 + plugin-react 6 + electron-vite 6; React Compiler through `@rolldown/plugin-babel` + `reactCompilerPreset` on web and desktop. shadcn `base-nova` on `@base-ui/react` 1.9 (Button, Input; Card gains CardAction); `cn` 0.5 replaces clsx + tailwind-merge on web and desktop. Desktop window and electron-builder use the brand icons. Routes and the SSR proxy use phase E's helpers and `contextFor`. Verified: typecheck, tests, e2e with every baseline unchanged, bx dev and prod passes (no hydration warnings, HMR 101 on the Express port), compiler output in the client bundle, desktop dev over CDP and a packaged build.
Commits: 260e982, c32fc76, 4b40f9b, f5e27b9, 60c992a, e36b3be, ca1a8fe, 7b0dae0, 48c7e47

## 2026-10-25 — phase C: mobile baseline, EAS setup in init, upgrade:expo, Android

Done: `init --mobile` creates the EAS project (`scripts/eas-setup.ts`, static app.json in a temp folder; `--no-eas`, `--dry-run-eas`) under `project.json` `easOwner` and drops `packages/native-example` unless `--native-example` (`sync` keeps it dropped: `OPTIONAL_PATHS`). Baseline libraries (haptics, image, font, symbols, svg + lucide, file-system, device, keep-awake, keyboard-controller, sonner-native, FlashList 2); `Screen` scaffold, haptic `Button`, `FONTS`, nav theme from tokens, `useOtaHold`, pure `resolve-api-url` (+ tests), the fingerprint row reads `EXUpdates.bundle/fingerprint` and `bun run fingerprint` = per platform + variant; `fullScreenGestureEnabled: false`; Android profiles and package; `bun run upgrade:expo` + the upgrade-expo skill; `expo-types.d.ts` committed so a fresh clone typechecks. Verified: typecheck, tests, `expo export` iOS + Android, doctor 19/20 (only the blocked 58.0.19 patch set), `eas-setup --dry-run`, `upgrade:expo --check`. Not verified: any device or Limrun run, a real EAS setup.
Commits: 7abf924, f450c66, c7f8c00, 74243a9, b16cba9, d5b2c37, 45d0687

## 2026-10-25 — brand: one mark → every icon and splash

Done: `packages/brand` (`mark.svg`, `brand.json`, resvg generator, `brand.gen.json`, `brand.test.ts`) and `bun run brand` → iOS icon, splash mark, Android adaptive + monochrome, favicon, apple-touch + PWA icons, manifest, desktop png/ico; `BrandSplash` takes over from the native splash and animates out (`onGone`); app.config android block and splash from brand. Verified: two runs byte-identical, tests, typecheck, `expo config` both variants, every PNG looked at. Not verified: the splash hand-off on a device.
Commits: aa117d1, a7c7a82

## 2026-10-24 — first SDK 58 run on Limrun

Built the SDK 58 dev client in a Limrun Xcode sandbox (3m16s) and ran it on an iPhone simulator. Found and fixed: a signed-out launch landed on "Unmatched Route" (expo-router 58 falls back to the first open group's path, and `(auth)` has no index), so both `Stack.Protected` guards now set `redirectTo`; mobile auth buttons stay disabled until the fields are filled (the server's raw zod error showed on an empty submit), and the switch link is underlined like web. Verified on the simulator: sign-in → sign-up → Home (API through the tunnel, both native modules) → sign-out → sign-in, and OS dark mode leaves the app white. Open: the Home dev row shows `fingerprint: 1` on SDK 58 (the dev menu shows the real runtime version).
Touched: apps/mobile/src/app/_layout.tsx, apps/mobile/src/screens/{sign-in,sign-up}.tsx

## 2026-10-24 — phase C start: Uniwind, Expo SDK 58, Tailwind 4.3.3

Done: Uniwind 1.13 replaces NativeWind 5 rc over unchanged tokens (the lightningcss override is gone); Expo 57.0.31 → 58.0.17 with RN 0.88, React 19.3 in the catalog for every app, React Compiler on mobile, the `balanced` fingerprint preset, no lru-cache pin; Tailwind 4.3.3 in the catalog (Uniwind's version). Verified: e2e 4/4 with baselines unchanged, mobile token hex and shadow-card compile.
Commits: c5e8e5f, e165063, c14c8b1

## 2026-10-24 — auth pages, e2e that runs itself

Asked: no EAS build; set up e2e; cut the helper text on sign-in/sign-up and make those pages look better.
Done: sign-in/sign-up on web and mobile drop the card and its description: a display-face h1, 44px fields and button, one underlined switch link ("Create an account" / "I already have an account"); the dashboard and mobile home lose their caption and "Welcome back" subtitle. e2e needs no setup: the test DB URL comes from `DATABASE_URL` with the database swapped for `<db>_test`, and global-setup creates it. Screenshot tolerance 2% → 0.2% (the October tan-starter landing baseline still passed against the new home); every baseline regenerated. Playwright probes `[::1]` (WSL dropped the closed-port `127.0.0.1` probe for ~2 min): a run went from 2.4 min to 6 s. Verified: typecheck, unit tests, e2e 4/4, 390px screenshots.
Touched: apps/web/src/app/{sign-in,sign-up,dashboard}.tsx, apps/mobile/src/screens/{sign-in,sign-up,home}.tsx, apps/web/e2e/*, apps/web/playwright.config.ts, CLAUDE.md, cliffnotes.md, README.md, verify.md

## 2026-10-24 — overhaul phase B: one theme, generated token hex, kickoff

Ask: no dark mode ever, no more neutral shadcn / stack-showcase home, force a look per fork (plans/2026-10-24-starter-overhaul.md, phase B).
Done: dark mode removed on web (pre-paint script, theme.ts, ThemeToggle), mobile (useColorScheme, dark splash; `userInterfaceStyle` from `look.scheme`) and desktop (followSystemTheme, nativeTheme); `@app/tokens` split into `theme.css` (mapping, `dark:` never matches, `shadow-card`) + `tokens.css` (one `:root`, success/warning/font/card-shadow slots), `bun run tokens` → `colors.json` (oklch→hex) exported as `colors`; web themeMeta plugin (color-scheme + theme-color); `project.json` `look` (legacy forks get a placeholder); placeholder `/`; dev ribbon (web + mobile) + banner line + failing test while `look` is null; `.claude/skills/kickoff`; ui.md fill-in template; init writes a fresh updates.md and prints the kickoff step; merge=ours for tokens.css/colors.json/ui.md/updates.md, union for decisions.md; global CLAUDE.md rule (sals-powershell-setup 7fdb040). Repo re-formatted (prettier tailwind class order from phase A). Verified: typecheck, unit tests, web + desktop build, dev `expo export` (ribbon + native shadow-card compile), doctor 21/21, dev server banner + meta, bx screenshots of `/` and `/sign-up`. NOT verified: e2e (no E2E_DATABASE_URL yet), a device run.
Touched: packages/tokens/*, project.json, scripts/{project,init,sync}.ts, package.json, .gitattributes, .claude/skills/kickoff/SKILL.md, apps/web/{vite.config.ts,index.html,server/logger.ts,src/{index.tsx,app/{home,layout}.tsx,components/{kickoff-ribbon.tsx,ui/card.tsx},styles/app.css}}, apps/mobile/{app.config.ts,global.css,src/{app/_layout.tsx,lib/app-config.ts,components/{kickoff-ribbon.tsx,ui/{card,input}.tsx}}}, apps/desktop/src/{main/index.ts,renderer/{index.html,src/{main.tsx,styles/app.css,components/ui/card.tsx}}}, ui.md, CLAUDE.md, cliffnotes.md, README.md, verify.md, decisions.md, plan

## 2026-10-24 — overhaul phase A: bumps, fork-proven fixes, EAS lanes, Crow's Nest

Ask: audit the forks + versions and make the starter rock solid (plans/2026-10-24-starter-overhaul.md, phase A).
Done: security/patch bumps (better-auth 1.7.12, express 5.3, vite 6.4.5, prisma 7.10.1, tailwind-merge 3, lucide 1.x, playwright 1.64, electron 44.9.3, Expo 57.0.31 patches; @types/bun pinned via catalog); repo bunfig `minimumReleaseAge`; `server/asset-path.ts` (dotted routes render, +test); pg sessions in UTC; Drydock seed `workspace` + `bun run db:deploy`; `db:migrate:sql`; e2e port/DB from project.json (apiPort + 3); Crow's Nest tag + `cnEvent()`; mobile: `ota:preview|promote|prod` set APP_VARIANT, variant/scheme from the native bundle id (expo-application), `extra.apiUrl` fallback, iOS scene support, `fingerprint.config.js`, eas.json bun 1.4.3, root `.easignore`; `doctor` script fixed. Verified: typecheck all workspaces, unit tests, web + desktop build, `expo export --platform ios`, expo-doctor 21/21, playwright `--list`, dev server probe (dotted paths → SSR, assets → 404, tag served). NOT verified: e2e (needs DB creds), any EAS build/update, a dev-client build.
Touched: package.json, bunfig.toml, bun.lock, drydock.yaml, .easignore, prettier.config.js, scripts/{init,project}.ts, apps/web/{package.json,server.ts,server/{asset-path,asset-path.test,prisma}.ts,src/lib/crowsnest.ts,index.html,playwright.config.ts,e2e/{db,global-setup}.ts}, apps/mobile/{package.json,app.config.ts,eas.json,fingerprint.config.js,src/lib/{app-config,api-url,auth-client}.ts}, apps/desktop/package.json, packages/{tokens,trpc-ipc}/package.json, CLAUDE.md, cliffnotes.md, README.md, verify.md, decisions.md

## 2026-10-07 — desktop surface (Electron) for sal-git

Ask: Phase 0 of sal-git's plan (G:/code/sal-git/plans/2026-10-07-sal-git.md): an optional, thin Electron surface so sal-git can be a `--desktop-only` fork.
Done: `packages/tokens` (tokens moved out of web), `packages/trpc-ipc` (tRPC v11 over IPC, own link, 9 tests), `apps/desktop` (electron-vite 5, Electron 44.5.1, pinned data dir, single instance, saved bounds, sandbox + CSP, demo query/mutation/subscriptions, unpacked release via electron-builder API). `project.json` gains `surfaces`/`desktopPort`/`appId` (legacy forks migrated by sync); `init --desktop|--desktop-only`, `add:desktop` (add-mobile → add-surface), `sync`/`dev` per surface. Verified: typecheck + tests all workspaces, web build, built app + dev mode + packaged exe driven by Playwright (ping/echo/ticks). Electron 44.7.0 (plan) was blocked by the 3-day minimumReleaseAge, so 44.5.1.
Touched: packages/{tokens,trpc-ipc}, apps/desktop, apps/{web,mobile} token imports, scripts/\*, project.json, package.json, .gitignore, docs

## 2026-10-04 — Expo build fixes + instant OTA from Store Brand

Ask: port what Store Brand needed to build and ship on EAS, so the next project's first EAS build works.
Done: root cause traced (eas run at the repo root, then EAS_NO_VCS uploading only the app dir; see decisions). `.gitattributes` LF for fingerprint parity; eas.json pins bun 1.3.10 / node 22.22.2 and gives development a channel; app.config `updates` checkAutomatically ON_LOAD + fallbackToCacheTimeout 0, `ios.config.usesNonExemptEncryption`; `src/lib/ota.ts` mounted in the root layout; ship-a-fix + EAS-root docs. Verified: typecheck root + all workspaces, `expo config` resolves. NOT verified: an EAS build or update from the starter.
Touched: .gitattributes, apps/mobile/{eas.json,app.config.ts,src/lib/ota.ts,src/app/\_layout.tsx}, README.md, cliffnotes.md, decisions.md, verify.md, updates.md

## 2026-10-02 — monorepo + optional Expo app (branch `monorepo`)

Ask: turn sal-starter into a Bun workspace with an optional Expo iOS app (plan: pickleball `plans/2026-10-02-research-expo-starter.md`), Phases 0–2 and 4, Windows half of 3.
Done: app moved to `apps/web` (history kept, `v1-single` tag); root catalog + hoisted linker + `tsconfig.base.json`, TS 7 `tsc`, prisma-client generator, `project.json`, Drydock seed replaces render.yaml, tan→sal rename. `apps/mobile`: Expo SDK 57 dev client, Expo Router groups + `Stack.Protected`, better-auth Expo, tRPC, NativeWind 5 over shared `tokens.css` (+ native dark block), APP_VARIANTs, eas.json, local Swift module + `packages/native-example` with config plugin. `init --mobile`, `sync`, `add:mobile`; web-only lock regeneration. Verified: typecheck all workspaces, test 4/4, build, expo-doctor 21/21, autolinking verify, `expo export --platform ios`, introspected Info.plist, dev boots API 4780 + Metro 4781, `/healthz` ok, e2e 4/4 (baselines unchanged), init/sync/add:mobile in scratch clones. NOT verified: Mac/iPad dev-client build (Gate 3), EAS, Drydock deploy.
Touched: everything moved under apps/web; new apps/mobile, packages/native-example, scripts/{init,sync,add-mobile,dev,project,shell}.ts, project.json, package.json, bunfig.toml, tsconfig\*.json, drydock.yaml, .gitattributes, docs (CLAUDE.md, README, MIGRATION §21, cliffnotes, ui, decisions, verify)

## 2026-09-29 — template hardening (port, types, superjson, zod 4, migrations)

Ask: harden the template before the Frozen Ropes rebuild and future projects start from it.
Done: dev port = `PORT` (default 4780, init picks one per project, bans 3000 & co.); `noUncheckedIndexedAccess` + typecheck covers e2e/scripts/configs, all `as` casts removed; superjson on tRPC + SSR state with a unit and e2e proof that Dates survive hydration; zod 4; `prisma migrate` (initial migration, `db:migrate`/`db:migrate:create`/`db:deploy`, Render + e2e run `migrate deploy`, raw-SQL guide). Verified: typecheck, `bun run test` 3/3, build, e2e 4/4 on a throwaway local Postgres.
Touched: server.ts, server/{env,trpc,router,prisma}.ts, src/{index,entry-server}.tsx, src/lib/{trpc.tsx,ssr-state.ts,ssr-state.test.ts}, src/app/{routes,dashboard,home,layout}.tsx, e2e/\*, playwright.config.ts, prisma.config.ts, prisma/migrations/, scripts/init.ts, render.yaml, tsconfig.json, package.json, .env.example, docs

## 2026-09-11 — kill the unstyled flash on load + other load-time jank

Ask: fix the FOUC every load; find similar jank; make it incredible.
Done: stylesheet moved to a head `<link>` (FOUC gone in dev); flash-free dark mode with nav toggle + `color-scheme` + synced `theme-color`; `<ScrollRestoration />`; client-nav tRPC prefetch via `getBrowserClients()`; HMR websocket shares the Express server (fixed-port collision between clones); immutable `Cache-Control` for hashed assets. e2e screenshot baselines NOT regenerated (no DB creds in this session) — run `bun run test:e2e:update`.
Touched: index.html, server.ts, src/App.tsx, src/index.tsx, src/app/layout.tsx, src/app/routes.tsx, src/lib/trpc.tsx, src/lib/theme.ts, src/components/theme-toggle.tsx, src/styles/app.css, CLAUDE.md, MIGRATION.md, cliffnotes.md, ui.md, decisions.md
