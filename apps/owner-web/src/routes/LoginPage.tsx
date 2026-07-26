import { Button, Input } from '@hospitality-os/ui'
import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'

import { useAuthStore } from '../features/auth/auth-store.js'

export function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const token = useAuthStore((s) => s.token)
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (token) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={redirectTo} replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch {
      setError('That email or password doesn\'t match our records — check them and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm text-ink-faint">African Hospitality OS</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">Owner sign in</h1>

        <div className="mt-6 space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error ?? undefined}
          />
        </div>

        <Button type="submit" className="mt-6 w-full" loading={loading}>
          Sign in
        </Button>
      </form>
    </div>
  )
}
