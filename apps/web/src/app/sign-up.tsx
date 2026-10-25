import { useState } from 'react'
import { Link, useLocation, useNavigate, useRevalidator } from 'react-router'
import { authClient } from '~/lib/auth-client'
import { nextFromSearch } from '~/lib/loader'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

export function SignUpPage() {
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  // `?next=` (same-site paths only, see safeNext) is where the visitor was headed.
  const { search } = useLocation()
  const next = nextFromSearch(search)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await authClient.signUp.email({ name, email, password })
    setLoading(false)
    if (err) {
      setError(err.message ?? 'Sign up failed')
      return
    }
    revalidator.revalidate()
    navigate(next, { replace: true })
  }

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-8 pt-[8vh]">
      <h1 className="font-display text-4xl font-bold tracking-tight">Create account</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            className="h-11"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            className="h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            className="h-11"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="mt-1 h-11 w-full" disabled={loading}>
          {loading ? 'Creating account…' : 'Sign up'}
        </Button>
      </form>
      <Link
        to={`/sign-in${search}`}
        className="self-start text-sm font-medium underline underline-offset-4">
        I already have an account
      </Link>
    </section>
  )
}
