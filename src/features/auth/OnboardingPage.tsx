import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export function OnboardingPage() {
  const { user } = useAuth()
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setError(null)

    // Generate ID client-side to avoid needing a SELECT-back
    // (RLS SELECT policy requires profile linkage that doesn't exist yet)
    const householdId = crypto.randomUUID()

    const { error: createError } = await supabase
      .from('households')
      .insert({ id: householdId, name: householdName })

    if (createError) {
      setError(createError.message)
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ household_id: householdId })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    window.location.href = '/'
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setError(null)

    const householdId = inviteCode.trim()

    // Try to link profile to the household directly.
    // If the household ID doesn't exist, the FK constraint will reject it.
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ household_id: householdId })
      .eq('id', user.id)

    if (updateError) {
      if (updateError.message.includes('foreign key') || updateError.code === '23503') {
        setError('Household not found. Check the invite code.')
      } else {
        setError(updateError.message)
      }
      setLoading(false)
      return
    }

    window.location.href = '/'
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-semibold tracking-tight">
            Set Up Your Household
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Create a new household or join an existing one.
          </p>
        </CardHeader>
        <CardContent>
          {mode === 'choose' && (
            <div className="space-y-3">
              <Button
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => setMode('create')}
              >
                Create a new household
              </Button>
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setMode('join')}
              >
                Join an existing household
              </Button>
            </div>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                placeholder="Household name"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                required
                autoFocus
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setMode('choose'); setError(null) }}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
          )}

          {mode === 'join' && (
            <form onSubmit={handleJoin} className="space-y-4">
              <Input
                placeholder="Household invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                autoFocus
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setMode('choose'); setError(null) }}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={loading}
                >
                  {loading ? 'Joining...' : 'Join'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
