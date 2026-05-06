import { getRequest } from '@tanstack/react-start/server'

export function getSsrCookieHeaders(): Record<string, string> {
  try {
    const req = getRequest()
    const cookie = req.headers.get('cookie')
    return cookie ? { cookie } : {}
  } catch {
    return {}
  }
}
