// Pure half of ota.ts (no Expo imports), so `bun test` can cover it: a gate
// that runs the OTA reload now, or once the last hold lets go.

export type HoldGate = {
  /** Takes a hold; call the returned release once (later calls do nothing). */
  acquire(): () => void
  held(): boolean
  /** Runs `fn` now if nothing holds, else when the last hold releases. Only the latest waiting `fn` runs. */
  whenFree(fn: () => void): void
}

export function createHoldGate(): HoldGate {
  let holds = 0
  let waiting: (() => void) | null = null
  return {
    acquire() {
      holds++
      let released = false
      return () => {
        if (released) return
        released = true
        holds--
        if (holds === 0 && waiting !== null) {
          const fn = waiting
          waiting = null
          fn()
        }
      }
    },
    held: () => holds > 0,
    whenFree(fn) {
      if (holds === 0) fn()
      else waiting = fn
    },
  }
}
