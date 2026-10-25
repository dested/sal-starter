import { describe, expect, test } from 'bun:test'
import { AFTER_SIGN_IN, nextFromSearch, safeNext, signInPath } from './loader'

describe('safeNext', () => {
  test('a path on this site passes through', () => {
    expect(safeNext('/dashboard')).toBe('/dashboard')
    expect(safeNext('/u/ada.lovelace?tab=posts#top')).toBe('/u/ada.lovelace?tab=posts#top')
    expect(safeNext('/')).toBe('/')
  })

  test('another host, a scheme or a relative path never does', () => {
    for (const bad of [
      '//evil.com',
      '/\\evil.com',
      '/%5Cevil.com',
      '/%2F/evil.com',
      '\\\\evil.com',
      'https://evil.com',
      'javascript:alert(1)',
      '/\t/evil.com',
      '/\n/evil.com',
      '/%09/evil.com',
      'dashboard',
      '',
      null,
      undefined,
      '/%E0%A4%A',
    ])
      expect(safeNext(bad)).toBeNull()
  })
})

describe('nextFromSearch', () => {
  test('reads ?next= and falls back to the signed-in page', () => {
    expect(nextFromSearch(`?next=${encodeURIComponent('/dashboard?x=1')}`)).toBe('/dashboard?x=1')
    expect(nextFromSearch('?next=%2F%2Fevil.com')).toBe(AFTER_SIGN_IN)
    expect(nextFromSearch('')).toBe(AFTER_SIGN_IN)
  })
})

describe('signInPath', () => {
  test('carries the current path and search', () => {
    expect(signInPath(new Request('http://x.test/dashboard?tab=2'))).toBe(
      '/sign-in?next=%2Fdashboard%3Ftab%3D2'
    )
    expect(signInPath(new Request('http://x.test/'))).toBe('/sign-in')
  })
  test('round-trips through nextFromSearch', () => {
    const path = signInPath(new Request('http://x.test/u/ada?x=1&y=2'))
    expect(nextFromSearch(new URL(path, 'http://x.test').search)).toBe('/u/ada?x=1&y=2')
  })
})
