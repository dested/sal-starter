import {
  Link,
  NavLink,
  Outlet,
  ScrollRestoration,
  useNavigate,
  useRevalidator,
  useRouteLoaderData,
} from 'react-router'
import { authClient } from '~/lib/auth-client'
import { KickoffRibbon } from '~/components/kickoff-ribbon'
import type { RootLoaderData } from './routes'

export function Layout() {
  const data = useRouteLoaderData<RootLoaderData>('root')
  const session = data?.session ?? null
  const navigate = useNavigate()
  const revalidator = useRevalidator()

  async function signOut() {
    await authClient.signOut()
    // Land on home first, then re-run loaders so the cleared session is
    // reflected (mirrors the revalidate in the sign-in/up flows). Await the
    // navigation: getContext makes it start async, and a revalidate fired
    // before it starts re-runs the current page's loaders (the dashboard's
    // redirects to /sign-in).
    await navigate('/', { replace: true })
    await revalidator.revalidate()
  }

  return (
    <>
      <KickoffRibbon />
      <header className="border-b">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
          <Link to="/" className="font-display font-semibold">
            Sal Starter
          </Link>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              isActive
                ? 'text-sm text-foreground'
                : 'text-sm text-muted-foreground hover:text-foreground'
            }>
            Dashboard
          </NavLink>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {session ? (
              <>
                <span className="text-muted-foreground">{session.user.email}</span>
                <button type="button" className="hover:underline" onClick={signOut}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/sign-in" className="hover:underline">
                  Sign in
                </Link>
                <Link to="/sign-up" className="hover:underline">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
      <ScrollRestoration />
    </>
  )
}
