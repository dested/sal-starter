import { z } from 'zod'

// What https://appstore.dested.com/api/android/<applicationId>.json returns.
// Mirrors `AndroidManifest` in the appstore repo's
// apps/web/server/catalog/contract.ts; `schema` is 1. A breaking change there
// bumps `schema`, and this parse fails (silently: no prompt) until it's copied.
export const androidManifest = z.object({
  schema: z.literal(1),
  slug: z.string(),
  packageName: z.string(),
  latest: z.object({
    versionCode: z.number().int().positive(),
    versionName: z.string(),
    runtimeVersion: z.string(),
    apkUrl: z.url(),
    sizeBytes: z.number().int().positive(),
    sha256: z.string(),
    signingCertSha256: z.string(),
    minSdk: z.number().int().positive(),
    releasedAt: z.iso.datetime(),
    notes: z.string(),
  }),
  minSupportedVersionCode: z.number().int().positive().nullable(),
  installPageUrl: z.url(),
})

export type AndroidManifest = z.infer<typeof androidManifest>
