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
  // better-auth's limiter (on in production) counts per IP and path. Stated so
  // a fork that tightens `max` sees the exemption: /get-session is a cookie read
  // with nothing to guess, and every navigation calls it, so limiting it signs
  // busy people (or a whole office behind one NAT) out. Credential paths keep
  // better-auth's own stricter rules (sign-in/up: 3 per 10 s).
  rateLimit: {
    window: 10,
    max: 100,
    customRules: { '/get-session': false },
  },
  plugins: [expo()],
  trustedOrigins: [...appOrigins, ...devOrigins],
})

export type Session = typeof auth.$Infer.Session
