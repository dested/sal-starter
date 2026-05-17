import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { toNodeHandler } from 'better-auth/node'
import express from 'express'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { auth } from './server/auth'
import { appRouter } from './server/router'
import { createContext } from './server/trpc'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'
const PORT = Number(process.env.PORT ?? 3000)

const resolve = (p: string) => path.resolve(__dirname, p)

async function createServer() {
  const app = express()

  // better-auth handler — mounted BEFORE express.json() (better-auth reads
  // the raw body itself).
  app.all('/api/auth/*splat', toNodeHandler(auth))

  app.use(
    '/api/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, type, path: trpcPath, input }) {
        console.error(
          `[trpc] ${type} ${trpcPath ?? '<unknown>'} failed: ${error.code} ${error.message}`,
          { input },
        )
        if (error.code === 'INTERNAL_SERVER_ERROR' && error.stack) {
          console.error(error.stack)
        }
      },
    }),
  )

  let vite: Awaited<ReturnType<typeof import('vite').createServer>> | undefined

  if (!isProd) {
    vite = await (
      await import('vite')
    ).createServer({
      root: __dirname,
      server: { middlewareMode: true },
      appType: 'custom',
    })
    app.use(vite.middlewares)
  } else {
    app.use(
      (await import('compression')).default(),
      express.static(resolve('./dist/client'), { index: false }),
    )
  }

  const indexProd = isProd
    ? fs.readFileSync(resolve('./dist/client/index.html'), 'utf-8')
    : ''

  app.use(async (req, res) => {
    try {
      let template: string
      let render: typeof import('./src/entry-server').render

      if (!isProd && vite) {
        template = fs.readFileSync(resolve('./index.html'), 'utf-8')
        template = await vite.transformIndexHtml(req.originalUrl, template)
        render = (await vite.ssrLoadModule('/src/entry-server.tsx')).render
      } else {
        template = indexProd
        // @ts-ignore — produced by `vite build --ssr`; may not exist before first build
        render = (await import('./dist/server/entry-server.js')).render
      }

      const { html: appHtml, dehydratedState } = await render(req)

      const stateScript = `<script>window.__SSR_STATE__ = ${jsonForScript({ dehydratedState })}</script>`
      const html = template
        .replace('<!--app-state-->', stateScript)
        .replace('<!--app-html-->', appHtml)

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
    } catch (e: unknown) {
      if (e instanceof Response) {
        const location = e.headers.get('location')
        if (location) {
          res.redirect(e.status, location)
        } else {
          const body = await e.text()
          res.status(e.status).end(body)
        }
        return
      }
      if (!isProd && vite) vite.ssrFixStacktrace(e as Error)
      const err = e as Error
      console.error(err.stack ?? err)
      res.status(500).end(err.stack ?? String(err))
    }
  })

  app.listen(PORT, () => {
    console.log(`server running on http://localhost:${PORT}`)
  })
}

// JSON for safe inline-script embedding: escape `<` so `</script>` can't
// terminate the script tag.
function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

createServer()
