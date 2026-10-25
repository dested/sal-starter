import { describe, expect, mock, test } from 'bun:test'
import { createHoldGate } from './ota-hold'

describe('createHoldGate', () => {
  test('runs at once when nothing holds', () => {
    const gate = createHoldGate()
    const fn = mock(() => {})
    gate.whenFree(fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('defers until the last hold releases, then runs once', () => {
    const gate = createHoldGate()
    const releaseRound = gate.acquire()
    const releaseCheckout = gate.acquire()
    const fn = mock(() => {})
    gate.whenFree(fn)
    releaseRound()
    expect(fn).not.toHaveBeenCalled()
    expect(gate.held()).toBe(true)
    releaseCheckout()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(gate.held()).toBe(false)
    gate.acquire()()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('a release called twice counts once', () => {
    const gate = createHoldGate()
    const release = gate.acquire()
    gate.acquire()
    release()
    release()
    expect(gate.held()).toBe(true)
  })

  test('only the latest waiting reload runs', () => {
    const gate = createHoldGate()
    const release = gate.acquire()
    const first = mock(() => {})
    const second = mock(() => {})
    gate.whenFree(first)
    gate.whenFree(second)
    release()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
