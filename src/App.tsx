import type { ReactNode } from 'react'
import { AppProviders } from '~/lib/trpc'
import '~/styles/app.css'

export default function App({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>
}
