import { Link, useRouteLoaderData } from 'react-router-dom'
import { buttonVariants } from '~/components/ui/button'
import type { RootLoaderData } from './routes'

// Placeholder: the kickoff (.claude/skills/kickoff) replaces this page with the
// product's real `/` (marketing page, the app itself, a redirect, the game).
export function HomePage() {
  const data = useRouteLoaderData<RootLoaderData>('root')
  const session = data?.session ?? null

  return (
    <section className="flex min-h-[50vh] flex-col items-start justify-center gap-6">
      <h1 className="font-display text-5xl font-bold tracking-tight">Sal Starter</h1>
      {session ? (
        <Link to="/dashboard" className={buttonVariants({ size: 'lg' })}>
          Open dashboard
        </Link>
      ) : (
        <Link to="/sign-up" className={buttonVariants({ size: 'lg' })}>
          Get started
        </Link>
      )}
    </section>
  )
}
