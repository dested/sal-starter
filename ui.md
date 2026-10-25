# sal-starter — UI / Visual Language

> Source of truth for how this looks and feels. Follow it for anything visual, and keep it current as part of finishing a UI change.
> **Template until the kickoff** (`.claude/skills/kickoff`): it fills in every `<…>`, replaces the placeholder values, and deletes this line. Fork-owned: `bun run sync` keeps this file as the fork wrote it.

## North star

**<Direction name>: <one sentence on what it should feel like>.**

- Fails as: <too X: what that looks like>
- Fails as: <too Y: what that looks like>
- Signature move: <the one thing that makes it recognisable>

## Rules (every project)

1. **One theme.** `packages/tokens/tokens.css` is the look: `color-scheme` there equals `project.json` `look.scheme`. No dark mode, no toggle, no following the OS. `dark:` classes compile but never match (`theme.css`), so don't write them.
2. **Tokens over values.** Classes come from tokens (`bg-primary`, `text-muted-foreground`, `rounded-lg`, `shadow-card`); code that needs hex imports `colors` from `@app/tokens`. Never a Tailwind palette class (`bg-blue-500`) or a literal color.
3. **A brand change edits `tokens.css` values**, then `bun run tokens`. Never a second `:root`, a `.dark` block, or brand colors in `app.css` / `global.css`. A new role goes in `theme.css` (mapping) and `tokens.css` (value).
4. **No eyebrows** (no kicker above a heading), **no taglines, helper text or captions**, **no period at the end of a heading.** If a screen needs words to make sense, fix the layout, naming or grouping.

## Palette

| Role                  | Class                                         | Use                         | Value |
| --------------------- | --------------------------------------------- | --------------------------- | ----- |
| Background            | `bg-background`                               | page canvas                 | <…>   |
| Foreground            | `text-foreground`                             | primary text                | <…>   |
| Card / Popover        | `bg-card` / `bg-popover`                      | raised surfaces             | <…>   |
| Primary               | `bg-primary` / `text-primary-foreground`      | the main action             | <…>   |
| Secondary             | `bg-secondary`                                | quiet actions, chips        | <…>   |
| Muted                 | `bg-muted` / `text-muted-foreground`          | secondary text, wells       | <…>   |
| Accent                | `bg-accent`                                   | hover and selected surfaces | <…>   |
| Destructive           | `text-destructive` / `bg-destructive`         | errors, dangerous actions   | <…>   |
| Success / Warning     | `bg-success` / `bg-warning` (+ `-foreground`) | confirmations, cautions     | <…>   |
| Border / Input / Ring | `border`, `border-input`, `ring-ring`         | hairlines, fields, focus    | <…>   |

## Type

| Role    | Family   | Class / token                                 |
| ------- | -------- | --------------------------------------------- |
| Display | <family> | `font-display` (`--font-heading`)             |
| Body    | <family> | `font-sans`, the body default (`--font-body`) |
| Mono    | <family> | `font-mono` (`--font-code`)                   |

Scale: page H1 `font-display text-4xl font-bold tracking-tight`, section `text-xl font-semibold`, body default / `text-sm`, secondary `text-sm text-muted-foreground`. <Adjust to the direction.>

Web and desktop load fonts with `@fontsource-variable/*` imported at the top of `app.css`; mobile loads the same families with `expo-font` + `@expo-google-fonts/*` (see Mobile).

## Surfaces

- Radius: `--radius` = <…> (`rounded-md` controls, `rounded-xl` cards; the scale lives in `theme.css`).
- Elevation: cards use `shadow-card` (`--card-shadow` = <…>); <borders vs fills vs shadows: the rule>.
- Container: <width and padding of the main column>.

## Motion

<The one motion moment and its feel (duration, easing). Everything else is instant.>

## Components

Reuse these; restyle them to the surface rule, don't hand-roll. They take `className` (merged with `cn()`), no `asChild`.

