import { useAuth } from '@/features/auth/AuthProvider'

export function DashboardPage() {
  const { profile } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back{profile?.display_name ? `, ${profile.display_name}` : ''}.
        </p>
      </div>

      {/* Net Worth Summary */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Net Cash" value="--" />
        <SummaryCard label="CC Debt" value="--" />
        <SummaryCard label="Retirement" value="--" />
        <SummaryCard label="Net Worth" value="--" />
      </section>

      {/* Account sections will be added in Phase C */}
      <section>
        <h2 className="text-lg font-medium mb-3">Accounts</h2>
        <p className="text-sm text-muted-foreground">
          No accounts yet. Add your first account to get started.
        </p>
      </section>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold font-mono mt-1">{value}</p>
    </div>
  )
}
