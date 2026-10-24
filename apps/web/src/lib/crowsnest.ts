// Custom Crow's Nest events (index.html loads cn.js; pageviews, clicks, errors
// and vitals are automatic). Name the action and put the dimensions in props:
// `cnEvent('level done', { level: 3 })`. Never anything identifying (emails,
// names, ids, typed text). A no-op on the server and before cn.js has loaded.
type CnProps = Record<string, string | number | boolean | null>

declare global {
  interface Window {
    cn?: (name: string, props?: CnProps) => void
  }
}

export function cnEvent(name: string, props?: CnProps): void {
  if (typeof window !== 'undefined') window.cn?.(name, props)
}
