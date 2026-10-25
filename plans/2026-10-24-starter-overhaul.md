# sal-starter overhaul: what the forks taught us, and the plan

- **Date:** 2026-10-24
- **Status:** active
- **Type:** analysis + plan
- **What:** audit of the 16 forks made from the starter, a live version check, and the plan to make the starter pretty by default, single-theme, EAS-ready and current

## Sources

- **Forks audited (read-only):**
  - Web-only: agent-test, doki, dray, gamecreatorsclub, llm-game, nbajam, sim-80k, weneedacontractor (in W:\code).
  - Web + mobile: homebase, house, mobile-game-2, project-zero, sal-app (in W:\code).
  - Windows-only: sal-excersize and tooth-and-tribe (G:\code, web + mobile), and sal-git (G:\code, desktop-only).
  - Older single-package starter: video-studio.
  - Every workspace fork's init commit sits on starter `e616e1e`, so `git diff e616e1e HEAD` in a fork shows exactly that fork's own changes.
- **Versions:** checked live against npm and the official changelogs on 2026-10-24.
- **Not run:** no builds, installs or devices. The items needing a real run are marked **verify**.

## What the forks say

| Finding                                                          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The starter landing is noise                                     | `/` replaced in 13 of 16 forks, 9 of them within about 1.5 h of init. sal-app still ships the stack-cards page 33 h later. The Post demo is still there in 7, the starter nav in 7, the favicon in 10, the starter meta description in 3. 7 forks' e2e smoke still asserts the old landing, so it can't pass                                                                                                                                                                                                                                                                                                                                                |
| Distinctive looks came from a written direction, not from shadcn | 15 of 16 added fonts (3 different loading methods). The best ones (doki, nbajam, sim-80k, homebase, gamecreatorsclub, weneedacontractor, llm-game) each wrote a north star with failure modes first, used custom display + body fonts, dropped shadcn's neutral surfaces, and built their own component kit. 13 of 15 never touched the 4 shadcn primitives. The 3 that kept the starter's north star look like the starter                                                                                                                                                                                                                                 |
| The token setup fights a rebrand                                 | 9 forks put their brand outside `tokens.css`, and 5 run two palettes side by side. The body font is hardcoded (no `--font-sans` slot). One new token takes 4 edits (`@theme`, `:root`, `.dark`, the native block). 3 forks hand-built a typed JS mirror of the tokens for SVG, Skia and navigator colours. 6 added success/warning tokens                                                                                                                                                                                                                                                                                                                   |
| Dark mode is cost with no payoff                                 | 7 kept the toggle only because they never touched the nav. 4 forced a single theme by hand (about 100 lines in 5 files; 2 left dead code). Every real dark-mode bug was on mobile: React Navigation's own `#F2F2F2` background (all 5 real mobile forks override it), and `SafeAreaView` dropping `className` (white-on-white on a device, sal-app 4ae56c5). 3 of 5 mobile forks forced one scheme                                                                                                                                                                                                                                                          |
| EAS works, but the starter's lanes are broken                    | Every fork that used EAS (4 of 4) hit a local-vs-EAS fingerprint mismatch. homebase gave up and switched to `appVersion`. The `ota:*` scripts publish against the production config (`APP_VARIANT` lives only in the eas.json build env, which `eas update` doesn't read). A missing `EXPO_PUBLIC_API_URL` crash-looped two OTAs in sal-excersize, and expo-updates silently rolled them back. EAS uploads need a `.easignore` (homebase's first upload was 1.5 GB). `@types/bun: "latest"` broke EAS frozen installs. Proven anyway: mobile-game-2 has a production build in App Review with a production OTA landed; sal-excersize ran preview end to end |
| Drydock deploys work                                             | 10 of 15 workspace forks are live. The starter's "unverified" note is stale. The seed `drydock.yaml` lacks `workspace: "@app/web"`, and `bunx prisma migrate deploy` now pulls the **Prisma 8 RC** (npm `latest` points at it)                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Crow's Nest                                                      | in 0 of 16 forks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## The plan, by ask

### 1. Home page: gone, replaced by a kickoff

- **Kill the stack-cards landing.** `init` leaves a placeholder `/`: the displayName plus, in dev only, a "Kickoff pending" ribbon.
- **Demo out of new forks.** `init` also strips the Post demo (model, router, dashboard UI) and writes a hand-written `drop_post_demo` migration.
  - The starter's own migration history stays as is, so existing forks never get a destructive migration on sync.
  - The SSR + client prefetch pattern stays as a working reference: the signed-in page prefetches `me`.
- **A kickoff skill that every fork inherits:** `.claude/skills/kickoff/SKILL.md`, committed in the starter so it travels with every fork.
  - The starter's `CLAUDE.md` opens with hard rule 0: "Kickoff before any feature work."
  - `init` prints "Next: kickoff".
  - The kickoff:
    1. **Asks Sal one round:** what the product is; the look (3 directions, or "wing it"); light or dark; what `/` is (marketing, the app, a redirect, a game); auth (accounts, gated, none).
    2. **Shows 3 directions** as one comparison image or page. Each direction has a name, a north-star sentence, its failure modes, a single-scheme palette, a type pairing, a surface rule and one signature move. It follows the `frontend-design` skill; the image comes from `openai-image`. For a big product it hands off to `mock-first` instead.
    3. **Builds:**
       - `tokens.css` (one scheme);
       - the same font families on web (`@fontsource-variable`) and mobile (`@expo-google-fonts`);
       - restyled primitives;
       - the real `/`, nav and layout;
       - favicon, app icon and splash;
       - meta and OG description;
       - the `ui.md` north star;
       - `project.json` `look`.
    4. **Checks it** in bx (web) and on Limrun or Expo web (mobile), screenshots it, and shows Sal.
- **Forcing function** (decision Q2): while `project.json` `look` is `null`:
  - the dev server banner and a dev-only ribbon say kickoff is pending;
  - `bun run test` fails with "run the kickoff" (the starter repo itself is exempt).
  - An agent can't call a project done without the kickoff.
- **`init` also cleans up:**
  - it truncates the starter's history out of the fork's `decisions.md` and `updates.md`, leaving a pointer upstream (today all 15 forks carry it verbatim);
  - it writes the meta description from the displayName;
  - it rewrites the e2e smoke test to check routing, auth and 404, with no landing copy.

### 2. Look and feel: no more neutral shadcn

- **No new "house default" look.** At 10 apps a day, any default becomes the new sameness. The starter's tokens become an explicit placeholder that the kickoff always replaces.
- **More token slots, so one file restyles everything** (web, mobile, desktop):
  - `--font-sans`, `--font-display`, `--font-mono`, with the body font read from the token;
  - `success`, `warning` and `-foreground` variants next to `destructive`;
  - `--radius` plus border width and a card shadow, so the surface rule is a token, not edits across components.
- **A typed TS export of the tokens:** `@app/tokens` exports `colors` and `fonts` for SVG, Skia, navigator and placeholder colours. A test keeps it in step with the CSS. This replaces the 3 hand-made palette mirrors.
- **`ui.md` becomes a fill-in template:**
  - north star + failure modes, palette roles, type pairing, surface rule, motion moment;
  - your global rules baked in: no eyebrows, no taglines or helper text, no periods in headers;
  - a rule that the brand replaces `tokens.css` values and never adds a second `:root` in `app.css`.
- **shadcn stays the behaviour layer only.**
  - `components.json` moves to shadcn's 2026 default (Base UI), so `shadcn add` matches the docs agents read.
  - `tailwind-merge` 3 (2.x doesn't know Tailwind v4 classes, so `cn()` merges are wrong today).
  - Primitives are styled from tokens.
- **Mobile, pretty by default:**
  - a `Screen` scaffold that owns safe area and background;
  - a `Button` with haptics and a press animation;
  - fonts loaded at the root behind the splash;
  - the navigator background from the tokens;
  - `GestureHandlerRootView` mounted;
  - a `styled()` SafeAreaView.
  - 4 of 5 forks built the scaffold, 5 of 5 fixed the navigator background.
  - With SDK 58 come the Liquid Glass header, native tabs and SF Symbols.

### 3. Dark mode: removed everywhere

- **Web:**
  - delete `theme.ts`, `theme-toggle.tsx` and the pre-paint script;
  - `color-scheme` and `theme-color` come from `project.json` `look`;
  - `@custom-variant dark (&:not(*))`, so the `dark:` classes inside copy-pasted shadcn components can never switch on. Tailwind v4's default `dark:` follows the OS, which is how dark mode keeps sneaking back in.
- **Tokens:** a single `:root` block. The `.dark` block, the native dark block and the parity test go.
- **Mobile:**
  - `userInterfaceStyle` comes from `look.scheme`, so the OS can't flip the app or its keyboard, alerts and pickers;
  - one splash colour, one `StatusBar` style, one `SystemUI` background.
- **Desktop:** no `followSystemTheme`; a fixed window background.
- **Docs:**
  - rewrite hard rule 10;
  - add superseding entries to `decisions.md` for the 2026-09-11 and 2026-10-02 dark-mode decisions;
  - add "no dark mode, no toggle, ever" to your global `CLAUDE.md` (`G:\code\sals-powershell-setup\claude\CLAUDE.md`, committed there).
- **Existing forks:** `tokens.css`, `app.css` and `ui.md` get `merge=ours`, so `bun run sync` never touches a fork's look. The forks that designed both themes keep them.

### 4. Latest Expo, which forces the styling-engine decision (Q1)

- **The blocker:** Expo SDK 58 (58.0.19: RN 0.88, React 19.3) is out. NativeWind 5 is still `rc.0`, and its SDK 58 support is "in progress".
  - Its `lightningcss 1.30.1` override also blocks Vite 8 (which needs ^1.33) and Tailwind 4.3.
  - So staying on NativeWind means staying on SDK 57, Vite 6 and Tailwind 4.1.12.
- **Recommendation: switch to Uniwind 1.13**, after a spike against `@app/tokens`.
  - It's stable, ships its own lightningcss, and already has RN 0.88 fixes.
  - It uses the same Tailwind classes, and HeroUI Native is built on it.
  - With dark mode gone, the token mapping is a single `:root`, so the hard part of the spike disappears.
  - This reverses the 2026-10-02 decision. Its objection to Unistyles and Tamagui was "a second styling language", and that doesn't apply here.
- **SDK 58 brings:**
  - the `balanced` fingerprint preset, which ignores version bumps and node_modules churn: the main fingerprint fix;
  - `maxUpdatesToKeep`;
  - the iOS 27 scene delegate generated for you (SDK 57 needs `enableSceneSupport` on Xcode 27);
  - stable native tabs and the Liquid Glass header;
  - React Compiler on by default.
- **Then:**
  - React 19.3 unblocks React Router 8 (typed middleware context replaces `isSsrContext`, `react-router-dom` goes away);
  - dropping the override unblocks Vite 8 + plugin-react 6, electron-vite 6 and Tailwind 4.3.
- **Mobile baseline additions,** with no permission strings or entitlements, so one dev build covers them:
  - expo-haptics, expo-image, expo-font with `@expo-google-fonts`, expo-symbols;
  - react-native-svg + lucide-react-native (icon parity with web);
  - expo-file-system, expo-device, expo-application, expo-keep-awake;
  - react-native-keyboard-controller, sonner-native, FlashList v2.
  - Notifications, camera, audio and image-picker stay opt-in: push broke mobile-game-2's ad-hoc profile.
- **Trim:** `packages/native-example` is unused at runtime by every real fork, so it's dropped from init by default. `modules/app-native` stays (6 of 7 kept or grew it).
- **Android:** `android.package` with the variant suffix, and an apk build on the development and preview profiles (3 forks added these).

### 5. EAS Update, plumbed from day one

- **`init --mobile` creates the EAS project.**
  - It runs `eas init --non-interactive` under **quickgame**: eas-cli here is logged in as quickgame, and the forks' projects live there.
  - It writes `easProjectId` and `easOwner` to `project.json`.
  - So updates are on from the first build, not "off until someone runs `eas init`".
- **Fix the variant bug:**
  - put `APP_VARIANT` in the EAS environments (`eas env:create`, one per environment), so builds and updates evaluate the same config;
  - derive the scheme at runtime from the native bundle id, so a preview-tested bundle is valid in production.
- **Scripts:**
  - `ota:preview`;
  - `ota:promote` (`eas update:republish --channel preview --destination-channel production`, which ships the exact tested artifact);
  - `ota:prod`;
  - `fingerprint:compare` per profile, which gates every OTA (documented, and scripted where it can be).
- **Fingerprint parity:**
  - eas.json `bun` pinned to the local 1.4.x (1.3.10 vs local 1.4 names `.bun-tag-*` files differently, mobile-game-2 59ff831);
  - a `.fingerprintignore`;
  - SDK 58's `balanced` preset.
  - **Verify** with one real EAS build from WSL.
- **No crash without an API URL:** `extra.apiUrl` defaults to `https://<name>.dested.com`, which matches Drydock, and `api-url.ts` falls back to it.
- **Hygiene:**
  - a root `.easignore` (it replaces every `.gitignore` on EAS);
  - `@types/bun` pinned everywhere;
  - `channel:protect production`.
- **OTA apply policy:** decision Q3.

### 6. Crow's Nest: always on

- `<script defer src="https://cn.dested.com/cn.js"></script>` goes in `apps/web/index.html`.
  - It's silent on localhost, so dev and e2e stay clean.
  - It needs no site key; the host appears in Crow's Nest as pending.
- The kickoff checklist gets one more step: claim the host in the Crow's Nest dashboard after the first deploy.
- Playwright blocks `cn.dested.com`, so e2e never touches the network.
- Crow's Nest is web-only, so there's nothing to add on mobile or desktop.

### 7. Prisma: hold on 7, bump to 7.10.1

- Prisma 8 is `8.0.0-rc.27`, and it's a rewrite:
  - no `PrismaClient`, and every query becomes a chain;
  - `DateTime` comes back as `Temporal.Instant`, which breaks our superjson `Date` contract;
  - no `$extends`, no TypedSQL, limited nested writes;
  - **no better-auth adapter**.
- GA is "expected October 2026", and Prisma 7 then gets 18 months of fixes. **Not worth it now.** Revisit after GA plus a better-auth adapter.
- **The real hazard today:** npm `latest` = 8 RC, so any `bunx prisma` pulls the RC.
  - The Drydock seed moves to `bun run db:deploy`.
  - The docs say never `bunx prisma`.
- **Add `options: '-c TimeZone=UTC'` to the pg adapter.**
  - It shifts timestamps by the server's time zone otherwise (mobile-game-2 2a2a226; homebase worked around it in SQL).
  - Your local Windows Postgres probably isn't on UTC.
- **Add a recipe for when `prisma migrate dev` refuses to run** in an agent's non-interactive shell: `migrate diff --script`, then deploy (homebase's).

### 8. Library changes

| Change                                                                               | Why                                                                                                         |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| better-auth + @better-auth/expo 1.7.6 → 1.7.12                                       | security: critical magic-link takeover fixed in 1.7.7, reset and JWT hardening after it                     |
| express 5.3.0, vite 6.4.5 (then 8), prisma 7.10.1, zod 4.6.7, TanStack Query 5.104.5 | security fixes and patch releases                                                                           |
| tailwind-merge 2 → 3.7 (or shadcn's `cn` package)                                    | 2.x targets Tailwind v3                                                                                     |
| lucide-react 0.468 → 1.x                                                             | stale by about two years; v1 sets aria-hidden by default                                                    |
| React Compiler on (mobile now, web with Vite 8)                                      | Expo's own template enables it                                                                              |
| `react-router-dom` → `react-router` 8                                                | after React 19.3                                                                                            |
| Playwright 1.64, Prettier 3.9 + plugin 0.8 with `tailwindStylesheet`                 | class sorting currently ignores our tokens                                                                  |
| electron 44.9.3, electron-builder 26.18                                              | patch line (45 is 3 days old: wait)                                                                         |
| Mobile: Uniwind, plus the baseline list in §4                                        | §4                                                                                                          |
| **Not added:** sonner, cmdk, radix-ui, motion on web                                 | 1 of 15 forks each; the games hand-roll toasts and motion. The kickoff adds them when a look calls for them |

### 9. Bugs and fixes from the forks (no decisions needed)

- **SSR 404s real pages.** `LOOKS_LIKE_FILE` in `apps/web/server.ts:24` treats any dotted last segment as a file. Four forks fixed it separately. Fix: an explicit asset-extension list plus a test.
- **Drydock seed:** `workspace: "@app/web"`, `predeploy: bun run db:deploy`, and drop "unverified" from the docs.
- **e2e port** from `project.json`, not a shared 3100 with `reuseExistingServer` (one fork's e2e can silently test another fork's server).
- **Mobile:**
  - the navigator `ThemeProvider` and `contentStyle` from the tokens;
  - a `styled()` SafeAreaView;
  - a `Pressable` style function plus `className` gets dropped (document it, and the `Button` never passes one);
  - a mobile `test` script.
- **`minimumReleaseAge` isn't enforced in WSL.** It lives only in `C:\Users\dested\.bunfig.toml`. Add it to the repo `bunfig.toml` so every fork carries it.
- **Docs:**
  - replace the Mac + iPad device recipe with Limrun (run and test), expo-wsl-ios (device) and EAS (distribution);
  - the gotchas the forks paid for: iOS 26 `fullScreenGestureEnabled`, ASC demanding a microphone string because of a linked SDK, Expo running config-plugin mods last-registered first.

### 10. Server slots that forks keep rebuilding (decision Q4)

Each one is the same code written again by several forks:

- **Sign-in `?next=` return plus a loader helper** (`loaderClients(context)`, `requireSession`): 6 and 5 forks.
- **Sign-up allowlist** (`SIGNUP_ALLOWLIST`, blank means open) **plus `ADMIN_EMAILS` and `adminProcedure`**: 5 and 4 forks.
- **An optional-secret env helper**, so a deploy never fails before a key is set: 5 forks.
- **`init --no-auth`:** 4 forks hand-deleted better-auth across about 8 files.
- **Anthropic module** (`server/ai/claude.ts`): 6 forks converged on the same shape:
  - a lazy client and an optional key;
  - an `AI_FAKE` mode for tests;
  - zod structured output and `cache_control`;
  - cost logging.
- **WebSocket upgrade registry plus tRPC subscriptions over WebSocket:** 4 forks. SSE subscriptions used up Chrome's 6 connections per host, so mutations queued forever (video-studio).
- **Postgres job queue** (`SKIP LOCKED`, retries, started after listen): 6 forks, two near-identical.

## Open decisions

| #   | Question                                                                                 | My pick                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Mobile styling engine for SDK 58                                                         | **Decided:** Uniwind, after a spike                                                                                                                       |
| Q2  | How hard the starter forces the kickoff                                                  | **Decided:** ribbon, plus `bun run test` failing until `look` is set. The kickoff shows 3 directions and Sal picks one (mock-first only for big products) |
| Q3  | OTA apply policy                                                                         | **Decided:** keep the instant reload, on launch and on resume (my pick was splash-only)                                                                   |
| Q4  | Which server slots ship by default                                                       | **Decided:** ?next/loader helpers, the allowlist + admin, and the optional env helper as defaults; AI, WebSocket and jobs as `add:*` recipes              |
| Q5  | Expo web preview for bx (3 of 5 mobile forks added it to check screens without a device) | Not in the baseline: Limrun is the source of truth. The kickoff can add it per project                                                                    |
| Q6  | EAS Workflows: push to main publishes a preview OTA                                      | Off by default (builds are billed; Drydock already deploys web on push)                                                                                   |

## Execution order

1. **A, no decisions needed:**
   - the security and patch bumps;
   - the LOOKS_LIKE_FILE fix and the UTC pin;
   - the Drydock seed and the tailwind-merge 3 bump;
   - the `ota:*` variant fix, `.easignore`, the `@types/bun` pin, `apiUrl` and the bun pin;
   - Crow's Nest, the repo `bunfig.toml` release age, the e2e port, and the doc fixes.
2. **B, single theme plus kickoff:** remove dark mode, reshape the tokens (slots, typed export, one `:root`), the kickoff skill and forcing function, `init` changes (placeholder `/`, fresh `updates.md`), and the `ui.md` template.
   - Moved out of B while building it: stripping the Post demo is a kickoff step, not `init` (the first real feature replaces it, with its own drop migration and e2e update); `init` keeps `decisions.md` (its entries bind forks; it merges with `merge=union`); EAS project creation in `init --mobile` goes to C (it creates real EAS projects); `init --no-auth` goes to E with the other auth work. `tokens.css` split into `theme.css` (mapping, merges) and `tokens.css` (values, `merge=ours`) instead of putting `merge=ours` on `app.css`.
3. **C, Expo 58:** the styling spike (Q1), SDK 58, the mobile baseline and scaffold, `init --mobile` creating the EAS project, the EAS promote lane, and the fingerprint **verify** (one EAS build).
   - 2026-10-24: SDK 58 landed on expo 58.0.17 with Uniwind 1.13 and Tailwind 4.3.3.
   - **Done 2026-10-25** (7abf924, f450c66, c7f8c00, 74243a9, b16cba9, d5b2c37, 1e5b136, f0e1c7e). Changed vs the plan:
     - `init --mobile` runs `scripts/eas-setup.ts`, which drives eas-cli from a throwaway static `app.json` (`eas init` can't save the id into a dynamic config); `--no-eas`, `--dry-run-eas`; it never fails init and refuses in the template.
     - The fingerprint row's `1` is fixed: it reads the hash the build wrote (`EXUpdates.bundle/fingerprint`), and `bun run fingerprint` hashes per platform + variant like EAS.
     - `bun run upgrade:expo` (+ the `upgrade-expo` skill) replaces hand-run `expo install --fix` inside the release age.
     - Baseline libraries as planned except expo-application (already in) and `@expo-google-fonts` (the kickoff adds the family; `FONTS` is wired empty). Plus `useOtaHold`, `Screen`, haptic `Button`, sonner-native `Toaster`, `fullScreenGestureEnabled: false`, Android profiles + package.
     - Brand pipeline (not in the plan's list, asked for during C): `packages/brand` + `bun run brand` and `BrandSplash` (aa117d1, a7c7a82).
   - **Open:** the Expo patch bump after 2026-10-26 ~23:30Z (expo 58.0.19, expo-dev-client 58.0.15, expo-router 58.0.26 and companions): `bun run upgrade:expo`, then `bun run doctor` green. A Limrun run of the new dev client (BrandSplash hand-off, the new native libraries, the fingerprint row). The fingerprint **verify** on a real EAS build and a real `eas-setup` run.
4. **D:** React 19.3 → React Router 8; Vite 8, plugin-react 6 and electron-vite 6; Tailwind 4.3; React Compiler on web.
   - 2026-10-24: React 19.3 and Tailwind 4.3.3 (catalog, all three apps) landed with C.
   - **Done 2026-10-25** (260e982, c32fc76, 4b40f9b, f5e27b9, 60c992a, e36b3be, ca1a8fe, 7b0dae0, 48c7e47, 39968eb). Changed vs the plan:
     - The typed context is `createContext` keys filled by `entry-server.tsx` and `getContext: browserContext`, not middleware (the static handler runs middleware only with `generateMiddlewareResponse`). `getContext` made navigations async, which broke sign-out until it awaited `navigate`.
     - React Compiler on desktop too, through `@rolldown/plugin-babel` (plugin-react's Rust option is experimental).
     - shadcn moved to Base UI (`base-nova`) here, and `cn` (shadcn's package) replaced tailwind-merge 3 + clsx on web and desktop; mobile keeps tailwind-merge 3.
5. **E:** the server slots from Q4, plus SIGNUP_ALLOWLIST, ADMIN_EMAILS + `adminProcedure`, the sign-in `?next=` return and `init --no-auth`.
   - **Done 2026-10-25** (e67d630, 3e5b01c, a161fa4, 4ccc2bf, f237e71, 9e4c188, 6bc4ba4; sync for no-auth forks 653a79a). Changed vs the plan:
     - The loader helper is `requireSession` / `redirectIfSignedIn` on the RR8 context; there is no `loaderClients(context)` (`context.get(clientsContext)` does that).
     - Recipes are copy-in scripts (`recipes/`, `bun run add:ai|ws|jobs`) that never commit; the Anthropic SDK is ^1.1.0 (1.2.0+ was inside the release age).
     - `init --no-auth` keeps posts as an anonymous demo on a public `/dashboard`; `sync` detects a no-auth fork from disk (no `apps/web/server/auth.ts`), not a project.json field.
6. **The Post demo** (added 2026-10-25, Sal: nine forks shipped it): the plan's "init strips the demo" became a gate instead. The demo lives in its own files and marked lines; in a fork (`project.json` without `template: true`) `vite build` and `bun run test` fail until `bun run demo:drop`. Verified in scratch forks (`init demo-app --mobile --dry-run-eas`, `init noauth-app --no-auth`) through demo:drop, build and e2e (2d62573, 3f5ae7f, 757a90e).

Every phase runs typecheck, test and build, plus an init → typecheck → build pass in a scratch clone. e2e needs your local Postgres credentials (**ask**). The first EAS build and the Limrun run need a go-ahead (billed).
