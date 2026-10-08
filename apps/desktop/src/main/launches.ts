// A second launch of the app (single-instance lock) forwards its argv and cwd
// here; the router's `launches` subscription streams them to the renderer.

export interface Launch {
  argv: string[]
  cwd: string
  at: Date
}

type Listener = (launch: Launch) => void
const listeners = new Set<Listener>()

export function emitLaunch(launch: Launch): void {
  for (const l of listeners) l(launch)
}

export function onLaunch(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
