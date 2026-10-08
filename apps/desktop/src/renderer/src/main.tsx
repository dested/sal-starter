import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { followSystemTheme } from './lib/theme'
import { queryClient, trpcClient, TRPCProvider } from './lib/trpc'

followSystemTheme()

const root = document.getElementById('app')
if (root === null) throw new Error('#app is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <App />
      </TRPCProvider>
    </QueryClientProvider>
  </StrictMode>
)
