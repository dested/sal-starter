# sal-starter — Verify

> How to check a change. `[cheap]` checks run after every change; `[medium]` ones need the local Postgres or a scratch clone; `[heavy — ask first]` ones need a device, a billed service or a remote machine.

## Every change `[cheap]`

The four checks, on a copy of the working tree with its own databases. `gate` is the testing standard's runner (destedtui, `gate.json` here); without it, run the four scripts (they need the root `.env` `DATABASE_URL` only for its Postgres server).

```bash
gate --dirty                # every change: types, rules, api, flows on a copy of HEAD + your edits (no receipt)
gate                        # before a push to main: the same on a clean copy of the commit; writes the receipt
```

```bash
bun install                 # lockfile resolves; postinstall regenerates the Prisma client
bun run typecheck           # tsc --noEmit: root (scripts/, recipes/) + every workspace. Must be green
bun run test:rules          # names check, then *.rule.test.ts in every workspace, no environment (ssr-state, loader,
                            # env-schema, access, asset-path, test-DB guard, demo gate, tokens + kickoff, brand,
                            # mobile api-url + OTA hold)
bun run test:api            # *.api.test.ts: web on a fresh clone of sal_starter_test (builders contract, real-cookie
                            # context, me, posts.*, every procedure tested, access table current), trpc-ipc round
                            # trips, desktop router
bun run test:flows          # Playwright on :4783 against sal_starter_test_e2e (a clone): smoke, auth-next, demo
bun run access:table        # rewrites apps/web/server/router.access.md; no diff unless a permission changed
bun run build               # apps/web/dist/client + dist/server
bun pm why react            # exactly one react (the Expo SDK's version)
bun scripts/no-auth.ts --check   # the --no-auth edits still match the template (run after editing any file it lists)
bun run demo:drop --dry-run      # the demo's files and markers are all found (in the template: lists, changes nothing)
```

Seen red: a new check stays only after it has failed once. Break the line it guards in a scratch copy (never the tree another session works in), watch the check go red, put it back.

In the template `bun run test` and `bun run build` pass with the demo present (`project.json` `template: true`); in a fork both fail until `bun run demo:drop`, and the tokens test fails until the kickoff.

After any `tokens.css` or `packages/brand` change:

```bash
bun run tokens && bun run brand && bun run test   # colors.json and every brand output current (brand.gen.json unchanged on a second run)
```

Web boots without a database for pages that don't query:

```bash
bun run dev web             # → http://localhost:4780
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4780/                       # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4780/api/auth/get-session   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4780/manifest.webmanifest   # 200
curl -s http://localhost:4780/ | grep -o '<meta name="\(color-scheme\|theme-color\)"[^>]*>'  # look.scheme + colors.background
```

The look (after the kickoff): `bx` screenshots of `/`, `/sign-in` and the signed-in page at desktop width and 390px. No "Kickoff pending" ribbon, no neutral placeholder left, no template demo bar.

## Mobile `[cheap]`

Run in `apps/mobile`:

```bash
bun run doctor                                  # expo-doctor + expo-modules-autolinking verify (a patch inside the release age fails its version check until it clears)
bun run test                                    # api-url resolution, OTA hold gate
bun run fingerprint                             # ios + development hash (= Home's fingerprint row); --platform android, --variant, --json
bunx expo-modules-autolinking search            # app-native (+ @app/native-example in the template only)
bunx expo export --platform ios --output-dir .cache/export   # bundles the whole app (no device needed); --platform android too
bunx cross-env APP_VARIANT=development expo config --type introspect   # runs config plugins in memory
bun run upgrade:expo --check                    # (repo root) exit 0 up to date, 3 upgrade available; lists blocked releases and when they clear
```

In the introspect output: `ios.bundleIdentifier` and `android.package` end in `.dev`, the splash plugin has `brand.gen.json`'s color and width, `NSAllowsLocalNetworking` is present (and in the template `infoPlist.SalNativeExample`). With `APP_VARIANT=production` there's no ATS exception and no suffix. `expo prebuild --platform ios` refuses to run on Windows; introspect is the substitute.

With `bun run dev` running (API + Metro):

```bash
curl -s http://localhost:4781/status            # packager-status:running
curl -s -H "expo-platform: ios" http://localhost:4781/ -o /dev/null -w "%{http_code}\n"   # 200 manifest
```

## Desktop `[cheap]`

