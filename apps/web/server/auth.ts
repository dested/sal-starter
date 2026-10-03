import { expo } from '@better-auth/expo'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import project from '../../../project.json'
import { prisma } from './prisma'
import { env } from './env'

// The Expo app (apps/mobile) signs in against this same server. Its requests
// carry the app scheme as their origin, one per install variant (see
// apps/mobile/app.config.ts). exp:// is the dev client talking to Metro: dev only.
const appOrigins = ['', 'dev', 'preview'].map((suffix) => `${project.scheme}${suffix}://`)
const devOrigins = process.env.NODE_ENV === 'production' ? [] : ['exp://**']

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  plugins: [expo()],
  trustedOrigins: [...appOrigins, ...devOrigins],
})

export type Session = typeof auth.$Infer.Session
