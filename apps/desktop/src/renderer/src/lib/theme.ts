// Desktop follows the OS theme: `.dark` on <html> tracks prefers-color-scheme.
// The window stays hidden until ready-to-show, so applying it at startup in JS
// paints no wrong-theme frame (and the CSP allows no inline script).

export function followSystemTheme(): void {
  const media = matchMedia('(prefers-color-scheme: dark)')
  const apply = () => document.documentElement.classList.toggle('dark', media.matches)
  apply()
  media.addEventListener('change', apply)
}
