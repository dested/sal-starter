import { describe, expect, test } from 'bun:test'
import type { RouteObject } from 'react-router'
import { NOT_FOUND, screenFor, screens } from './screens'

const Page = () => null

// The template's shape plus what forks add: a nested layout, a param, a splat.
const tree: RouteObject[] = [
  {
    path: '/',
    Component: Page,
    children: [
      { index: true, Component: Page },
      { path: 'sign-in', Component: Page },
      { path: 'dashboard', Component: Page },
      {
        path: 'u/:id',
        Component: Page,
        children: [
          { index: true, Component: Page },
          { path: 'posts', Component: Page },
        ],
      },
      { path: 'docs/*', Component: Page },
    ],
  },
]

describe('screens', () => {
  test('every page route once, a layout counted through its index', () => {
    expect(screens(tree).sort()).toEqual([
      '/',
      '/dashboard',
      '/docs/*',
      '/sign-in',
      '/u/:id',
      '/u/:id/posts',
    ])
  })

  test('a route with no component is not a screen', () => {
    expect(screens([{ path: '/', children: [{ path: 'a', Component: Page }] }])).toEqual(['/a'])
  })
})

describe('screenFor', () => {
  test('a pathname counts for the deepest route it matches', () => {
    expect(screenFor(tree, '/')).toBe('/')
    expect(screenFor(tree, '/dashboard')).toBe('/dashboard')
    expect(screenFor(tree, '/u/ada')).toBe('/u/:id')
    expect(screenFor(tree, '/u/ada/posts')).toBe('/u/:id/posts')
    expect(screenFor(tree, '/docs/a/b')).toBe('/docs/*')
  })

  test('anything unmatched is the 404', () => {
    expect(screenFor(tree, '/nope')).toBe(NOT_FOUND)
    expect(screenFor(tree, '/dashboard/extra')).toBe(NOT_FOUND)
  })

  test('every screen a visit can produce is one screens() lists', () => {
    const listed = new Set([...screens(tree), NOT_FOUND])
    for (const p of ['/', '/sign-in', '/dashboard', '/u/1', '/u/1/posts', '/docs/x', '/zzz']) {
      expect(listed.has(screenFor(tree, p))).toBe(true)
    }
  })
})
