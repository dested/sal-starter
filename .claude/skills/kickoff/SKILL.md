---
name: kickoff
description: The first job in every new sal-starter fork, before any feature work. Decides the product's look with Sal (3 directions, or wing it; ONE scheme, never a dark mode or toggle), then builds it everywhere (tokens, fonts, primitives, the real `/`, icon, splash, favicon, meta, ui.md) and sets project.json `look`. Use when project.json `look` is null, the "Kickoff pending" ribbon or banner line shows, `bun run test` fails on "the look is set", or Sal says kickoff, "set the look", "make it pretty", "design pass".
---

# Kickoff

The starter ships a neutral placeholder look on purpose. It is never the answer:
15 of 16 forks that looked good replaced it with a written direction, their own
fonts and their own surfaces, and the ones that kept it looked like the starter.
The kickoff does that replacement first, so feature work lands on the real look.

Order: **ask → directions → pick → build → check → finish.** Don't start feature
work until `project.json` `look` is set and the checks below pass.

## 1. Ask one round

One `AskUserQuestion`, recommended option first. Skip anything Sal's message
already answered.

- **What it is:** one line, who it's for, and which surface matters most (web,
  phone, desktop). Mobile is usually the one to design for.
- **The look:** "3 directions, I pick" (recommended), "wing it" (you pick one
  direction and build it), or "mock-first" for a big product with many screens
  (hand off to the `mock-first` skill, then come back for step 4).
- **Scheme:** light or dark. Exactly one. The app never follows the OS and never
  has a toggle.
- **What `/` is:** a marketing page, the app itself (signed-in home), a redirect
  to sign-in, or the game.

## 2. Three directions

Follow the `frontend-design` skill. The three must differ in kind, not in hue:
different type, different surfaces, different energy. Each gets:

