import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSubscription } from '@trpc/tanstack-react-query'
import { Activity, RefreshCw, Rocket, Send } from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useTRPC } from '~/lib/trpc'

// Demo screen: one query, one mutation, two subscriptions, all over IPC.
// Replace it with the product.
export function App() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sal Starter</h1>
        <p className="text-muted-foreground text-sm">
          Electron, React and tRPC over IPC. Edit <code>src/renderer/src/App.tsx</code> to start.
        </p>
      </header>
      <PingCard />
      <EchoCard />
      <TicksCard />
      <LaunchesCard />
    </main>
  )
}

function PingCard() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const ping = useQuery(trpc.ping.queryOptions())
  return (
    <Card>
      <CardHeader>
        <CardTitle>Query</CardTitle>
        <CardDescription>
          <code>ping</code> runs in the main process. Nothing refetches unless you ask.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="font-mono text-sm" data-testid="ping">
          {ping.data === undefined
            ? ping.isError
              ? ping.error.message
              : '…'
            : `${ping.data.at.toISOString()} · Electron ${ping.data.electron} · Node ${ping.data.node}`}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void queryClient.invalidateQueries({ queryKey: trpc.ping.queryKey() })}>
          <RefreshCw /> Refresh
        </Button>
      </CardContent>
    </Card>
  )
}

function EchoCard() {
  const trpc = useTRPC()
  const [text, setText] = useState('hello')
  const echo = useMutation(trpc.echo.mutationOptions())
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mutation</CardTitle>
        <CardDescription>
          <code>echo</code> validates its input with zod in main.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            echo.mutate({ text })
          }}>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="echo">Text</Label>
            <Input id="echo" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <Button type="submit" disabled={echo.isPending}>
            <Send /> Echo
          </Button>
        </form>
        <p className="mt-3 font-mono text-sm" data-testid="echo">
          {echo.data?.reversed ?? (echo.isError ? echo.error.message : '')}
        </p>
      </CardContent>
    </Card>
  )
}

function TicksCard() {
  const trpc = useTRPC()
  const [on, setOn] = useState(true)
  const ticks = useSubscription(trpc.ticks.subscriptionOptions({ everyMs: 1000 }, { enabled: on }))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
        <CardDescription>
          <code>ticks</code> is an async generator in main; stopping it returns the generator.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-mono text-sm" data-testid="ticks">
          <Activity className="size-4" />
          {ticks.data === undefined ? ticks.status : `tick ${ticks.data.n}`}
        </div>
        <Button variant="outline" size="sm" onClick={() => setOn((v) => !v)}>
          {on ? 'Stop' : 'Start'}
        </Button>
      </CardContent>
    </Card>
  )
}

function LaunchesCard() {
  const trpc = useTRPC()
  const [launches, setLaunches] = useState<Array<{ cwd: string; argv: string[]; at: Date }>>([])
  useSubscription(
    trpc.launches.subscriptionOptions(undefined, {
      onData: (launch) => setLaunches((all) => [launch, ...all].slice(0, 5)),
    })
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>Second launches</CardTitle>
        <CardDescription>
          Start the app again: the running window takes focus and receives argv and cwd here.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 font-mono text-xs">
        {launches.length === 0 ? (
          <span className="text-muted-foreground flex items-center gap-2">
            <Rocket className="size-4" /> none yet
          </span>
        ) : (
          launches.map((l) => (
            <div key={l.at.getTime()}>
              {l.at.toLocaleTimeString()} · {l.cwd} · {l.argv.slice(1).join(' ')}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
