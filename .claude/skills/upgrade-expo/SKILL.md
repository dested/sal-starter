---
name: upgrade-expo
description: Upgrade Expo (a patch of the current SDK, or a new SDK major) in a sal-starter repo or any fork, inside the 3-day minimumReleaseAge. Use when Sal says "upgrade expo", "bump the SDK", "move to SDK <n>", "expo is out of date", when `bun run doctor` fails its version check, or when the template has moved to a new SDK and a fork that no longer syncs needs the same. Runs `bun run upgrade:expo`, then verifies on Limrun.
---

# Upgrade Expo

`bun run upgrade:expo` (`scripts/upgrade-expo.ts`) does the mechanical part in
any repo with `apps/mobile`: it picks the newest `expo` older than the
release age whose companions are installable too, aligns the root catalog's
React to the SDK's, bumps `expo` in every workspace, runs
`EXPO_OFFLINE=1 expo install --fix`, keeps `catalog:` references, checks
Uniwind's RN floor, runs doctor + the mobile typecheck, and compares the
fingerprint before and after. Your job is the judgement around it.

Never bypass the release age (`bunfig.toml` `minimumReleaseAge`): no
`--minimum-release-age 0`, no exclusions, no hand-pinning a younger version.
When the script reports a release blocked, report its clear time and stop, or
upgrade to what is installable now.

## A patch of the current SDK

1. `bun run upgrade:expo --check`. Exit 0 = nothing installable to do (the
   `blocked` lines say what clears when); exit 3 = an upgrade is available.
   `--json` gives the same as data.
2. `bun run upgrade:expo`. It prints the doctor and typecheck results and
   either "native changed: rebuild the dev client" or "JS-only: hot reload is
   enough". Doctor failing only on versions the report listed as blocked is
   expected until they clear.
3. Native changed (it nearly always does: the `balanced` fingerprint hashes
   native packages by `name@version`): rebuild the dev client and run it
   (below). JS-only: hot reload in the running dev client is enough.
4. `bun run test`, `bun run typecheck` at the root, `bunx expo export
--platform ios` and `--platform android` in `apps/mobile`.
5. Commit `package.json` files + `bun.lock` together:
   `mobile: expo <from> → <to>`.

## A new SDK major

1. **Read before running.** The SDK's release post and changelog
   (`https://expo.dev/changelog`, "SDK <n>"), plus the CHANGELOGs of every
   package the report lists (expo-router, expo-updates, react-native-reanimated,
   react-native-screens). Note: breaking changes, removed config fields,
   new defaults (fingerprint preset, React Compiler, scene delegate), the React
   and React Native versions, and the Xcode / iOS minimum.
2. **Check the styling engine first.** The script warns when the SDK's RN is
   above the newest RN a known Uniwind release supports (`UNIWIND_FLOOR` in
   the script). If it does, find the Uniwind release that supports it
   (`https://github.com/uni-stack/uniwind/releases`), old enough for the
   release age, pin it exactly in `apps/mobile/package.json`, and add the row.
   No such release yet: stop and tell Sal; the SDK waits for Uniwind.
3. `bun run upgrade:expo --sdk <n> --check`, then `bun run upgrade:expo --sdk <n>`.
4. Fix what the typecheck and doctor report. RN's strict TypeScript API means no
   deep `react-native/Libraries/*` imports; React Router / navigation type
   changes land in `src/app` and `src/lib/nav-theme.ts`.
5. Things the script can't know:
   - `app.config.ts`: renamed or removed fields, new plugins `expo install`
     asked for ("Add the following to your Expo config": it can't write a
     dynamic config, so add them by hand).
   - `fingerprint.config.js`: keep the preset the SDK recommends.
   - `eas.json`: the `bun` pin equals the local Bun; the `node` image the SDK
     requires; `cli.version`.
   - Web and desktop share React through the catalog: run the root
     `bun run typecheck`, `bun run test` and `bun run build`, and
     `bun run test:e2e` if React moved.
   - Native modules in `modules/*` and `packages/*/ios`: the SDK's Expo Modules
     API changes.
6. Verify on Limrun (below), then the template docs.

## Verify on Limrun

Load the `limrun` skill first; its budget rules are not optional. Its "Expo
app with hot reload" recipe, with this repo's values (`project.json`
`metroPort`, `apiPort`, bundle id `<bundleId>.dev`, scheme `<scheme>dev`):

1. `lim xcode build <repo root> --configuration Debug --expo-app-dir apps/mobile
--upload <bundleId>.dev/<branch>-debug.zip` (a native change always needs this).
2. A simulator with the asset, the tunnel for Metro + API, `bun run dev`, open
   the dev client URL.
3. Check: sign in, sign up, Home's posts, a toast and the keyboard over a form,
   the brand splash hand-off (no white flash), and Home's dev row: the
   `fingerprint:` value equals `bun run --cwd apps/mobile fingerprint`
   (`--platform ios --variant development` are the defaults).
4. Screenshots go in the junk twin (`/w/junk/<repo>/limrun/`). Delete the
   instance and report the minutes.

A device run uses expo-wsl-ios (`npx expo-wsl-ios run` in `apps/mobile`);
store builds use EAS (`bun run build:preview`, then
`eas fingerprint:compare --build-id <id>` before the first `ota:*` to it).

## Docs after a major

In the template (forks: their own copies):

- `CLAUDE.md`: the stack table row, "Versions to be aware of" (Expo SDK, RN,
  React, Uniwind floor), any hard rule a new default changes.
- `cliffnotes.md`: the stack row and anything the map names that moved.
- `decisions.md`: one entry if the SDK forced a choice (an engine, a preset,
  a dropped package).
- `updates.md`: one entry with the before/after versions and what was verified.
