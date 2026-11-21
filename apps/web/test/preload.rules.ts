// `bun run test:rules` preload: no environment at all. A rules test is pure
// logic; one that imports server/env.ts (and so the database, auth or a key)
// fails on import here, which says it belongs in a *.api.test.ts.
import { scrubEnv } from './env'

scrubEnv()
