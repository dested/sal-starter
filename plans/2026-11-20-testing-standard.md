# The testing standard in sal-starter

**Status:** active. Part 1 done (2026-11-20). Part 2 next.

Sal's brief (via the /w/code lead, 2026-11-20): one testing standard for every future repo, enforced by tooling; sal-starter first because every repo forks it. Contract with `gate`: `/w/junk/code/testing-strategy/spec/gate-contract.md`. Evidence: `/w/code/sal-starter/plans/artifacts/testing-strategy.html`, planted bugs in `/w/junk/code/testing-strategy/out/probe-sal-starter.jsonl`.

## Part 1: names, the API check, the access table, gate.json (done)

- Every test file renamed to `*.rule.test.ts` / `*.api.test.ts` (flows stay `e2e/*.spec.ts` until Part 2); `scripts/test-names.ts` fails anything else, first in `test:rules`.
- Scripts root and per workspace: `test:rules`, `test:api`, `test:flows`; `test` = rules then api; `test:e2e*` alias the flows scripts. `scripts/test.ts` runs a kind across workspaces one at a time.
- `apps/web/test/`: template + clone databases (`db.ts`), the test environment (`env.ts`, never the root `.env`), preloads, callers (`asAnon` / `asUser` / `asAdmin` through better-auth), the access table generator, the every-procedure check.
- tRPC meta tags on the three builders, `server/procedure-access.ts`, `server/router.access.md` (`bun run access:table`), the builders contract (`server/trpc.api.test.ts`), API tests for `me`, `posts.list`, `posts.create`.
- Rules added: `isAssetPath` for extension-named pages, the test-database guard.
- `gate.json` (block); init keeps it (desktop-only drops db + flows); sync adds it as `report` to forks without one and keeps a fork's mode; demo:drop and no-auth regenerate the table.

## Part 2: the flows check (next)

- Specs become `*.flow.ts`; one fixture file: a worker-scoped server on the production build (own free port, own database cloned from the template via `test/db.ts`), `world` helpers (fresh user or admin per test, signed in without the form), automatic assertions on every flow (no page error, no `console.error`, no 5xx or failed same-origin request, no horizontal overflow; narrow opt-out).
- Two Chromium projects: `desktop` 1280×800 and `phone` 390×844 with touch; baselines per project.
- Every route in `src/app/routes.tsx` walked in each project, or the run fails naming it.
- `test:flows` builds first.
- New flows for the planted bugs still alive: 8-character password signs up (`src/app/sign-up.tsx`), "No posts yet" only when empty and no "Loading…" once loaded (`src/components/demo/posts-demo.tsx`), a failed session check retries once then shows its status (`src/lib/router-context.ts`).
- Then drop `ALLOWED_FOR_NOW` in `scripts/test-names.ts`.