- a **name** and a **north star** (one sentence: what it should feel like);
- **two failure modes** (what it looks like when it goes wrong, e.g. "too toy:
  bouncy, rounded everything");
- a **palette** in the chosen scheme: background, surface, ink, muted ink,
  primary, accent, plus success, warning and destructive that fit it;
- a **type pairing** (display + body) from Google Fonts, so web
  (`@fontsource-variable/*`) and mobile (`@expo-google-fonts/*`) load the same
  families;
- a **surface rule**: radius, and borders vs fills vs shadows;
- **one signature move** (a texture, a type treatment, a motion moment, a shape).

Never offer: shadcn's neutral greys, purple-on-white gradients, the generic
"AI SaaS" look, or anything that needs a dark variant to look right.

Show them as **one comparison page**, side by side: each direction's real fonts
and colors applied to a slice of `/`, a card, a primary and secondary button, a
form field and a phone-sized frame. Write it to
`plans/artifacts/kickoff-directions.html`, publish it with the Artifact tool,
and screenshot it with `bx`. For a visual-first product (a game, a toy) an
`openai-image` comparison per direction is better; save those under the repo's
junk twin and give full paths. Then ask Sal to pick (the three names, plus
"mix: say what").

The page follows Sal's design rules too: no eyebrows, no taglines or helper
text, no periods at the end of headings.

## 3. Build it

Work through every item; each is a place the placeholder survives otherwise.

**Tokens** (`packages/tokens/tokens.css`, the only place colors live)

- Give every role a value in the one `:root` block; set `color-scheme` to the
  scheme. Set `--radius` and `--card-shadow` from the surface rule.
- `bun run tokens` regenerates `colors.json` (native splash, theme-color,
  Electron window, SVG/Skia props). Import hex from `@app/tokens` in code, never
  a literal.
- Never a second `:root`, a `.dark` block, `prefers-color-scheme`, or brand
  colors in `app.css` / `global.css`. A new role goes in `theme.css` (mapping)
  and `tokens.css` (value).

**Identity** (`project.json`)

- `"look": { "scheme": "light" | "dark", "direction": "<name>: <north star>" }`.
  This turns off the ribbon and the banner line, and turns the kickoff test green.

**Fonts**

- Web: `bun add --cwd apps/web @fontsource-variable/<family>` per family,
  `@import '@fontsource-variable/<family>';` at the top of
  `apps/web/src/styles/app.css`, then point `--font-body` / `--font-heading` in
  `tokens.css` at `'<Family> Variable', <fallback stack>`. Headings use
  `font-display`. Desktop: the same in `apps/desktop/src/renderer/src/styles/app.css`.
- Mobile: `bunx expo install expo-font @expo-google-fonts/<family>` in
  `apps/mobile`, load them with `useFonts` in `src/app/_layout.tsx` while the
  splash is held, and map `--font-sans` / `--font-display` in
  `apps/mobile/global.css` (`@theme`) to the loaded family names (native needs
  one family name per weight).

**Primitives**

- Restyle `apps/web/src/components/ui/*` (and the mobile and desktop copies) to
  the surface rule: radius, border or fill, shadow, press states. Token classes
  only. Mobile placeholder colors come from `colors` in `@app/tokens`.

**Pages**

- The real `/` in `apps/web/src/app/home.tsx`: whatever Sal said `/` is. No
  stack showcase, no "built with" cards, no tagline under the title.
- The nav and shell in `apps/web/src/app/layout.tsx`: the wordmark in the
  display face, links that fit the product.
- Mobile: the first screen in `apps/mobile/src/screens/`.
- The Post demo (Post model, `posts` router, `/dashboard`, mobile home) is a
  reference for the SSR + prefetch pattern. Replace it with the first real
  feature, dropping the table in a migration (`bun run db:migrate --name
drop_post_demo`) and updating `apps/web/e2e/global-setup.ts` (TRUNCATE list)
  and `apps/web/e2e/smoke.spec.ts`.

**Brand assets**

- One source, every surface: `packages/brand/mark.svg` is the product's glyph,
  one color on transparent (`fill="currentColor"`, a `viewBox` drawn tight to
  the glyph). Draw it by hand, or generate it with `openai-image` and then
  trace and simplify it into a few clean paths. A confident shape that still
  reads at 16 px, never a letter in a box or a stock sparkle.
- `packages/brand/brand.json` picks the token roles: `icon` (background, mark,
  `markSize`) and `splash` (background, mark, `markWidth` in points). The
  splash defaults to the brand color full-bleed with the bare mark; never a
  tile on a different color (a box in a box).
- `bun run brand` renders the app icon, splash mark, Android adaptive and
  monochrome icons, favicon, apple-touch and PWA icons, `manifest.webmanifest`
  and the desktop `icon.png` / `icon.ico`, and records them in
  `brand.gen.json`. Never hand-edit an output: `brand.test.ts` fails on it.
  Rerun after any token change.
- Look at the renders before moving on (Read the PNGs): `icon.png` in a
  rounded mask, the favicon at 16 and 32 px, the splash as a phone-sized frame
  (`markWidth` points on the splash color). Iterate until they look designed.
- `apps/web/index.html`: the `description` and `og:description` say in one line
  what the product is (crawlers only; the page itself carries no tagline).

**`ui.md`**

- Fill in the template: north star, failure modes, palette roles, type,
  surface rule, signature move, voice. It's the brief every later UI change
  follows.

## 4. Check it

- `bun run tokens && bun run brand && bun run typecheck && bun run test` green.
- `bx`: screenshot `/`, sign-in and the signed-in page at desktop width and at
  390px. No ribbon. Nothing still neutral grey that should carry the look.
- Mobile: run it on Limrun (`limrun` skill) and screenshot the first screen. If
  that isn't possible this session, say mobile is unverified.
- `bun run test:e2e:update` once the pages are final, and review the new
  baselines before committing them.
- Show Sal the screenshots (full paths) and ask whether it's right before
  calling it done.

## 5. Finish

- `decisions.md`: "Look: <direction>", with the two directions not picked as the
  rejected ones.
- `updates.md` entry, `cliffnotes.md` if the map changed, then commit.
- After the first deploy: claim the host in the Crow's Nest dashboard
  (cn.dested.com), where it shows up as a pending site.
