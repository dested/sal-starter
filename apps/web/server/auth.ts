import { expo } from '@better-auth/expo'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { APIError } from 'better-auth/api'
import project from '../../../project.json'
import { SIGNUP_CLOSED, SIGNUP_CLOSED_MESSAGE, signUpAllowed } from './access'
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
  // SIGNUP_ALLOWLIST is enforced here, on every user create, so no client
  // (web, mobile, a raw POST) gets around it.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!signUpAllowed(user.email)) {
            throw new APIError('FORBIDDEN', { code: SIGNUP_CLOSED, message: SIGNUP_CLOSED_MESSAGE })
          }
        },
      },
    },
  },
  plugins: [expo()],
  trustedOrigins: [...appOrigins, ...devOrigins],
})

export type Session = typeof auth.$Infer.Session
