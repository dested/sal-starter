// Who may sign up (SIGNUP_ALLOWLIST) and who is an admin (ADMIN_EMAILS). Both
// are env lists parsed in env.ts: trimmed, lowercased, blanks dropped. The
// sign-up check runs in better-auth's user-create hook (auth.ts), so no client
// can skip it; adminProcedure (trpc.ts) reads isAdmin off the tRPC context.
import { env } from './env'

/** The better-auth error `code` a refused sign-up carries (web and mobile show its message). */
export const SIGNUP_CLOSED = 'SIGNUP_CLOSED'
export const SIGNUP_CLOSED_MESSAGE = 'Sign-up is invite-only, and this email is not on the list'

/**
 * Whether `email` matches an entry: an exact address (`ada@example.com`) or a
 * whole domain (`@example.com`, that domain only, not its subdomains).
 */
export function emailMatches(email: string, entries: readonly string[]): boolean {
  const normalized = email.trim().toLowerCase()
  const at = normalized.lastIndexOf('@')
  if (at <= 0) return false
  const domain = normalized.slice(at)
  return entries.some((entry) => (entry.startsWith('@') ? entry === domain : entry === normalized))
}

/** Exact addresses only: an `@domain` entry in ADMIN_EMAILS never makes anyone an admin. */
export function isAdminEmail(
  email: string | null | undefined,
  admins: readonly string[] = env.ADMIN_EMAILS
): boolean {
  if (typeof email !== 'string') return false
  return emailMatches(
    email,
    admins.filter((a) => !a.startsWith('@'))
  )
}

/** A blank allowlist means sign-up is open; admins may always sign up. */
export function signUpAllowed(
  email: string,
  rules: { allowlist: readonly string[]; admins: readonly string[] } = {
    allowlist: env.SIGNUP_ALLOWLIST,
    admins: env.ADMIN_EMAILS,
  }
): boolean {
  if (rules.allowlist.length === 0) return true
  return emailMatches(email, rules.allowlist) || isAdminEmail(email, rules.admins)
}
