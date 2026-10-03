import { z } from 'zod'

// Public build-time env. Expo inlines EXPO_PUBLIC_* only for static
// `process.env.EXPO_PUBLIC_X` reads, so each one is listed by name here.
// Sources: apps/mobile/.env.local (dev overrides), `eas env` (builds).
const schema = z.object({
  // Overrides LAN discovery everywhere it's set: tunnels, preview, production.
  EXPO_PUBLIC_API_URL: z.url().optional(),
})

export const env = schema.parse({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
})
