// `init --no-auth`: a fork with no accounts. Takes better-auth out of web (and
// mobile when the fork has it): the auth server and client, sign-in/up pages
// and screens, the session in loaders and the tRPC context, the auth tables
// (the init migration is regenerated), the auth env vars and the e2e auth flows.
// Posts stay as the demo, without an author; /dashboard is public.
//
// Every edit is an exact string or an anchored span copied from the template,
// checked before anything is written: when the template moves under one, the
// run stops and names it. `bun scripts/no-auth.ts --check` runs only that check
// (keep it green when you edit a file listed here); `bun scripts/no-auth.ts`
// applies it to the current repo, which is what init calls.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { readProject, type Surface } from './project'
import { c, fail, run } from './shell'

type Edit = { file: string; find: string | RegExp; replace?: string }

// Removed whole. Directories go with everything under them.
const WEB_DELETE = [
  'apps/web/server/auth.ts',
  'apps/web/server/access.ts',
  'apps/web/server/access.test.ts',
  'apps/web/src/lib/auth-client.ts',
  'apps/web/src/lib/loader.ts',
  'apps/web/src/lib/loader.test.ts',
  'apps/web/src/app/sign-in.tsx',
  'apps/web/src/app/sign-up.tsx',
  'apps/web/e2e/auth-next.spec.ts',
  // Every baseline shows the signed-out nav; `bun run test:e2e:update` rewrites them.
  'apps/web/e2e/__screenshots__/smoke.spec.ts',
]
const MOBILE_DELETE = [
  'apps/mobile/src/app/(auth)',
  'apps/mobile/src/lib/auth-client.ts',
  'apps/mobile/src/screens/sign-in.tsx',
  'apps/mobile/src/screens/sign-up.tsx',
]

/** Paths a no-auth fork deletes (for `bun run sync` to keep deleted). */
export const NO_AUTH_PATHS = [...WEB_DELETE, ...MOBILE_DELETE]

const DEPS = ['better-auth', '@better-auth/expo']

