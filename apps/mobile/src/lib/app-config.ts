import Constants from 'expo-constants'
import { z } from 'zod'

// The runtime view of app.config.ts (which reads project.json). Validated once
// so the rest of the app never touches `Constants.expoConfig` directly.
const schema = z.object({
  scheme: z.string(),
  extra: z.object({ apiPort: z.number().int() }),
  hostUri: z.string().optional(),
})

export const appConfig = schema.parse(Constants.expoConfig)