```bash
bun run --cwd apps/desktop build     # out/main, out/preload/index.cjs (~1 KB), out/renderer
bun run dev desktop                  # renderer on 4782 + the window (brand icon); ping, echo and ticking subscription all work
bun run release                      # release/win-unpacked/<name>.exe launches and shows the same (linux-unpacked in WSL)
```

Scripted check without clicking: Playwright's `_electron.launch({ args: ['apps/desktop'] })` (or `{ executablePath: '…exe' }`) and read `[data-testid=ping|echo|ticks]`. For dev mode, `bunx electron-vite dev --remoteDebuggingPort 9339` in `apps/desktop`, then CDP at `http://localhost:9339/json` (or `chromium.connectOverCDP`). State must land in `data/.private/electron`, nothing in `%APPDATA%`. In WSL, if `electron-vite dev` reports Electron missing, run `node node_modules/electron/install.js` first.

## Recipes `[medium]`

In a scratch clone (never the template), for each of `ai`, `ws`, `jobs`:

```bash
bun run add:<name> --dry-run    # the plan; no anchor missing
bun run add:<name>              # copies, installs, edits, formats, typechecks apps/web; commits nothing
bun run add:<name>              # second run: nothing to do
bun run test                    # the recipe's own *.api.test.ts (jobs runs on test:api's cloned database)
```

## Fork recipes `[medium]`

Never in the template itself. Each in a fresh scratch clone: `git clone /w/code/sal-starter <dir> && cd <dir> && git remote rename origin upstream && bun install`. Subagents can't run `git clone` (the agent-guard hook blocks it), so the lead runs these.

- **Web-only:** `bun run init demo-web` → commit "init: web-only", no `apps/mobile`, no `upgrade:expo` script, `bun.lock` without `expo` entries, `project.json` without `template`, `look: null`. typecheck green; `bun run build` FAILS ("The template Post demo is still here…"); `bun run test` fails on the demo test and the kickoff test only.
- **Demo gate and drop:** in that fork `bun run demo:drop --check` exits 1; `bun run demo:drop` deletes the demo files (its API tests too), strips the markers, writes `apps/web/prisma/migrations/<ts>_drop_post_demo/migration.sql`, regenerates `server/router.access.md` (only `me`) and prints the next steps. Then `bun run db:deploy`, typecheck, build, `test:rules` green apart from the kickoff test, `test:api` and `test:flows` green against a fresh `<name>_test` template the harness creates (the first run must not hang on the `/robots.txt` probe). `gate.json` still says `block`.
- **Mobile:** `bun run init demo --mobile --dry-run-eas` → commit "init: web + mobile (no native-example)" with the body line about `init --native-example`; that commit deletes `packages/native-example` and `apps/mobile/src/components/native-example-row.tsx` and removes the `@app/native-example` dependency, its `app.config.ts` plugin line and the `NativeExampleRow` lines in `home.tsx`; `bun.lock` has no `@app/native-example`. Output shows "EAS setup (dry run): @quickgame/demo" and its commands (`eas init --account quickgame --force --non-interactive --json --no-icon`, three `eas env:set --name APP_VARIANT …`, `channel:create production`, `channel:protect production`); no eas command ran; Next steps include `bun run --cwd apps/mobile eas:setup` and `bun run demo:drop`. `project.json`: `easOwner` quickgame, `easProjectId` null, `look` null, `surfaces` web + mobile. Green: typecheck, `bun run test` (kickoff + demo tests aside), and in `apps/mobile` `EXPO_OFFLINE=1 bunx expo export --platform ios`, `bun run fingerprint`, `bun run upgrade:expo --check` (exit 0 or 3).
- **Flag variants:** `bun run init demo --mobile --native-example --no-eas` keeps the package, label without "(no native-example)", prints "skipped EAS project (--no-eas; later: …)"; `bun run init demo --no-eas` fails "--native-example, --no-eas and --dry-run-eas only apply with --mobile."
- **No auth:** `bun run init noauth-app --no-auth` → typecheck green, no `better-auth` in any package.json or the catalog, no `apps/web/server/auth.ts`, sign-in/up gone, `server/router.access.md` has one column (`anyone`); after `bun run demo:drop`: build green, `test:api` green (an empty table, every-procedure check trivially), `bun run test:flows:update` then flows green; `/sign-in` and `/api/auth/*` 404.
- **Desktop:** `bun run init demo --desktop-only` → commit "init: desktop-only", no `apps/web`/`apps/mobile`/`drydock.yaml`, no web/db root scripts, `.env.example` without DB/auth, `gate.json` without `databases` entries or the `flows` check; install, typecheck, test, `bun run dev` (window), `bun run release` green. `bun run init demo --desktop` → web + desktop, commit "init: web + desktop".
- **add:mobile:** in the web-only fork → commit "add apps/mobile from upstream/main @ <sha>", `upgrade:expo` restored, typecheck green, next step points at `eas:setup`.
- **sync:** against an upstream commit that touches `project.json`, `apps/mobile`, `packages/native-example`, an auth file and a shared file → the fork's `project.json` kept, mobile and native-example changes dropped where the fork lacks them, the auth file kept deleted in a no-auth fork, shared file merged, nothing committed. A fork with no `gate.json` gets upstream's with `"mode": "report"`; a fork whose `gate.json` says `block` (or `report`) keeps it.

