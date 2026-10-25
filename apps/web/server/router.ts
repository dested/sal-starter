import { router, protectedProcedure } from './trpc'
import { demoRouter } from './demo' // demo

export const appRouter = router({
  me: protectedProcedure.query(({ ctx }) => ({ ...ctx.session.user, isAdmin: ctx.isAdmin })),
  posts: demoRouter, // demo
})

export type AppRouter = typeof appRouter
