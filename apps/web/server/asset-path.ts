// Requests for static-file-looking paths that reach the SSR catch-all are
// misses (favicon.ico, source maps, a stray .png): they 404 fast instead of
// rendering the app with status 200. Only known asset extensions count, so a
// dotted page path (`/u/ada.lovelace`, `/docs/v1.2`) still renders.
const ASSET_EXTENSIONS = new Set(
  [
    'avif bmp gif ico jpeg jpg png svg webp', // images + icons
    'cjs css js json map mjs ts tsx txt wasm webmanifest xml', // scripts, styles, data, source maps
    'eot otf ttf woff woff2', // fonts
    'mp3 mp4 ogg pdf wav webm zip', // media + downloads
    'asp aspx bak cgi env ini jsp php sql yml yaml', // what scanners probe for
  ]
    .join(' ')
    .split(' ')
)

export function isAssetPath(path: string): boolean {
  const last = path.slice(path.lastIndexOf('/') + 1)
  const dot = last.lastIndexOf('.')
  if (dot === -1) return false
  return ASSET_EXTENSIONS.has(last.slice(dot + 1).toLowerCase())
}
