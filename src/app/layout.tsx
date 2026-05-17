import { Link, NavLink, Outlet } from 'react-router-dom'
import { authClient } from '~/lib/auth-client'

export function Layout() {
  const { data: session } = authClient.useSession()

  return (
    <>
      <header className="border-b">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
          <Link to="/" className="font-semibold">
            tan-starter
          </Link>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              isActive
                ? 'text-sm text-foreground'
                : 'text-sm text-muted-foreground hover:text-foreground'
            }
          >
            Dashboard
          </NavLink>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {session ? (
              <>
                <span className="text-muted-foreground">{session.user.email}</span>
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => authClient.signOut()}
                >
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
    </>
  )
}
