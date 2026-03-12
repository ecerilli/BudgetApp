import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCashflowEntriesByCategory, useCreateAdHocEntry } from '@/hooks/useCashflowEntries'
import { CashFlowRow } from './CashFlowRow'
import type { ItemCategory } from '@/types/database'
import { toast } from 'sonner'

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const categoryLabels: Record<string, string> = {
  housing: 'Housing',
  utilities: 'Utilities',
  car: 'Car',
  food: 'Food',
  subscriptions: 'Subscriptions',
  misc: 'Misc',
  business: 'Business',
  taxes: 'Taxes',
  savings: 'Savings',
  income: 'Income',
}

const categoryOrder = [
  'income', 'housing', 'utilities', 'car', 'food',
  'subscriptions', 'business', 'taxes', 'savings', 'misc',
]

const adHocCategories: { value: ItemCategory; label: string }[] = [
  { value: 'housing', label: 'Housing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'car', label: 'Car' },
  { value: 'food', label: 'Food' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'misc', label: 'Misc' },
  { value: 'business', label: 'Business' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'savings', label: 'Savings' },
  { value: 'income', label: 'Income' },
]

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

export function CashFlowPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [adHocOpen, setAdHocOpen] = useState(false)

  const {
    grouped,
    totalProjected,
    totalActual,
    totalUnpaid,
    totalIncome,
    isLoading,
  } = useCashflowEntriesByCategory(year, month)

  function prevMonth() {
    if (month === 1) {
      setMonth(12)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
  }

  function nextMonth() {
    if (month === 12) {
      setMonth(1)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  const orderedCategories = categoryOrder.filter((cat) => grouped[cat]?.length > 0)
  const hasEntries = orderedCategories.length > 0

  return (
    <div className="space-y-6">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={prevMonth}
            className="text-muted-foreground hover:text-foreground transition-colors px-2 py-1 text-lg"
          >
            &larr;
          </button>
          <div className="text-center min-w-[10rem]">
            <h1 className="text-2xl font-semibold tracking-tight">
              {monthNames[month - 1]}
            </h1>
            <p className="text-sm text-muted-foreground">{year}</p>
          </div>
          <button
            onClick={nextMonth}
            className="text-muted-foreground hover:text-foreground transition-colors px-2 py-1 text-lg"
          >
            &rarr;
          </button>
          {!isCurrentMonth && (
            <button
              onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1) }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Today
            </button>
          )}
        </div>
        <Button variant="outline" onClick={() => setAdHocOpen(true)}>
          Add Entry
        </Button>
      </div>

      {/* Summary bar */}
      {hasEntries && !isLoading && (
        <div className="flex gap-6 text-sm flex-wrap">
          <div>
            <span className="text-muted-foreground">Projected </span>
            <span className="font-mono tabular-nums font-medium">{formatCurrency(totalProjected)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Paid </span>
            <span className="font-mono tabular-nums font-medium">{formatCurrency(totalActual)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Remaining </span>
            <span className="font-mono tabular-nums font-medium">{formatCurrency(totalUnpaid)}</span>
          </div>
          {totalIncome > 0 && (
            <>
              <div className="border-l border-border" />
              <div>
                <span className="text-muted-foreground">Income </span>
                <span className="font-mono tabular-nums font-medium text-success">{formatCurrency(totalIncome)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Savings </span>
                <span className={`font-mono tabular-nums font-medium ${totalIncome - totalUnpaid >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(totalIncome - totalUnpaid)}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Column headers */}
      {hasEntries && !isLoading && (
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground px-3">
          <span>Item</span>
          <div className="flex gap-4">
            <span className="min-w-[5rem] text-right px-2">Projected</span>
            <span className="min-w-[5rem] text-right px-2">Actual</span>
            <span className="w-5" />
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasEntries && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No entries for {monthNames[month - 1]} {year}. Generate from your budget or add an entry.
        </p>
      )}

      {/* Entries grouped by category */}
      {orderedCategories.map((cat) => {
        const entries = grouped[cat]
        const catTotal = entries.reduce((s, e) => s + Number(e.projected_amount), 0)

        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {categoryLabels[cat] ?? cat}
              </h2>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {formatCurrency(catTotal)}
              </span>
            </div>
            <div className="border border-border rounded divide-y divide-border">
              {entries.map((entry) => (
                <CashFlowRow key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        )
      })}

      <AdHocEntryDialog
        open={adHocOpen}
        onOpenChange={setAdHocOpen}
        year={year}
        month={month}
      />
    </div>
  )
}

function AdHocEntryDialog({
  open,
  onOpenChange,
  year,
  month,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number
  month: number
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ItemCategory>('misc')
  const [amount, setAmount] = useState('')
  const createEntry = useCreateAdHocEntry()

  function reset() {
    setName('')
    setCategory('misc')
    setAmount('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !amount) return

    createEntry.mutate(
      {
        year,
        month,
        name: name.trim(),
        category,
        projected_amount: parseFloat(amount) || 0,
      },
      {
        onSuccess: () => {
          toast.success('Entry added')
          reset()
          onOpenChange(false)
        },
        onError: () => toast.error('Failed to add entry'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Entry</DialogTitle>
          <DialogDescription>
            Add a one-off expense or income for {monthNames[month - 1]} {year}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adhoc-name">Name</Label>
            <Input
              id="adhoc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Car repair"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ItemCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {adHocCategories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adhoc-amount">Amount</Label>
              <Input
                id="adhoc-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createEntry.isPending}>
              Add Entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