| Component                   | File (web)                            | Notes                                                                |
| --------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `Button` + `buttonVariants` | `src/components/ui/button.tsx`        | default/destructive/outline/secondary/ghost/link; default/sm/lg/icon |
| `Card` family               | `src/components/ui/card.tsx`          | Card / Header / Title / Description / Content / Footer               |
| `Input`, `Label`            | `src/components/ui/{input,label}.tsx` | pair `Label htmlFor` with `Input id`                                 |
| `KickoffRibbon`             | `src/components/kickoff-ribbon.tsx`   | dev only, while `look` is null; renders nothing after the kickoff    |
| `cn()`                      | `src/lib/utils.ts`                    | clsx + tailwind-merge                                                |
| Icons                       | `lucide-react`                        | (`lucide-react-native` on mobile)                                    |

Add more with `bunx --bun shadcn@latest add <name>` (writes to `src/components/ui/`), then restyle it. If it needs `asChild`, install `@radix-ui/react-slot` first.

```tsx
// Link styled as a button (no asChild here)
;<Link to="/" className={buttonVariants()}>
  Back home
</Link>

// Inline error
{
  error && <p className="text-sm text-destructive">{error}</p>
}
```

## States (every async surface)

- **Loading:** one muted line, or a skeleton in the surface style.
- **Empty:** one short sentence, no illustration unless the direction calls for one.
- **Pending action:** disable the button and swap its label ("Posting…").
- **Error:** inline `text-destructive` under the form; route errors fall to the root `ErrorBoundary` (`src/app/error-boundary.tsx`).

## Voice / copy

<The direction's voice.> Sentence case, short imperative buttons ("Sign in", "Post"). No marketing fluff, exclamation marks, ALL-CAPS or emoji in UI.

## Mobile (apps/mobile)

Same tokens and class names through Uniwind (`global.css` imports `tailwindcss`, `uniwind`, then `theme.css` and `tokens.css`).

- **One scheme:** `userInterfaceStyle` comes from `look.scheme`, so keyboards, alerts and pickers match, and `_layout.tsx` pins `Uniwind.setTheme` to it so the OS never flips the app. `dark:` and `light:` never match. The splash, the root view and the stack's `contentStyle` paint `colors.background`; the status bar contrasts with it.
- **Fonts:** `useFonts` in `src/app/_layout.tsx` while the splash is held; `--font-sans` / `--font-display` mapped in `global.css` (`@theme`) to the loaded names, one per weight. Never point them at the web stacks in `tokens.css`: native takes a single family name.
- **Primitives** in `src/components/ui/` mirror web's names and cva variants. Placeholder text uses `colors.mutedForeground` (`placeholderTextColor` can't take a class).
- **Screen anatomy:** `SafeAreaView` (`bg-background flex-1`, imported from `~/components/safe-area-view`) → `ScrollView` with `contentContainerClassName="gap-8 p-6"`. Any other third-party view that takes `className` goes through `withUniwind` the same way.
- No web-only utilities on native (`hover:`, `focus-visible:`); they compile to nothing.

## Desktop (apps/desktop)

Same tokens and fonts as web (`src/renderer/src/styles/app.css`). The window paints `colors.background` before the renderer loads, so there's no white flash.

## Don'ts

- ❌ Dark mode in any form: a `.dark` block, `prefers-color-scheme`, a toggle, `useColorScheme`, `nativeTheme`, `dark:` classes.
- ❌ Colors outside `tokens.css`: palette classes, hex literals, a second `:root`.
- ❌ Shipping the placeholder: neutral greys, the system font, `/` as a stack showcase.
- ❌ `tailwind.config.{js,ts}`: Tailwind v4, tokens live in `packages/tokens`.
- ❌ `asChild` on shadcn components (no Slot); use `buttonVariants()`.
- ❌ Treating `CardTitle` as a heading element: it's a `<div>` (matters for a11y and test selectors).
- ❌ `import './x.css'` from a component: the stylesheet is a `<link>` in `index.html`; `@import` new CSS from `app.css`, or the dev build paints unstyled first.
