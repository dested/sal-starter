// demo: deleted by `bun run demo:drop`. Loud on purpose: the Post demo is the
// template's reference code, and a fork's build fails while it's present.
export function TemplateDemoBar() {
  return (
    <div className="rounded-md border-2 border-dashed border-warning bg-warning/10 px-4 py-3 text-sm font-medium text-foreground">
      Template demo · delete before shipping: <code className="font-mono">bun run demo:drop</code>
    </div>
  )
}
