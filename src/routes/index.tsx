import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'

export const Route = createFileRoute('/')({
  component: HomePage,
})

const stack = [
  ['TanStack Start', 'SSR React framework with file-based routing'],
  ['Prisma ORM + Postgres', 'Type-safe schema with migrations and Studio'],
  ['better-auth', 'Email + password auth, session cookies'],
  ['tRPC v11', 'End-to-end typed RPC with TanStack Query'],
  ['Tailwind v4 + shadcn', 'CSS-first styling, copy-paste components'],
  ['Bun', 'Runtime, package manager, production server'],
]

function HomePage() {
  const { session } = Route.useRouteContext()
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Tan Starter</h1>
        <p className="text-muted-foreground">
          A SSR template wired with the latest React stack. Clone and ship.
        </p>
        {session ? (
          <p className="text-sm">
            Signed in as <strong>{session.user.email}</strong>.{' '}
            <Link to="/dashboard" className="underline">
              Go to dashboard
            </Link>
            .
          </p>
        ) : (
          <p className="text-sm">
            <Link to="/sign-up" className="underline">
              Create an account
            </Link>{' '}
            or{' '}
            <Link to="/sign-in" className="underline">
              sign in
            </Link>
            .
          </p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {stack.map(([name, desc]) => (
          <Card key={name}>
            <CardHeader>
              <CardTitle>{name}</CardTitle>
              <CardDescription>{desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  )
}
