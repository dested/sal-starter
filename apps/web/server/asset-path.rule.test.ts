import { describe, expect, test } from 'bun:test'
import { isAssetPath } from './asset-path'

describe('isAssetPath', () => {
  test('asset misses 404 before SSR', () => {
    for (const p of ['/favicon.ico', '/assets/app.js.map', '/logo.PNG', '/.env', '/wp-login.php']) {
      expect(isAssetPath(p)).toBe(true)
    }
  })

  test('page paths render, dotted ones included', () => {
    for (const p of [
      '/',
      '/dashboard',
      '/u/ada.lovelace',
      '/docs/v1.2',
      '/releases/2026.10',
      '/a.b/c',
    ]) {
      expect(isAssetPath(p)).toBe(false)
    }
  })

  test('a last segment without a dot is a page, even when it reads like an extension', () => {
    for (const p of ['/png', '/css', '/docs/js', '/files/pdf', '/env']) {
      expect(isAssetPath(p)).toBe(false)
    }
  })
})
