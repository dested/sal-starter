import ReactDOM from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import App from './App'
import { routes } from './app/routes'
import { deserializeSsrState } from '~/lib/ssr-state'
import { followSystemTheme } from '~/lib/theme'
import { getBrowserClients } from '~/lib/trpc'

const dehydratedState = deserializeSsrState(window.__SSR_STATE__)

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
