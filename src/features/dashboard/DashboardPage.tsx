import { useState } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAccountsByType } from '@/hooks/useAccounts'
import { AccountCard } from '@/features/dashboard/AccountCard'
import { AddAccountDialog } from '@/features/dashboard/AddAccountDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Account, AccountType } from '@/types/database'

const sectionOrder: { type: AccountType; label: string }[] = [
  { type: 'cash', label: 'Cash & Checking' },
  { type: 'credit', label: 'Credit Cards' },
  { type: 'retirement', label: 'Retirement' },
  { type: 'investment', label: 'Investments' },
  { type: '529', label: '529 Plans' },
  { type: 'other', label: 'Other' },
]

export function DashboardPage() {
  const { profile } = useAuth()
  const { grouped, totals, netCash, netWorth, isLoading } = useAccountsByType()
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back{profile?.display_name ? `, ${profile.display_name}` : ''}.
        </p>
      </div>

      {/* Net Worth Summary */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard label="Net Cash" value={netCash} />
          <SummaryCard label="CC Debt" value={-totals.credit} negative />
          <SummaryCard label="Retirement" value={totals.retirement} />
          <SummaryCard label="Net Worth" value={netWorth} highlight />
        </section>
      )}

      {/* Account Sections */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Accounts</h2>
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
            Add Account
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {sectionOrder
              .filter((s) => grouped[s.type]?.length > 0)
              .map((section) => (
                <AccountSection
                  key={section.type}
                  label={section.label}
                  accounts={grouped[section.type]}
                />
              ))}

            {Object.keys(grouped).length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No accounts yet. Add your first account to get started.
              </p>
            )}
          </>
        )}
      </section>

      <AddAccountDialog open={showAdd} onOpenChange={setShowAdd} />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  negative,
  highlight,
}: {
  label: string
  value: number
  negative?: boolean
  highlight?: boolean
}) {
  const formatted = formatCurrency(Math.abs(value))
  const isNeg = value < 0

  return (
    <div
      className={`rounded-lg border border-border bg-card p-4 ${
        highlight ? 'ring-1 ring-accent/20' : ''
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-xl font-semibold font-mono tabular-nums mt-1 ${
          negative || isNeg ? 'text-destructive' : ''
        }`}
      >
        {isNeg ? '-' : ''}
        {formatted}
      </p>
    </div>
  )
}

function AccountSection({
  label,
  accounts,
}: {
  label: string
  accounts: Account[]
}) {
  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {label}
      </h3>
      <div className="rounded-lg border border-border bg-card divide-y divide-border px-3">
        {accounts.map((account) => (
          <AccountCard key={account.id} account={account} />
        ))}
      </div>
    </div>
  )
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}
