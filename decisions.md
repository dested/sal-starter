# sal-starter — Decisions

> Append-only log of choices with rejected alternatives. Never reverse one silently — add a superseding entry.

## 2026-10-02 — Deploy on Drydock (root `drydock.yaml`), not Render
**Why:** the owner deploys on Drydock. A pre-committed root `drydock.yaml` (`kind: ssr`, `runtime: bun`, `rootDir: apps/web`, `predeploy: bunx prisma migrate deploy`) is the seed every fork inherits; `.gitattributes` marks it `merge=ours` because Drydock rewrites it per project. `predeploy` overrides Drydock's `db push --accept-data-loss` default. `start` has no `--env-file`: prod env comes from Drydock. **Unverified:** Drydock's SSR Dockerfile generator copies `apps/web/bun.lock`, which doesn't exist in a Bun workspace, so a deploy fails until Drydock gets its workspace-aware fix (separate task, owner deferred). The template repo itself is never wired to Drydock.
**Rejected:** keeping `render.yaml` (not the owner's platform), letting Drydock default to `db push` (drops hand-written SQL).

## 2026-09-29 — Dev port from `PORT`, default 4780, unique per project
**Why:** 3000 collides with every other Node project on the machine. `PORT` is zod-validated in `server/env.ts` (default 4780) and `BETTER_AUTH_URL` follows it; `bun run init` derives a per-project port from the name (or `--port`) and rewrites 4780 so clones never share one.
**Rejected:** portless by default (overhead; opt-in only when a stable https origin is needed), a random port per boot (unbookmarkable, breaks auth URLs).

## 2026-09-29 — superjson on the tRPC wire AND the SSR state
**Why:** procedures should return real `Date`s. The transformer alone isn't enough: the dehydrated React Query cache is inlined into the HTML, and `JSON.stringify` there turns Dates back into strings on first client render. `src/lib/ssr-state.ts` routes that payload through superjson too. Supersedes the "return ISO strings" convention.
**Rejected:** ISO strings by convention (every consumer re-parses; easy to forget), TanStack's `dehydrate.serializeData` hook (same result, but splits the serialization across two config sites).

## 2026-09-29 — `prisma migrate`, never `db push`
**Why:** `db push` drops anything Prisma doesn't model (FTS indexes, triggers, exclusion constraints) and needs `--accept-data-loss` on deploy. Committed migrations run identically in dev (`migrate dev`), e2e (global-setup `migrate deploy`) and Render (`preDeployCommand: migrate deploy`); raw SQL lives in migration files.
**Rejected:** keeping `db push` for dev only (dev and prod schemas drift), a separate SQL runner for extensions/triggers (two sources of truth).

## 2026-09-29 — `noUncheckedIndexedAccess` and zero casts
**Why:** type safety is the guardrail on generated code. Index access is `T | undefined`; the template itself has no `any`/`as` casts (React Router's `any` loader context is narrowed by `isSsrContext`). `tsconfig` includes e2e/scripts/configs so they're checked too.
**Rejected:** a lint rule instead of compiler flags (no linter in the template; tsgo is the gate).

## 2026-09-11 — Stylesheet is a `<link>` in `index.html`, not a JS import
**Why:** importing `app.css` from `App.tsx` made Vite inject it after the client module graph loaded, so every dev load painted unstyled SSR HTML first. A head `<link>` is render-blocking in dev (Vite serves compiled CSS, HMR swaps the href) and gets hashed into `<head>` by `vite build`. Zero server code.
**Rejected:** collecting CSS from `vite.moduleGraph` in `server.ts` and inlining `<style data-vite-dev-id>` (works, but ~30 lines of dev-only plumbing for the same result).

## 2026-09-11 — Dark mode: `.dark` class + inline pre-paint script + `dark:` markup swaps
**Why:** the tokens already existed under `.dark`; an inline `<head>` script (stored choice → `prefers-color-scheme`) applies the class before first paint, and components render both variants and hide one with `dark:` so SSR and client markup are identical. Binary toggle persisted in `localStorage.theme`; absence means "follow the OS" (tracked live by `followSystemTheme`).
**Rejected:** media-query-only dark mode (no user override); React state / context for the theme (hydration mismatch or a post-mount icon flip); a system/light/dark tri-state (needs a dropdown → radix Slot dependency the template deliberately avoids).

## 2026-09-11 — Vite HMR websocket shares the Express `http.Server`
**Why:** the fixed `hmr.port: 24678` collided whenever two clones of this template ran at once (HMR silently connected to the wrong server and got a 400). `hmr: { server }` means one port, and it survives reverse proxies.
**Rejected:** `PORT + 1` (still a second port; breaks behind proxies), `hmr.port: 0` (Vite does not pick a free port in middleware mode).

## 2026-09-11 — Client-nav loaders prefetch through lazy browser singletons
**Why:** `getBrowserClients()` in `src/lib/trpc.tsx` gives loaders the same `QueryClient` + tRPC options proxy the app renders with, so `dashboardLoader` can `await prefetchQuery` on client navigation — no "Loading…" flash. Lazy so the shared `routes.tsx` allocates nothing during SSR.
**Rejected:** fire-and-forget prefetch (still flickers), creating the clients in `routes.tsx` at module scope (runs on the server too).
