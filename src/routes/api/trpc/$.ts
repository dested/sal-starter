import { createFileRoute } from '@tanstack/react-router'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '~/trpc/router'
import { createContext } from '~/trpc/init'
import { logBadResponse } from '~/lib/log-response'

const handler = async ({ request }: { request: Request }) => {
  const response = await fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    createContext,
    onError({ error, type, path, input }) {
      console.error(
        `[trpc] ${type} ${path ?? '<unknown>'} failed: ${error.code} ${error.message}`,
        { input },
      )
      if (error.code === 'INTERNAL_SERVER_ERROR' && error.stack) {
        console.error(error.stack)
      }
    },
  })
  await logBadResponse('trpc', request, response)
  return response
}

export const Route = createFileRoute('/api/trpc/$')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
})
