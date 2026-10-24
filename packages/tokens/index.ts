// The design tokens as hex values, for code that can't use the CSS variables:
// native splash and system UI, SVG/Skia props, navigator themes, Electron's
// window background. Generated from tokens.css (`bun run tokens`), never edited
// by hand. Classes (`bg-background`) stay the default everywhere else.
import colors from './colors.json'

export { colors }
export type ColorRole = keyof typeof colors
