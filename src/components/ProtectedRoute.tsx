import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/features/auth/auth-context'
import { AppNav } from '@/components/AppNav'

export function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <HouseholdGate />
}

function HouseholdGate() {
  const { householdId, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!householdId) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground isolate">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-10rem] top-[-8rem] h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute right-[-8rem] top-16 h-64 w-64 rounded-full bg-warning/10 blur-3xl" />
      </div>
      <AppNav />
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-28 pt-8 sm:px-6 sm:pb-12 sm:pt-10">
        <Outlet />
      </main>
    </div>
  )
}