const WEB_EDITS: Edit[] = [
  // server.ts: no /api/auth mount.
  { file: 'apps/web/server.ts', find: "import { toNodeHandler } from 'better-auth/node'\n" },
  { file: 'apps/web/server.ts', find: "import { auth } from './server/auth'\n" },
  {
    file: 'apps/web/server.ts',
    find: /^ {2}\/\/ better-auth handler[\s\S]*?app\.all\('\/api\/auth\/\*splat', toNodeHandler\(auth\)\)\n\n/m,
  },
  {
    file: 'apps/web/server.ts',
    find: "'/', '/sign-in', '/sign-up', '/dashboard'",
    replace: "'/', '/dashboard'",
  },
  { file: 'apps/web/server.ts', find: ", '/api/trpc', '/api/auth']", replace: ", '/api/trpc']" },

  // env.ts: no auth secret, URL, allowlist or admins.
  {
    file: 'apps/web/server/env.ts',
    find: /^ {4}BETTER_AUTH_SECRET: z[\s\S]*?ADMIN_EMAILS: emailList,\n/m,
  },
  {
    file: 'apps/web/server/env.ts',
    find: /\n {2}\.transform\(\(e\) => \(\{ \.\.\.e, BETTER_AUTH_URL: [^\n]*\n/,
    replace: '\n',
  },

  // trpc.ts: an empty context, publicProcedure only.
  {
    file: 'apps/web/server/trpc.ts',
    find: "import { initTRPC, TRPCError } from '@trpc/server'",
    replace: "import { initTRPC } from '@trpc/server'",
  },
  {
    file: 'apps/web/server/trpc.ts',
    find: "import { isAdminEmail } from './access'\nimport { auth, type Session } from './auth'\n",
  },
  { file: 'apps/web/server/trpc.ts', find: ' (what better-auth reads)' },
  {
    file: 'apps/web/server/trpc.ts',
    find: /^export type Context = \{ session[\s\S]*?\n\}\n/m,
    replace:
      '// No accounts in this project (init --no-auth): procedures get an empty context.\n' +
      'export type Context = Record<string, never>\n\n' +
      '/** The context for every caller (HTTP here, the SSR proxy in entry-server). */\n' +
      'export function contextFor(): Context {\n  return {}\n}\n',
  },
  {
    file: 'apps/web/server/trpc.ts',
    find: /^export async function contextFromHeaders\(headers: Headers\): Promise<Context> \{\n[^\n]*\n\}\n/m,
    replace:
      'export async function contextFromHeaders(_headers: Headers): Promise<Context> {\n  return contextFor()\n}\n',
  },
  {
    file: 'apps/web/server/trpc.ts',
    find: /\nexport const protectedProcedure = [\s\S]*$/,
    replace: '\n',
  },

  // router.ts: no `me`; posts are anonymous.
  {
    file: 'apps/web/server/router.ts',
    find: "import { router, publicProcedure, protectedProcedure } from './trpc'",
    replace: "import { router, publicProcedure } from './trpc'",
  },
  { file: 'apps/web/server/router.ts', find: /^ {2}me: protectedProcedure\.[^\n]*\n/m },
  { file: 'apps/web/server/router.ts', find: /^ {8}include: \{ author: [^\n]*\n/m },
  { file: 'apps/web/server/router.ts', find: /^ {8}authorName: [^\n]*\n/m },
  {
    file: 'apps/web/server/router.ts',
    find: '    create: protectedProcedure',
    replace: '    create: publicProcedure',
  },
  {
    file: 'apps/web/server/router.ts',
    find: /\.mutation\(async \(\{ ctx, input \}\) => \{\n[\s\S]*?\n {6}\}\),\n/,
    replace: '.mutation(({ input }) => prisma.post.create({ data: input })),\n',
  },

  // schema.prisma: no better-auth models; Post has no author. The init
  // migration is regenerated from it (regenerateInitMigration).
  {
    file: 'apps/web/prisma/schema.prisma',
    find: /^\/\/\n\/\/ Models match better-auth's[\s\S]*?\n(?=\n)/m,
  },
  { file: 'apps/web/prisma/schema.prisma', find: /^model User \{[\s\S]*?\n\}\n\n/m },
  { file: 'apps/web/prisma/schema.prisma', find: /^model Session \{[\s\S]*?\n\}\n\n/m },
  { file: 'apps/web/prisma/schema.prisma', find: /^model Account \{[\s\S]*?\n\}\n\n/m },
  { file: 'apps/web/prisma/schema.prisma', find: /^model Verification \{[\s\S]*?\n\}\n\n/m },
  {
    file: 'apps/web/prisma/schema.prisma',
    find: /^ {2}authorId +String[^\n]*\n {2}author +User[^\n]*\n/m,
  },

  // SSR: no session lookup, no session in the router context.
  {
    file: 'apps/web/src/entry-server.tsx',
    find: "import { auth, type Session } from '../server/auth'\n",
  },
  { file: 'apps/web/src/entry-server.tsx', find: /^ {2}session: Session \| null\n/m },
  {
    file: 'apps/web/src/entry-server.tsx',
    find: /^ {2}const session = await auth\.api\.getSession\([^\n]*\n\n/m,
  },
  {
    file: 'apps/web/src/entry-server.tsx',
    find: 'ctx: contextFor(session),',
    replace: 'ctx: contextFor(),',
  },
  {
    file: 'apps/web/src/entry-server.tsx',
    find: /^ {2}requestContext\.set\(sessionContext, [^\n]*\n/m,
  },
  { file: 'apps/web/src/entry-server.tsx', find: /^ {4}session,\n(?= {4}ssrState)/m },
  {
    file: 'apps/web/src/entry-server.tsx',
    find: "import { clientsContext, sessionContext } from './lib/router-context'",
    replace: "import { clientsContext } from './lib/router-context'",
  },
  {
    file: 'apps/web/src/lib/router-context.ts',
    find: "import { authClient } from '~/lib/auth-client'\n",
  },
  {
    file: 'apps/web/src/lib/router-context.ts',
    find: "import type { Session } from '../../server/auth'\n",
  },
  {
    file: 'apps/web/src/lib/router-context.ts',
    find: '(tRPC calls the router directly, the session comes from the request headers)',
    replace: '(tRPC calls the router directly)',
  },
  {
    file: 'apps/web/src/lib/router-context.ts',
    find: /^\/\*\*\n \* The current session[\s\S]*?export const sessionContext = [^\n]*\n\n/m,
  },
  {
    file: 'apps/web/src/lib/router-context.ts',
    find: /^ {2}let session: Promise<Session \| null> \| undefined\n/m,
  },
  {
    file: 'apps/web/src/lib/router-context.ts',
    find: /^ {2}context\.set\(sessionContext, [^\n]*\n/m,
  },
  {
    file: 'apps/web/src/lib/router-context.ts',
    find: /\nasync function fetchClientSession\(\)[\s\S]*?\n\}\n/,
  },

  // Routes: no root session loader, no sign-in/up; the dashboard is public.
  {
    file: 'apps/web/src/app/routes.tsx',
    find: "import { redirectIfSignedIn, requireSession } from '~/lib/loader'\n",
  },
  {
    file: 'apps/web/src/app/routes.tsx',
    find: "import { clientsContext, sessionContext } from '~/lib/router-context'",
    replace: "import { clientsContext } from '~/lib/router-context'",
  },
  {
    file: 'apps/web/src/app/routes.tsx',
    find: "import type { Session } from '../../server/auth'\n",
  },
  {
    file: 'apps/web/src/app/routes.tsx',
    find: "import { SignInPage } from './sign-in'\nimport { SignUpPage } from './sign-up'\n",
  },
  {
    file: 'apps/web/src/app/routes.tsx',
    find: /^export type RootLoaderData = [\s\S]*?\nasync function dashboardLoader[\s\S]*?\n\}\n/m,
    replace:
      'async function dashboardLoader({ context }: LoaderFunctionArgs): Promise<null> {\n' +
      "  // Warm the page's queries so the dashboard renders with data.\n" +
      '  const { queryClient, trpc } = context.get(clientsContext)\n' +
      '  await queryClient.prefetchQuery(trpc.posts.list.queryOptions()) // demo\n' +
      '  return null\n}\n',
  },
  { file: 'apps/web/src/app/routes.tsx', find: /^ {4}loader: rootLoader,\n/m },
  {
    file: 'apps/web/src/app/routes.tsx',
    find: /^ {6}\{ path: 'sign-in',[^\n]*\n {6}\{ path: 'sign-up',[^\n]*\n/m,
  },

  // Pages: no signed-in/out branches.
  {
    file: 'apps/web/src/app/layout.tsx',
    find: /^import \{\n {2}Link,\n {2}NavLink,\n {2}Outlet,\n {2}ScrollRestoration,\n[\s\S]*?\} from 'react-router'\nimport \{ authClient \} from '~\/lib\/auth-client'\n/m,
    replace: "import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router'\n",
  },
  { file: 'apps/web/src/app/layout.tsx', find: "import type { RootLoaderData } from './routes'\n" },
  {
    file: 'apps/web/src/app/layout.tsx',
    find: /^ {2}const data = useRouteLoaderData<RootLoaderData>\('root'\)\n[\s\S]*?await revalidator\.revalidate\(\)\n {2}\}\n\n/m,
  },
  {
    file: 'apps/web/src/app/layout.tsx',
    find: /^ {10}<div className="ml-auto[\s\S]*?\n {10}<\/div>\n/m,
  },
  {
    file: 'apps/web/src/app/home.tsx',
    find: "import { Link, useRouteLoaderData } from 'react-router'",
    replace: "import { Link } from 'react-router'",
  },
  { file: 'apps/web/src/app/home.tsx', find: "import type { RootLoaderData } from './routes'\n" },
  {
    file: 'apps/web/src/app/home.tsx',
    find: /^ {2}const data = useRouteLoaderData<RootLoaderData>\('root'\)\n {2}const session = [^\n]*\n\n/m,
  },
  {
    file: 'apps/web/src/app/home.tsx',
    find: /^ {6}\{session \? \(\n[\s\S]*?\n {6}\)\}\n/m,
    replace:
      '      <Link to="/dashboard" className={buttonVariants({ size: \'lg\' })}>\n' +
      '        Open dashboard\n      </Link>\n',
  },
  {
    file: 'apps/web/src/app/dashboard.tsx',
    find: "import { useLoaderData } from 'react-router'\n",
  },
  {
    file: 'apps/web/src/app/dashboard.tsx',
    find: "import type { RootLoaderData } from './routes'\n",
  },
  {
    file: 'apps/web/src/app/dashboard.tsx',
    find: /^ {2}const \{ session \} = useLoaderData<RootLoaderData>\(\)\n/m,
  },
  { file: 'apps/web/src/app/dashboard.tsx', find: /^ {2}if \(!session\) return null\n\n/m },
  {
    file: 'apps/web/src/app/dashboard.tsx',
    find: "import { useQuery } from '@tanstack/react-query'\n",
  },
  { file: 'apps/web/src/app/dashboard.tsx', find: "import { useTRPC } from '~/lib/trpc'\n" },
  {
    file: 'apps/web/src/app/dashboard.tsx',
    find: /^\/\/ The signed-in page\.[^\n]*\n\/\/[^\n]*\n/m,
  },
  {
    file: 'apps/web/src/app/dashboard.tsx',
    find: /^ {2}const trpc = useTRPC\(\)\n {2}const me = useQuery\(trpc\.me\.queryOptions\(\)\)\n/m,
  },
  {
    file: 'apps/web/src/app/dashboard.tsx',
    find: /\{me\.data\?\.name \?\? session\.user\.name\}/,
    replace: 'Dashboard',
  },
  {
    file: 'apps/web/src/components/demo/posts-demo.tsx',
    find: "by {p.authorName ?? 'unknown'} · ",
  },

  // e2e: no auth tables, secrets or sign-up flow.
  {
    file: 'apps/web/e2e/global-setup.ts',
    find: '"post", "session", "account", "verification", "user"',
    replace: '"post"',
  },
  {
    file: 'apps/web/e2e/global-setup.ts',
    find: 'so sign-up uses a fresh fixed user and screenshots',
    replace: 'so screenshots',
  },
  {
    file: 'apps/web/playwright.config.ts',
    find: /^ {6}BETTER_AUTH_SECRET: [^\n]*\n {6}BETTER_AUTH_URL: [^\n]*\n/m,
  },
  { file: 'apps/web/e2e/smoke.spec.ts', find: /^\/\/ Fixed user[\s\S]*?const USER = [^\n]*\n\n/m },
  {
    file: 'apps/web/e2e/smoke.spec.ts',
    find: "test('home page renders for a signed-out visitor'",
    replace: "test('home page renders'",
  },
  {
    file: 'apps/web/e2e/smoke.spec.ts',
    find: /^ {2}\/\/ Two "Sign in" links[^\n]*\n {2}await expect\(page\.getByRole\('link', \{ name: 'Sign in'[^\n]*\n/m,
    replace: "  await expect(page.getByRole('link', { name: 'Open dashboard' })).toBeVisible()\n",
  },
  { file: 'apps/web/e2e/smoke.spec.ts', find: /^test\('sign-up page renders'[\s\S]*?\n\}\)\n\n/m },
  {
    file: 'apps/web/e2e/smoke.spec.ts',
    find: /^test\('sign up → dashboard → create post → sign out'[\s\S]*?await page\.waitForURL\('\*\*\/dashboard'\)\n/m,
    replace:
      "test('dashboard → create post', async ({ page }) => {\n  await page.goto('/dashboard')\n",
  },
  {
    file: 'apps/web/e2e/smoke.spec.ts',
    find: /\n {2}\/\/ Sign out returns to the signed-out home\.[\s\S]*?(?=\n\}\)\n)/,
  },

  { file: '.env.example', find: /^BETTER_AUTH_SECRET=[^\n]*\nBETTER_AUTH_URL=[^\n]*\n/m },
  {
    file: '.env.example',
    find: /\n# Who may sign up:[^\n]*\nSIGNUP_ALLOWLIST=[^\n]*\n# Comma list of admin emails[^\n]*\nADMIN_EMAILS=[^\n]*\n/,
  },
]

const MOBILE_EDITS: Edit[] = [
  {
    file: 'apps/mobile/src/app/_layout.tsx',
    find: "import { authClient } from '~/lib/auth-client'\n",
  },
  {
    file: 'apps/mobile/src/app/_layout.tsx',
    find: 'Layouts hold providers and the session guard only;',
    replace: 'Layouts hold providers only;',
  },
  {
    file: 'apps/mobile/src/app/_layout.tsx',
    find: /^ {2}const \{ data: session, isPending \} = authClient\.useSession\(\)\n/m,
  },
  {
    file: 'apps/mobile/src/app/_layout.tsx',
    find: /^ {14}\{\/\* The Stack mounts once the cached session[\s\S]*?\n {16}<\/Stack>\n {14}\)\}\n/m,
    replace:
      '              <Stack\n' +
      '                screenOptions={{\n' +
      '                  headerShown: false,\n' +
      '                  contentStyle: { backgroundColor: colors.background },\n' +
      '                }}\n' +
      '              />\n',
  },
  {
    file: 'apps/mobile/src/app/_layout.tsx',
    find: 'ready={!isPending && fontsLoaded}',
    replace: 'ready={fontsLoaded}',
  },
  { file: 'apps/mobile/src/lib/trpc.ts', find: "import { authClient } from '~/lib/auth-client'\n" },
  {
    file: 'apps/mobile/src/lib/trpc.ts',
    find: /^\/\/ Same \/api\/trpc and superjson transformer as web\.[^\n]*\n\/\/ so the better-auth cookie[^\n]*\n/m,
    replace: '// Same /api/trpc and superjson transformer as web.\n',
  },
  { file: 'apps/mobile/src/lib/trpc.ts', find: /^ {6}async headers\(\) \{\n[\s\S]*?\n {6}\},\n/m },
  {
    file: 'apps/mobile/src/lib/app-config.ts',
    find: '(deep links, better-auth redirects)',
    replace: '(deep links)',
  },
  {
    file: 'apps/mobile/src/screens/home.tsx',
    find: "import { authClient } from '~/lib/auth-client'\n",
  },
  {
    file: 'apps/mobile/src/screens/home.tsx',
    find: "import { Button } from '~/components/ui/button'\n",
  },
  {
    file: 'apps/mobile/src/screens/home.tsx',
    find: 'the signed-in page, sign-out and the native examples',
    replace: 'the native examples',
  },
  {
    file: 'apps/mobile/src/screens/home.tsx',
    find: /^ {2}const \{ data: session \} = authClient\.useSession\(\)\n\n {2}if \(!session\) return null\n\n/m,
  },
  { file: 'apps/mobile/src/screens/home.tsx', find: '{session.user.name}', replace: 'Home' },
  {
    file: 'apps/mobile/src/screens/home.tsx',
    find: /^ {8}<Button\n(?: {10}[^\n]*\n)*? {10}label="Sign out"\n[\s\S]*?\/>\n/m,
  },
  {
    file: 'apps/mobile/src/components/demo/posts-demo.tsx',
    find: "by {p.authorName ?? 'unknown'} · ",
  },
]

function hasMobile(surfaces: Surface[]): boolean {
  return surfaces.includes('mobile') && existsSync('apps/mobile')
}

function editsFor(surfaces: Surface[]): Edit[] {
  return hasMobile(surfaces) ? [...WEB_EDITS, ...MOBILE_EDITS] : WEB_EDITS
}

function count(source: string, find: string | RegExp): number {
  if (typeof find === 'string') return source.split(find).length - 1
  return [...source.matchAll(new RegExp(find.source, `${find.flags}g`))].length
}

const describe = (find: string | RegExp) =>
  typeof find === 'string' ? JSON.stringify(find.split('\n')[0]) : String(find).slice(0, 80)

/** Every edit whose anchor isn't in the tree exactly once, as messages. Empty = ready. */
export function checkNoAuth(surfaces: Surface[]): string[] {
  const problems: string[] = []
  if (!surfaces.includes('web')) problems.push('--no-auth needs the web app (auth lives there).')
  // Edits run in order, so each is checked against the text the earlier ones leave.
  const sources = new Map<string, string>()
  for (const { file, find, replace = '' } of editsFor(surfaces)) {
    const source = sources.get(file) ?? (existsSync(file) ? readFileSync(file, 'utf8') : null)
    if (source === null) {
      problems.push(`${file} is missing`)
      continue
    }
    const n = count(source, find)
    if (n !== 1) problems.push(`${file}: ${describe(find)} matches ${n} times, not once`)
    sources.set(file, source.replace(find, replace))
  }
  return problems
}

// The template's one migration, rebuilt from the edited schema (a fork's
// database has applied nothing yet). Uses the workspace's pinned Prisma CLI.
function regenerateInitMigration(): string {
  const dir = 'apps/web/prisma/migrations'
  const migrations = readdirSync(dir).filter((d) => /^\d{14}_/.test(d))
  const [only] = migrations
  if (migrations.length !== 1 || only === undefined) {
    fail(
      `no-auth: expected one migration in ${dir}, found ${migrations.length}.`,
      'Run --no-auth on a fresh fork, before any migration of its own.'
    )
  }
  const sql = execFileSync(
    'bun',
    [
      'run',
      'prisma',
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema',
      'prisma/schema.prisma',
      '--script',
    ],
    { cwd: 'apps/web', encoding: 'utf8', env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' } }
  )
  const file = `${dir}/${only}/migration.sql`
  writeFileSync(file, sql)
  return file
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

// better-auth out of a package.json's dependencies, devDependencies and (root)
// workspaces.catalog. Returns whether anything went.
function dropDependencies(file: string): boolean {
  const pkg: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (!isRecord(pkg)) return false
  const workspaces = pkg.workspaces
  const maps = [
    pkg.dependencies,
    pkg.devDependencies,
    isRecord(workspaces) ? workspaces.catalog : undefined,
  ]
  let changed = false
  for (const deps of maps) {
    if (!isRecord(deps)) continue
    for (const name of DEPS) {
      if (name in deps) {
        delete deps[name]
        changed = true
      }
    }
  }
  if (changed) writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)
  return changed
}

/**
 * Take auth out of the repo in the cwd. Checks every edit first and changes
 * nothing if one fails. Returns the files it touched; the caller runs
 * `bun install` (lockfile, Prisma client) and owns the commit.
 */
export function removeAuth(surfaces: Surface[]): string[] {
  const problems = checkNoAuth(surfaces)
  if (problems.length > 0) {
    fail(
      `no-auth: the template moved under ${problems.length} edit(s):\n  ${problems.join('\n  ')}`,
      'Update WEB_EDITS / MOBILE_EDITS in scripts/no-auth.ts to the template (`bun scripts/no-auth.ts --check`).'
    )
  }
  const touched = new Set<string>()
  for (const { file, find, replace = '' } of editsFor(surfaces)) {
    writeFileSync(file, readFileSync(file, 'utf8').replace(find, replace))
    touched.add(file)
  }
  const deletes = hasMobile(surfaces) ? NO_AUTH_PATHS : WEB_DELETE
  for (const path of deletes) {
    if (!existsSync(path)) continue
    rmSync(path, { recursive: true, force: true })
    touched.add(path)
  }
  for (const file of ['package.json', 'apps/web/package.json', 'apps/mobile/package.json']) {
    if (existsSync(file) && dropDependencies(file)) touched.add(file)
  }
  // A fresh .env from init carries the auth secret; nothing reads it now.
  if (existsSync('.env')) {
    const env = readFileSync('.env', 'utf8')
    const without = env.replace(/^BETTER_AUTH_(SECRET|URL)=[^\n]*\n/gm, '')
    if (without !== env) writeFileSync('.env', without)
  }
  touched.add(regenerateInitMigration())
  run('bun', 'run', '--cwd', 'apps/web', 'db:generate')
  const formattable = [...touched].filter((f) => /\.(tsx?|json)$/.test(f) && existsSync(f))
  run('bunx', 'prettier', '--log-level', 'warn', '--write', ...formattable)
  console.log(
    `  ${c.green('no auth')} ${c.dim(`${touched.size} paths: better-auth, sign-in/up, auth tables`)}`
  )
  return [...touched]
}

if (import.meta.main) {
  const { surfaces } = readProject()
  if (process.argv.includes('--help')) {
    console.log(
      'Usage: bun scripts/no-auth.ts [--check]\n  --check  verify every edit still matches the template; change nothing'
    )
  } else if (process.argv.includes('--check')) {
    const problems = checkNoAuth(surfaces)
    if (problems.length > 0)
      fail(`no-auth: ${problems.length} edit(s) no longer match:\n  ${problems.join('\n  ')}`)
    console.log(
      c.green(`✓ no-auth: ${editsFor(surfaces).length} edits match (${surfaces.join(' + ')})`)
    )
  } else {
    removeAuth(surfaces)
  }
}
