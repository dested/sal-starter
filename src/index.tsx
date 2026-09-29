import ReactDOM from 'react-dom/client'
import { type DehydratedState } from '@tanstack/react-query'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import App from './App'
import { routes } from './app/routes'
import { followSystemTheme } from '~/lib/theme'
import { getBrowserClients } from '~/lib/trpc'

declare global {
  interface Window {
    __SSR_STATE__?: { dehydratedState: DehydratedState | null }
  }
}

const dehydratedState = window.__SSR_STATE__?.dehydratedState ?? null

const { queryClient, trpcClient } = getBrowserClients()

followSystemTheme()

const router = createBrowserRouter(routes)

const root = document.getElementById('app')
if (!root) throw new Error('#app root element missing from index.html')

ReactDOM.hydrateRoot(
  root,
  <App queryClient={queryClient} trpcClient={trpcClient} dehydratedState={dehydratedState}>
    <RouterProvider router={router} />
  </App>
)
