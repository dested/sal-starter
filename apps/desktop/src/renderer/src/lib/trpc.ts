// tRPC over Electron IPC (@app/trpc-ipc). TanStack Query never refetches on its
// own: data loads on mount and when the app invalidates it after an action.

import { ipcLink } from '@app/trpc-ipc/renderer'
import { QueryClient } from '@tanstack/react-query'
import { createTRPCClient } from '@trpc/client'
import { createTRPCContext } from '@trpc/tanstack-react-query'
import type { AppRouter } from '../../../main/router'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
    },
    mutations: { retry: false },
  },
})

export const trpcClient = createTRPCClient<AppRouter>({ links: [ipcLink<AppRouter>()] })

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()
