# The testing standard in sal-starter

**Status:** done (sal-starter's side). Parts 1, 2 and 3 done 2026-11-20. What's left belongs to the lead (below).

Sal's brief (via the /w/code lead, 2026-11-20): one testing standard for every future repo, enforced by tooling; sal-starter first because every repo forks it. Contract with `gate`: `/w/junk/code/testing-strategy/spec/gate-contract.md`. The standard itself is public: https://github.com/dested/testing-standard. Planted bugs: `/w/junk/code/testing-strategy/out/probe-sal-starter.jsonl`.

## Part 1: names, the API check, the access table, gate.json (done)

- Every test file renamed to `*.rule.test.ts` / `*.api.test.ts` (flows became `*.flow.spec.ts` in Part 2); `scripts/test-names.ts` fails anything else, first in `test:rules`.
- Scripts root and per workspace: `test:rules`, `test:api`, `test:flows`; `test` = rules then api; `test:e2e*` alias the flows scripts. `scripts/test.ts` runs a kind across workspaces one at a time.
- `apps/web/test/`: template + clone databases (`db.ts`), the test environment (`env.ts`, never the root `.env`), preloads, callers (`asAnon` / `asUser` / `asAdmin` through better-auth), the access table generator, the every-procedure check.
- tRPC meta tags on the three builders, `server/procedure-access.ts`, `server/router.access.md` (`bun run access:table`), the builders contract (`server/trpc.api.test.ts`), API tests for `me`, `posts.list`, `posts.create`.
- Rules added: `isAssetPath` for extension-named pages, the test-database guard.
- `gate.json`; init fits it (desktop-only drops db + flows); demo:drop and no-auth regenerate the table. (Part 1 shipped it in block mode; Part 3 moved everything to report.)

## Part 2: the flows check (done)

- The third name is `*.flow.spec.ts` (bx owns `flows/<name>.flow.ts`; the names check skips a top-level `flows/`). `ALLOWED_FOR_NOW` is gone.
- `apps/web/e2e/flow.ts`, the one fixture file: a server per worker on the production build (`e2e/server.ts`: free port, its own clone, `test/env.ts`'s `testEnv`, output attached to a failing test, stopped and dropped at worker end); `world.signIn('user' | 'admin')` / `world.account()` through `/api/auth` with `test/people.ts`; `emptyDatabase` (its own server and clone); one `x-forwarded-for` per test (better-auth's production rate limiter); automatic checks (page error, `console.error`, ≥ 500, failed same-origin request, horizontal overflow) with `problems.allow(kind, /pattern/)`.
- `e2e/coverage.ts`, a reporter: every route in `src/app/routes.tsx` (read from the router through `e2e/screens.ts`) and the 404 landed on in each project, else the run fails naming `<route> in <project>`; a partial run skips it and says why.
- Projects `desktop` 1280×800 and `phone` 390×844 (touch), baselines per project, `fullyParallel`, 10 s navigation/action timeouts; `test:flows` builds first.
- 16 flows: `shell/home`, `shell/not-found`, `shell/not-found-asset`, `shell/dashboard`, `auth/sign-up`, `auth/sign-up-short-password`, `auth/sign-up-next`, `auth/protected-redirect`, `auth/sign-in-next`, `auth/off-site-next`, `auth/sign-out`, `auth/dashboard-ssr`, `auth/session-check-retry`, `auth/session-check-error`, `demo/posts-create`, `demo/posts-empty`.
- Found by the phone project: the signed-in header's email overflowed 390px; it now hides below `sm`.
- Decided: `layout.tsx` `replace: true` is covered (`auth/sign-out` presses Back); the `prisma.ts` singleton line is covered (`server/prisma.api.test.ts`); `entry-server.tsx`'s body line carries `probe-ignore` (server.ts sends only GET and HEAD there).
- Root `postinstall` guarded in the script line (removed again in Part 3).

### Seen red (a clean copy of 523f9fe, one at a time)

| planted                                            | check | failed                                                                           |
| -------------------------------------------------- | ----- | -------------------------------------------------------------------------------- |
| `sign-up.tsx` `minLength={8}` → `{9}`              | flows | auth/sign-up, auth/sign-up-next, auth/off-site-next (both projects)              |
| `posts-demo.tsx` `isLoading &&` → `\|\|`           | flows | demo/posts-create, demo/posts-empty                                              |
| `posts-demo.tsx` `length === 0 &&` → `\|\|`        | flows | demo/posts-empty                                                                 |
| `router-context.ts` `attempt = 1` → `2`            | flows | auth/session-check-retry, auth/session-check-error                               |
| `router-context.ts` `attempt === 2` → `3`          | flows | auth/session-check-error                                                         |
| `router-context.ts` `status \|\| 'network'` → `&&` | flows | auth/session-check-error                                                         |
| `auth.ts` `enabled: true` → `false`                | flows | 11 flows; coverage: `/dashboard` in both                                         |
| `auth.ts` dropped `!` on `signUpAllowed`           | api   | every test that signs someone up (10)                                            |
| `error-boundary.tsx` `=== 404` → `405`             | flows | shell/not-found                                                                  |
| `sign-up.tsx` `useState(false)` → `true`           | flows | auth/sign-up, sign-up-short-password, sign-up-next, off-site-next                |
| `sign-up.tsx` dropped `e.preventDefault()`         | flows | auth/sign-up, sign-up-next, off-site-next                                        |
| `layout.tsx` `replace: true` → `false`             | flows | auth/sign-out                                                                    |
| `prisma.ts` `!==` → `===`                          | api   | prisma client › is reused across reloads outside production                      |
| a `console.error` on `/`                           | flows | shell/home, shell/dashboard, auth/sign-out, session-check-* (console)            |
| an invisible absolute 500px div on `/`             | flows | shell/home and auth/sign-out in **phone only** (overflow 524px in 390px)         |
| `me` throws                                        | flows | 10 flows (500 from `/api/trpc/me`)                                               |
| the three flows landing on `/sign-in` deleted      | flows | coverage: `/sign-in in desktop`, `/sign-in in phone`                             |
| `e2e/extra.spec.ts` importing `./flow`             | rules | names check: rename to `*.flow.spec.ts`; a bx `flows/login.flow.ts` alone passes |

## Part 3: report mode everywhere (done)

Sal, 2026-11-20: "i dont want anything gates for now." `gate.json` is `"mode": "report"` in the template, init and sync keep every fork there (`fitForkGate`, `bun scripts/gate.ts --fit`), `--keep-mode` and the root `postinstall` are gone, and every doc says `gate` runs and reports. The checks are unchanged.

## Left for the lead

- The probe replay: done by the lead on d7821e0, 0 of the 40 planted bugs got through (16 before).
- QA flows: map Sal's QA checklist to the `<feature>/<flow>` slugs in the test titles.
- The agent guard (destedtui): with every repo in report mode, nothing to enforce; `gate allow-weaken` for this commit's block → report change.
