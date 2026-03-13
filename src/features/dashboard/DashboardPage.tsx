import { useState } from 'react'
import { useAuth } from '@/features/auth/auth-context'
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
  const { grouped, totals, netCash, isLoading } = useAccountsByType()
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="space-y-8">
      <section className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5 shadow-sm shadow-black/5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Accounts
            </p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Household balances
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Welcome back{profile?.display_name ? `, ${profile.display_name}` : ''}. Track cash on hand, card balances, and the amount that is actually available.
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} className="self-start lg:self-auto">
            Add Account
          </Button>
        </div>
      </section>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[1.25rem]" />
          ))}
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            label="All Cash"
            value={totals.cash}
            tone="default"
            detail="Checking, cash, and liquid accounts"
          />
          <SummaryCard
            label="Credit Card Debt"
            value={totals.credit}
            tone="debt"
            detail="Current card balances to cover"
          />
          <SummaryCard
            label="Net Cash"
            value={netCash}
            tone={netCash < 0 ? 'debt' : 'highlight'}
            detail="Cash minus current card debt"
          />
        </section>
      )}

      {/* Account Sections */}
      <section className="space-y-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-[1.25rem]" />
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
                  type={section.type}
                  accounts={grouped[section.type]}
                />
              ))}

            {Object.keys(grouped).length === 0 && (
              <div className="rounded-[1.5rem] border border-dashed border-border bg-card/70 px-6 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No accounts yet. Add your first account to get started.
                </p>
              </div>
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
  tone,
  detail,
}: {
  label: string
  value: number
  tone: 'default' | 'highlight' | 'debt'
  detail: string
}) {
  const formatted = formatCurrency(Math.abs(value))
  const isNeg = value < 0
  const toneClasses =
    tone === 'debt'
      ? 'border-destructive/20 bg-destructive/5'
      : tone === 'highlight'
        ? 'border-accent/20 bg-accent/6'
        : 'border-border/80 bg-card/90'

  return (
    <div className={`rounded-[1.4rem] border p-5 shadow-sm shadow-black/5 ${toneClasses}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-3 text-3xl font-semibold font-mono tabular-nums tracking-tight ${
          tone === 'debt' || isNeg ? 'text-destructive' : ''
        }`}
      >
        {isNeg ? '-' : ''}
        {formatted}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function AccountSection({
  label,
  type,
  accounts,
}: {
  label: string
  type: AccountType
  accounts: Account[]
}) {
  const total = accounts.reduce((sum, account) => sum + Number(account.balance), 0)
  const showTotal = type === 'cash' || type === 'credit'
  const totalLabel = type === 'credit' ? 'Total debt' : 'Total'
  const totalClassName = type === 'credit' ? 'text-destructive' : 'text-foreground'

  return (
    <div className="rounded-[1.5rem] border border-border/80 bg-card/90 p-4 shadow-sm shadow-black/5 sm:p-5">
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </h3>
      <div className="overflow-hidden rounded-[1.1rem] border border-border/80 bg-background/55 divide-y divide-border/80">
        {accounts.map((account) => (
          <AccountCard key={account.id} account={account} />
        ))}
        {showTotal && (
          <div className="flex items-center justify-between border-t border-border/80 bg-secondary/55 px-4 py-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              {totalLabel}
            </span>
            <span className={`font-mono text-sm font-semibold tabular-nums ${totalClassName}`}>
              {formatCurrency(total)}
            </span>
          </div>
        )}
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
