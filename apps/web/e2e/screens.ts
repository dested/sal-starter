// Route-tree logic for the every-screen check (e2e/coverage.ts), pure so the
// rules test can prove it: the screens a router has, and which screen a
// visited pathname shows.

import { matchRoutes, type RouteObject } from 'react-router'

export const NOT_FOUND = '404'

/** Every page route as a full path pattern (`/`, `/sign-in`, `/u/:id`), plus the 404. */
export function screens(tree: RouteObject[], parent = ''): string[] {
  const out: string[] = []
  for (const route of tree) {
    const path = route.index
      ? parent || '/'
      : route.path === undefined
        ? parent
        : route.path.startsWith('/')
          ? route.path
          : `${parent.replace(/\/$/, '')}/${route.path}`
    if (route.Component || route.element || route.lazy) {
      if (!route.children?.some((c) => c.index)) out.push(path || '/')
    }
    if (route.children) out.push(...screens(route.children, path))
  }
  return [...new Set(out)]
}

/** The screen a visited pathname shows: its deepest matching route's pattern, or the 404. */
export function screenFor(tree: RouteObject[], pathname: string): string {
  const matches = matchRoutes(tree, pathname)
  const last = matches?.[matches.length - 1]
  if (!last) return NOT_FOUND
  // Rebuild the pattern from the branch, the same way screens() does.
  let path = ''
  for (const m of matches ?? []) {
    if (m.route.index) continue
    const segment = m.route.path
    if (segment === undefined) continue
    path = segment.startsWith('/') ? segment : `${path.replace(/\/$/, '')}/${segment}`
  }
  return path || '/'
}
