import project from '../../../../project.json'

// Dev-only nag while project.json `look` is null: the starter's neutral
// placeholder is still on. Never renders in a build or after the kickoff.
export function KickoffRibbon() {
  if (!import.meta.env.DEV || project.look !== null) return null
  return (
    <div className="bg-warning px-6 py-2 text-center text-sm font-medium text-warning-foreground">
      Kickoff pending: run the kickoff skill (.claude/skills/kickoff) to set the look and the home
      page
    </div>
  )
}
