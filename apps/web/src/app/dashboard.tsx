import { useLoaderData } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '~/lib/trpc'
import { PostsDemo } from '~/components/demo/posts-demo' // demo
import type { RootLoaderData } from './routes'

// The signed-in page. `me` is prefetched in dashboardLoader on both sides, so
// it renders with data on a hard load and on a client navigation.
export function DashboardPage() {
  const { session } = useLoaderData<RootLoaderData>()
  const trpc = useTRPC()
  const me = useQuery(trpc.me.queryOptions())

  if (!session) return null

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        {me.data?.name ?? session.user.name}
      </h1>
      {/* demo:start */}
      <PostsDemo />
      {/* demo:end */}
    </div>
  )
}
