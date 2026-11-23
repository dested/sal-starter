// Preflight for every EAS build, submit and update script (package.json): refuses
// before eas-cli starts when the app can't use EAS, with the command that fixes it.
//
//   bun scripts/eas-ready.ts <development|preview|production>
//
// Exit 0 ready · 1 not ready (the reason and the fix on stderr). The same check
// guards `expo prebuild` itself (withUpdatesRequired in app.config.ts), so a Mac,
// expo-wsl-ios or Limrun build of a production binary refuses the same way.

import { z } from 'zod'
import { appConfig, EAS_SETUP, project, updatesProblem } from '../app.config'

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  console.log(
    'Usage: bun scripts/eas-ready.ts <development|preview|production>\n' +
      '  Exit 0 when this variant can be built, submitted or updated through EAS\n' +
      '  (an EAS project, EAS Update on, the variant channel); 1 with the fix otherwise.'
  )
  process.exit(args.length === 0 ? 1 : 0)
}
const variant = z.enum(['development', 'preview', 'production']).parse(args[0])

const config = appConfig({}, project, variant)
const problem =
  updatesProblem(config, variant) ??
  (project.easProjectId === null
    ? `This needs the EAS project, and project.json easProjectId is null. Run \`${EAS_SETUP}\` first.`
    : null)
if (problem !== null) {
  console.error(`✗ ${problem}`)
  process.exit(1)
}
