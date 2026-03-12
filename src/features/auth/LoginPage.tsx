import { useState } from 'react'
import { Navigate } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

type AuthMode = 'password' | 'magic-link'
type AuthAction = 'sign-in' | 'sign-up'

export function LoginPage() {
  const { session, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<AuthMode>('password')
  const [action, setAction] = useState<AuthAction>('sign-in')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect if already signed in
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }
  if (session) {
    return <Navigate to="/" replace />
  }

  async function handlePasswordAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (action === 'sign-up') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })
      if (error) {
        setError(error.message)
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        setError(error.message)
      }
    }
    setLoading(false)
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Household Finance
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'password'
              ? action === 'sign-in'
                ? 'Sign in to your account'
                : 'Create a new account'
              : 'Sign in with a magic link'}
          </p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-2">
              <p className="text-sm text-foreground">
                Check your email for a sign-in link.
              </p>
              <p className="text-xs text-muted-foreground">{email}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSent(false)}
                className="mt-2"
              >
                Use a different email
              </Button>
            </div>
          ) : mode === 'password' ? (
            <div className="space-y-4">
              <form onSubmit={handlePasswordAuth} className="space-y-4">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                {error && (
                  <p className="text-xs text-destructive">{error}</p>
                )}
                <Button
                  type="submit"
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={loading}
                >
                  {loading
                    ? 'Loading...'
                    : action === 'sign-in'
                      ? 'Sign In'
                      : 'Create Account'}
                </Button>
              </form>

              <p className="text-center text-xs text-muted-foreground">
                {action === 'sign-in' ? (
                  <>
                    No account?{' '}
                    <button
                      type="button"
                      onClick={() => { setAction('sign-up'); setError(null) }}
                      className="text-accent hover:underline"
                    >
                      Create one
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => { setAction('sign-in'); setError(null) }}
                      className="text-accent hover:underline"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => { setMode('magic-link'); setError(null) }}
              >
                Use magic link instead
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleMagicLink} className="space-y-4">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                {error && (
                  <p className="text-xs text-destructive">{error}</p>
                )}
                <Button
                  type="submit"
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send magic link'}
                </Button>
              </form>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => { setMode('password'); setError(null) }}
              >
                Use email &amp; password instead
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
