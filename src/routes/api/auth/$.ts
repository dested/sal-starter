import { createFileRoute } from '@tanstack/react-router'
import { auth } from '~/lib/auth'
import { logBadResponse } from '~/lib/log-response'

const handler = async ({ request }: { request: Request }) => {
  const response = await auth.handler(request)
  await logBadResponse('auth', request, response)
  return response
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
})