## Flows and API, by hand `[medium]`

Need the root `.env` `DATABASE_URL` to reach Postgres; the tests use the same server with the template `sal_starter_test` (created and migrated on first run) and clones of it (`sal_starter_test_p<pid>` for API tests, dropped at the end; `sal_starter_test_e2e` for flows). Under gate: `GATE=1 DATABASE_URL=<a fresh, migrated, empty db> bun run test:api` simulates it. A run takes seconds.

```bash
bun run test:flows          # Playwright on :4783 (apiPort + 3) against sal_starter_test_e2e: smoke, auth-next (?next=), demo
curl -s http://localhost:4780/healthz          # {"status":"ok",...} with bun run dev up
```

Screenshot diffs after an intentional UI change: `bun run test:flows:update`, then review and commit the PNGs.

Allowlist by hand (bx, a scratch DB): with `SIGNUP_ALLOWLIST=@allowed.test` another email gets the "Sign-up is invite-only…" message (403 `SIGNUP_CLOSED`), an allowlisted one signing up from `/sign-up?next=%2Fdashboard%3Fx%3D1` lands on `/dashboard?x=1`, an `ADMIN_EMAILS` address off the list still signs up, and `?next=//evil.com` lands on `/dashboard`.

## Device `[heavy — ask first]`

Limrun is the default (the `limrun` skill; billed minutes). With `bun run dev` up on Windows/WSL:

1. `lim xcode build . --configuration Debug --expo-app-dir apps/mobile --upload <bundleId>.dev/<branch>-debug.zip`, then a simulator with a tunnel to Metro + API.
2. Launch: the native splash hands off to BrandSplash with no jump, the mark grows as it fades, then sign-in.
3. Sign up → a post created there shows up on web `/dashboard` (and vice versa); sign out → sign-in (no "Unmatched Route").
4. Home shows "Hello from Swift"; the `fingerprint:` row equals `bun run --cwd apps/mobile fingerprint`.
5. Buttons give a press scale; a field near the bottom scrolls above the keyboard; a toast renders in token colors; a sideways drag mid-screen doesn't go back.
6. Kill the API → Home shows the "Can’t reach the server" card; Retry recovers once it's back.
7. Toggle the simulator's dark mode → the app does NOT change: same colors, keyboard and alerts in the look's scheme.

Sal's iPhone: expo-wsl-ios (`npx expo-wsl-ios run` in `apps/mobile`; Sal plugs in and trusts). The Mac only for what those can't do (`bun run ios:prebuild`, `bun run ios:device`).

## EAS and deploy `[heavy — ask first]`

- In a fork: `bun run --cwd apps/mobile eas:setup` creates `@quickgame/<name>`, writes `easProjectId`, sets `APP_VARIANT` in three EAS environments, protects production (in the template it refuses, exit 2).
- `bun run build:preview` (in `apps/mobile`) installs on a registered device; `bun run ota:preview` reaches it. `build:android:preview` gives an installable apk.
- Before any `eas update`: `eas fingerprint:compare --build-id <build>` says the local runtime matches the build's.
- OTA: publish a visible JS change with `bun run ota:preview --message "…"`, background and reopen the app → it reloads into the change (not under the splash).
- Promote: `bun run ota:promote` → the production build reloads into the same update (same update group id in `eas update:list`).
- Drydock: push → deploy green (a fork's deploy fails while the demo is present), `/healthz` 200, sign up on the deployed URL, the host shows up under Crow's Nest → Sites → Waiting to be claimed.
