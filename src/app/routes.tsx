import type { RouteObject } from 'react-router-dom'
import { Layout } from './layout'
import { HomePage } from './home'
import { SignInPage } from './sign-in'
import { SignUpPage } from './sign-up'
import { DashboardPage } from './dashboard'

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: HomePage },
      { path: 'sign-in', Component: SignInPage },
      { path: 'sign-up', Component: SignUpPage },
      { path: 'dashboard', Component: DashboardPage },
    ],
  },
]
