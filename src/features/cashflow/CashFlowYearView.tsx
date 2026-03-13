import { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCashflowYear, useTogglePaid, useUpdateCashflowEntry, useCreateCashflowEntry, useDeleteCashflowEntry } from '@/hooks/useCashflowEntries'
import { useAccountsByType, useUpdateAccount } from '@/hooks/useAccounts'
import { useBudgetItems, useCreateBudgetItem, useUpdateBudgetItem } from '@/hooks/useBudgetItems'
import { useHousehold, useUpdateHousehold } from '@/hooks/useHousehold'
import { supabase } from '@/lib/supabase'
import type { CashflowEntry, ItemCategory, Account } from '@/types/database'
import { toast } from 'sonner'

const monthHeaders = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

// Expenses first, then income
const expenseCategoryOrder = [
  'housing', 'utilities', 'car', 'food',
  'subscriptions', 'business', 'taxes', 'savings', 'misc',
]

const expenseCategoryOptions: { value: Exclude<ItemCategory, 'income'>; label: string }[] = [
  { value: 'housing', label: 'Housing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'car', label: 'Car' },
  { value: 'food', label: 'Food' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'business', label: 'Business' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'savings', label: 'Savings' },
  { value: 'misc', label: 'Misc' },
]

interface YearRow {
  key: string
  name: string
  budgetItemId: string | null
  category: string
  entries: (CashflowEntry | null)[] // index 0-11 for months 1-12
}

type MonthStatus = 'past' | 'current' | 'future'

function buildRows(entries: CashflowEntry[]): { expenseRows: YearRow[]; incomeRows: YearRow[]; expensesByCategory: Record<string, YearRow[]> } {
  // Group entries by a unique row key (budget_item_id or name+category for ad-hoc)
  const rowMap = new Map<string, YearRow>()

  for (const entry of entries) {
    const key = entry.budget_item_id ?? `adhoc:${entry.name}:${entry.category}`
    let row = rowMap.get(key)
    if (!row) {
      row = {
        key,
        name: entry.name ?? 'Unnamed',
        budgetItemId: entry.budget_item_id,
        category: entry.category ?? 'misc',
        entries: new Array(12).fill(null),
      }
      rowMap.set(key, row)
    }
    row.entries[entry.month - 1] = entry
  }

  const allRows = Array.from(rowMap.values())
  const incomeRows = allRows.filter((r) => r.category === 'income')
  const expenseRows = allRows.filter((r) => r.category !== 'income')

  // Group expenses by category
  const expensesByCategory: Record<string, YearRow[]> = {}
  for (const row of expenseRows) {
    const cat = row.category
    if (!expensesByCategory[cat]) expensesByCategory[cat] = []
    expensesByCategory[cat].push(row)
  }

  return { expenseRows, incomeRows, expensesByCategory }
}

function sumMonth(rows: YearRow[], monthIdx: number, variableSet?: Set<string>): number {
  return rows.reduce((sum, row) => {
    const entry = row.entries[monthIdx]
    if (!entry) return sum
    const isVar = variableSet && row.budgetItemId && variableSet.has(row.budgetItemId)
    // Fixed items (non-variable): exclude when paid — whether CC or cash, they're settled
    if (entry.is_paid && !isVar) return sum
    // Variable items: use remaining (projected - spent) if actual_amount is set
    if (isVar && entry.actual_amount != null) {
      const remaining = Number(entry.projected_amount) - Number(entry.actual_amount)
      return sum + Math.max(0, remaining)
    }
    return sum + Number(entry.actual_amount ?? entry.projected_amount)
  }, 0)
}

function sumRowTotal(row: YearRow): number {
  return row.entries.reduce((sum, entry) => {
    if (!entry) return sum
    return sum + Number(entry.actual_amount ?? entry.projected_amount)
  }, 0)
}

function fmt(value: number): string {
  if (value === 0) return ''
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(value))
  return value < 0 ? `-${formatted}` : formatted
}

function fmtFull(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function getMonthStatus(viewYear: number, monthIndex: number, today: Date): MonthStatus {
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth()

  if (viewYear < currentYear) return 'past'
  if (viewYear > currentYear) return 'future'
  if (monthIndex < currentMonth) return 'past'
  if (monthIndex === currentMonth) return 'current'
  return 'future'
}

function getMonthValueClass(status: MonthStatus): string {
  return status === 'past' ? 'opacity-45' : ''
}

function getMonthGridClass(status: MonthStatus, monthIndex: number): string {
  return `${monthIndex === 0 ? '' : 'border-l border-border/10'} ${getMonthValueClass(status)}`.trim()
}

export function CashFlowYearView({ year }: { year: number }) {
  const queryClient = useQueryClient()
  const { data: entries, isLoading } = useCashflowYear(year)
  const { netCash, totals, ccPayTotal, ccRollover, grouped } = useAccountsByType()
  const { data: budgetItems } = useBudgetItems()
  const { data: household } = useHousehold()

  // Build set of budget_item_ids that are cc_paid
  const ccPaidSet = new Set<string>(
    (budgetItems ?? []).filter((bi) => bi.cc_paid).map((bi) => bi.id)
  )

  // Build set of budget_item_ids that are variable
  const variableSet = new Set<string>(
    (budgetItems ?? []).filter((bi) => bi.is_variable && !bi.is_income).map((bi) => bi.id)
  )

  // Build set of budget_item_ids that are W2 income (for half-pay mechanic)
  const w2Set = new Set<string>(
    (budgetItems ?? []).filter((bi) => bi.is_income && bi.income_type === 'w2').map((bi) => bi.id)
  )

  // Quarterly tax calculation: sum 1099 income × tax rate ÷ 4
  const taxRate = household?.estimated_tax_rate ?? 0
  const monthly1099Income = (budgetItems ?? [])
    .filter((bi) => bi.active && bi.is_income && bi.income_type === '1099')
    .reduce((sum, bi) => sum + Number(bi.monthly_amount), 0)
  const quarterlyTaxAmount = Math.round(monthly1099Income * 3 * taxRate) // 3 months of income × rate
  const quarterlyTaxMonths = [4, 6, 9, 1] // Apr, Jun, Sep, Jan

  // CC accounts for the payment row
  const ccAccounts: Account[] = grouped.credit ?? []
  const ccBalance = ccPayTotal

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)
  const [rowMenu, setRowMenu] = useState<RowMenuState | null>(null)
  const [addEntryOpen, setAddEntryOpen] = useState(false)
  const [taxRateMenu, setTaxRateMenu] = useState<{ x: number; y: number } | null>(null)
  const [renameRowState, setRenameRowState] = useState<RowActionState | null>(null)
  const [deleteRowState, setDeleteRowState] = useState<RowActionState | null>(null)
  const [editCategoryState, setEditCategoryState] = useState<RowCategoryState | null>(null)
  const [categoryMenu, setCategoryMenu] = useState<CategoryMenuState | null>(null)
  const [visibleCategorySubtotals, setVisibleCategorySubtotals] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {}

    try {
      const raw = window.localStorage.getItem('cashflow-category-subtotals')
      return raw ? JSON.parse(raw) as Record<string, boolean> : {}
    } catch {
      return {}
    }
  })

  const togglePaid = useTogglePaid()
  const updateEntry = useUpdateCashflowEntry()
  const updateAccount = useUpdateAccount()
  const updateHousehold = useUpdateHousehold()
  const deleteEntry = useDeleteCashflowEntry()
  const createBudgetItem = useCreateBudgetItem()
  const updateBudgetItem = useUpdateBudgetItem()

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('cashflow-category-subtotals', JSON.stringify(visibleCategorySubtotals))
  }, [visibleCategorySubtotals])

  function openContextMenu(e: React.MouseEvent, entry: CashflowEntry, isCcPaid: boolean, isVariable: boolean, rowContext: RowContext) {
    e.preventDefault()
    const isW2 = !!(rowContext.budgetItemId && w2Set.has(rowContext.budgetItemId))
    setCtxMenu({ x: e.clientX, y: e.clientY, entry, isCcPaid, isVariable, isW2, rowContext })
  }

  function openRowContextMenu(e: React.MouseEvent, row: YearRow) {
    e.preventDefault()
    const isCcPaid = !!(row.budgetItemId && ccPaidSet.has(row.budgetItemId))
    const isVariable = !!(row.budgetItemId && variableSet.has(row.budgetItemId))
    setRowMenu({ x: e.clientX, y: e.clientY, row, isCcPaid, isVariable })
  }

  function openCategoryContextMenu(e: React.MouseEvent, category: string) {
    e.preventDefault()
    setCategoryMenu({
      x: e.clientX,
      y: e.clientY,
      category,
      showSubtotal: !!visibleCategorySubtotals[category],
    })
  }

  function handleCtxAction(action: string) {
    if (!ctxMenu) return
    const { entry, isCcPaid, rowContext } = ctxMenu

    switch (action) {
      case 'toggle-paid': {
        const isW2 = rowContext.budgetItemId && w2Set.has(rowContext.budgetItemId)

        if (isW2) {
          // W2 bi-monthly: unpaid → half-paid → fully paid → unpaid
          const projected = Number(entry.projected_amount)
          const actual = entry.actual_amount != null ? Number(entry.actual_amount) : null
          const halfAmount = Math.round(projected / 2)
          const isHalfPaid = actual != null && Math.abs(actual - halfAmount) < 1 && !entry.is_paid

          if (entry.is_paid) {
            // Fully paid → unpaid: reset
            togglePaid.mutate({ id: entry.id, is_paid: false })
            updateEntry.mutate({ id: entry.id, actual_amount: null })
          } else if (isHalfPaid) {
            // Half-paid → fully paid
            togglePaid.mutate({ id: entry.id, is_paid: true })
            updateEntry.mutate({ id: entry.id, actual_amount: projected })
          } else {
            // Unpaid → half-paid: set actual to half, don't mark paid
            updateEntry.mutate({ id: entry.id, actual_amount: halfAmount })
          }
        } else {
          const markingPaid = !entry.is_paid
          togglePaid.mutate({ id: entry.id, is_paid: markingPaid })
          // CC balance auto-increment
          if (isCcPaid && ccAccounts.length > 0) {
            const ccAccount = ccAccounts[0]
            const entryAmount = Number(entry.actual_amount ?? entry.projected_amount)
            const delta = markingPaid ? entryAmount : -entryAmount
            updateAccount.mutate(
              { id: ccAccount.id, balance: Number(ccAccount.balance) + delta },
              { onError: () => toast.error('Failed to update CC balance') }
            )
          }
        }
        break
      }
      case 'make-recurring': {
        // Create a budget item from this ad-hoc entry
        createBudgetItem.mutate(
          {
            name: entry.name ?? 'Unnamed',
            category: (entry.category ?? 'misc') as ItemCategory,
            monthly_amount: Number(entry.actual_amount ?? entry.projected_amount),
            frequency: 'monthly',
          },
          {
            onSuccess: () => toast.success('Budget item created'),
            onError: () => toast.error('Failed to create budget item'),
          }
        )
        break
      }
      case 'delete': {
        deleteEntry.mutate(entry.id, {
          onError: () => toast.error('Failed to delete entry'),
        })
        break
      }
      case 'clear-cell': {
        if (entry.budget_item_id) {
          updateEntry.mutate(
            { id: entry.id, actual_amount: null },
            { onError: () => toast.error('Failed to clear cell') }
          )
        } else {
          deleteEntry.mutate(entry.id, {
            onError: () => toast.error('Failed to clear cell'),
          })
        }
        break
      }
      case 'toggle-cc': {
        if (!rowContext.budgetItemId) {
          toast.error('Only budget items can be toggled')
          break
        }
        const nowCc = isCcPaid
        updateBudgetItem.mutate(
          { id: rowContext.budgetItemId, cc_paid: !nowCc },
          {
            onSuccess: () => toast.success(nowCc ? 'Removed CC flag' : 'Marked as CC paid'),
            onError: () => toast.error('Failed to update'),
          }
        )
        break
      }
      case 'toggle-variable': {
        if (!rowContext.budgetItemId) {
          toast.error('Only budget items can be toggled')
          break
        }
        const nowVar = ctxMenu.isVariable
        updateBudgetItem.mutate(
          { id: rowContext.budgetItemId, is_variable: !nowVar },
          {
            onSuccess: () => toast.success(nowVar ? 'Removed variable flag' : 'Marked as variable'),
            onError: () => toast.error('Failed to update'),
          }
        )
        break
      }
    }
    setCtxMenu(null)
  }

  function handleRowAction(action: string) {
    if (!rowMenu) return

    switch (action) {
      case 'rename':
        setRenameRowState({ row: rowMenu.row, name: rowMenu.row.name })
        break
      case 'delete':
        setDeleteRowState({ row: rowMenu.row, name: rowMenu.row.name })
        break
      case 'change-category':
        setEditCategoryState({
          row: rowMenu.row,
          category: rowMenu.row.category as Exclude<ItemCategory, 'income'>,
        })
        break
      case 'toggle-cc':
        if (!rowMenu.row.budgetItemId) {
          toast.error('Only budget items can be toggled')
          break
        }
        updateBudgetItem.mutate(
          { id: rowMenu.row.budgetItemId, cc_paid: !rowMenu.isCcPaid },
          {
            onSuccess: () => toast.success(rowMenu.isCcPaid ? 'Removed CC flag' : 'Marked as CC paid'),
            onError: () => toast.error('Failed to update'),
          }
        )
        break
      case 'toggle-variable':
        if (!rowMenu.row.budgetItemId) {
          toast.error('Only budget items can be toggled')
          break
        }
        updateBudgetItem.mutate(
          { id: rowMenu.row.budgetItemId, is_variable: !rowMenu.isVariable },
          {
            onSuccess: () => toast.success(rowMenu.isVariable ? 'Removed variable flag' : 'Marked as variable'),
            onError: () => toast.error('Failed to update'),
          }
        )
        break
    }

    setRowMenu(null)
  }

  async function handleRenameRow(name: string) {
    if (!renameRowState) return

    const nextName = name.trim()
    if (!nextName) return

    const row = renameRowState.row
    try {
      if (row.budgetItemId) {
        const { error: itemError } = await supabase
          .from('budget_items')
          .update({ name: nextName })
          .eq('id', row.budgetItemId)

        if (itemError) throw itemError

        const { error: entriesError } = await supabase
          .from('cashflow_entries')
          .update({ name: nextName })
          .eq('budget_item_id', row.budgetItemId)

        if (entriesError) throw entriesError
      } else {
        const entryIds = row.entries.filter((entry): entry is CashflowEntry => entry != null).map((entry) => entry.id)
        if (entryIds.length === 0) return

        const { error } = await supabase
          .from('cashflow_entries')
          .update({ name: nextName })
          .in('id', entryIds)

        if (error) throw error
      }

      toast.success('Row renamed')
      queryClient.invalidateQueries({ queryKey: ['budget_items'] })
      queryClient.invalidateQueries({ queryKey: ['cashflow_entries'] })
      setRenameRowState(null)
    } catch {
      toast.error('Failed to rename row')
    }
  }

  async function handleDeleteRow() {
    if (!deleteRowState) return

    const row = deleteRowState.row
    try {
      if (row.budgetItemId) {
        const { error: entriesError } = await supabase
          .from('cashflow_entries')
          .delete()
          .eq('budget_item_id', row.budgetItemId)

        if (entriesError) throw entriesError

        const { error: itemError } = await supabase
          .from('budget_items')
          .delete()
          .eq('id', row.budgetItemId)

        if (itemError) throw itemError
      } else {
        const entryIds = row.entries.filter((entry): entry is CashflowEntry => entry != null).map((entry) => entry.id)
        if (entryIds.length === 0) return

        const { error } = await supabase
          .from('cashflow_entries')
          .delete()
          .in('id', entryIds)

        if (error) throw error
      }

      toast.success('Row deleted')
      queryClient.invalidateQueries({ queryKey: ['budget_items'] })
      queryClient.invalidateQueries({ queryKey: ['cashflow_entries'] })
      setDeleteRowState(null)
    } catch {
      toast.error('Failed to delete row')
    }
  }

  async function handleUpdateRowCategory(category: Exclude<ItemCategory, 'income'>) {
    if (!editCategoryState) return

    const row = editCategoryState.row
    try {
      if (row.budgetItemId) {
        const { error: itemError } = await supabase
          .from('budget_items')
          .update({ category, is_income: false })
          .eq('id', row.budgetItemId)

        if (itemError) throw itemError

        const { error: entriesError } = await supabase
          .from('cashflow_entries')
          .update({ category })
          .eq('budget_item_id', row.budgetItemId)

        if (entriesError) throw entriesError
      } else {
        const entryIds = row.entries.filter((entry): entry is CashflowEntry => entry != null).map((entry) => entry.id)
        if (entryIds.length === 0) return

        const { error } = await supabase
          .from('cashflow_entries')
          .update({ category })
          .in('id', entryIds)

        if (error) throw error
      }

      toast.success('Category updated')
      queryClient.invalidateQueries({ queryKey: ['budget_items'] })
      queryClient.invalidateQueries({ queryKey: ['cashflow_entries'] })
      setEditCategoryState(null)
    } catch {
      toast.error('Failed to update category')
    }
  }

  function handleCategoryMenuAction(action: string) {
    if (!categoryMenu) return

    if (action === 'toggle-subtotal') {
      setVisibleCategorySubtotals((prev) => ({
        ...prev,
        [categoryMenu.category]: !prev[categoryMenu.category],
      }))
    }

    setCategoryMenu(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded" />
        ))}
      </div>
    )
  }

  if (!entries || entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No entries for {year}. Go to Budget and generate entries for this year.
      </p>
    )
  }

  const { expenseRows, incomeRows, expensesByCategory } = buildRows(entries)

  const today = new Date()
  const currentMonth = today.getMonth() // 0-indexed
  const isCurrentYear = year === today.getFullYear()
  const monthStatuses = monthHeaders.map((_, i) => getMonthStatus(year, i, today))
  const firstOpenMonthIndex = monthStatuses.findIndex((status) => status !== 'past')

  // Quarterly tax amounts per month (0-indexed)
  const quarterlyTaxByMonth = monthHeaders.map((_, i) =>
    quarterlyTaxAmount > 0 && quarterlyTaxMonths.includes(i + 1) ? quarterlyTaxAmount : 0
  )
  const totalQuarterlyTax = quarterlyTaxByMonth.reduce((a, b) => a + b, 0)

  // Month totals — paid fixed items are excluded
  const expenseMonthTotals = monthHeaders.map((_, i) => sumMonth(expenseRows, i, variableSet) + quarterlyTaxByMonth[i])
  const incomeMonthTotals = monthHeaders.map((_, i) => sumMonth(incomeRows, i))
  const savingsMonthTotals = monthHeaders.map((_, i) => incomeMonthTotals[i] - expenseMonthTotals[i])

  const totalExpensesYear = expenseMonthTotals.reduce((a, b) => a + b, 0)
  const totalIncomeYear = incomeMonthTotals.reduce((a, b) => a + b, 0)
  const openExpenseTotal = expenseMonthTotals.reduce((sum, total, i) => (
    monthStatuses[i] === 'past' ? sum : sum + total
  ), 0)
  const openIncomeTotal = incomeMonthTotals.reduce((sum, total, i) => (
    monthStatuses[i] === 'past' ? sum : sum + total
  ), 0)

  // Cumulative savings starts at the first open month. Past months stay historical only.
  const cumulativeSavings = savingsMonthTotals.reduce<Array<number | null>>((acc, val, i) => {
    if (monthStatuses[i] === 'past') {
      acc.push(null)
      return acc
    }

    const previous = acc.length === 0 ? 0 : (acc[acc.length - 1] ?? 0)
    acc.push(previous + val)
    return acc
  }, [])

  const orderedExpenseCategories = expenseCategoryOrder.filter((cat) => expensesByCategory[cat]?.length > 0)

  // For the top summary bar: current cash position + projected year-end
  const currentCash = netCash
  const yearEndSavings = [...cumulativeSavings].reverse().find((value) => value != null) ?? null
  const yearEndProjected = yearEndSavings == null ? null : currentCash + yearEndSavings
  const currentMonthNet =
    firstOpenMonthIndex === -1
      ? null
      : savingsMonthTotals[firstOpenMonthIndex]

  return (
    <div className="space-y-4">
      {/* Top summary bar */}
      <div className="flex gap-6 text-sm flex-wrap">
        <div>
          <span className="text-muted-foreground">Cash </span>
          <span className="font-mono tabular-nums font-medium">{fmtFull(totals.cash)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">CC Debt </span>
          <span className="font-mono tabular-nums font-medium text-destructive">{fmtFull(totals.credit)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Net Cash </span>
          <span className={`font-mono tabular-nums font-medium ${currentCash >= 0 ? '' : 'text-destructive'}`}>{fmtFull(currentCash)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Open Month Net </span>
          <span className={`font-mono tabular-nums font-medium ${
            currentMonthNet == null ? 'text-muted-foreground' : currentMonthNet >= 0 ? 'text-success' : 'text-destructive'
          }`}>
            {currentMonthNet == null ? '—' : fmtFull(currentMonthNet)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Year-End Projected </span>
          <span className={`font-mono tabular-nums font-medium ${
            yearEndProjected == null ? 'text-muted-foreground' : yearEndProjected >= 0 ? 'text-success' : 'text-destructive'
          }`}>
            {yearEndProjected == null ? '—' : fmtFull(yearEndProjected)}
          </span>
        </div>
      </div>

    <div className="overflow-x-auto -mx-4 px-4 space-y-6">

      {/* ===== EXPENSES PANEL ===== */}
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-base font-semibold tracking-tight">Expenses</h2>
        </div>
        <div className="px-4 pb-4">
          <table className="w-full text-xs border-collapse min-w-[860px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-2 font-medium text-muted-foreground uppercase tracking-wider w-[72px] sticky left-0 bg-card z-20" />
                <th className="text-left py-2 pr-2 font-medium text-muted-foreground uppercase tracking-wider w-[146px] sticky left-[72px] bg-card z-10" />
                {monthHeaders.map((m, i) => (
                  <th
                    key={m}
                    className={`text-right py-2 px-1.5 font-medium uppercase tracking-wider min-w-[70px] ${
                      monthStatuses[i] === 'current'
                        ? 'text-accent'
                        : 'text-muted-foreground'
                    } ${getMonthGridClass(monthStatuses[i], i)}`}
                  >
                    {m}
                  </th>
                ))}
                <th className="text-right py-2 pl-2 font-semibold text-muted-foreground uppercase tracking-wider min-w-[80px] border-l border-border">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {orderedExpenseCategories.map((cat) => {
                const rows = expensesByCategory[cat]
                const catMonthTotals = monthHeaders.map((_, i) => sumMonth(rows, i, variableSet))
                const catYearTotal = catMonthTotals.reduce((a, b) => a + b, 0)

                return (
                  <CategorySection
                    key={cat}
                    category={cat}
                    rows={rows}
                    catMonthTotals={catMonthTotals}
                    catYearTotal={catYearTotal}
                    monthStatuses={monthStatuses}
                    currentYear={year}
                    ccPaidSet={ccPaidSet}
                    variableSet={variableSet}
                    onContextMenu={openContextMenu}
                    onRowContextMenu={openRowContextMenu}
                    onCategoryContextMenu={openCategoryContextMenu}
                    showSubtotal={!!visibleCategorySubtotals[cat]}
                    bgClass="bg-card"
                  />
                )
              })}

              {/* CC PAYMENT ROW */}
              {ccAccounts.length > 0 && (
                  <tr className="group border-t border-border/40 hover:bg-secondary/25 transition-colors">
                    <td className="w-[72px] min-w-[72px] align-top py-1 pr-2 text-[8px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70 sticky left-0 bg-card group-hover:bg-secondary/25 z-20">
                      Credit Card
                    </td>
                    <td className="py-1 pr-2 text-[13px] sticky left-[72px] bg-card group-hover:bg-secondary/25 z-10 transition-colors">
                      CC Payment
                    </td>
                    {monthHeaders.map((_, i) => {
                      const status = monthStatuses[i]
                      const isCurrent = status === 'current'
                      const isNext = isCurrentYear && i === currentMonth + 1
                      let cellValue = 0
                      if (isCurrent) cellValue = ccBalance
                      else if (isNext && ccRollover > 0) cellValue = ccRollover
                      return (
                        <td
                          key={i}
                          className={`text-right py-1 px-1.5 font-mono tabular-nums ${isCurrent ? 'bg-accent/5' : ''} ${
                            cellValue > 0 ? '' : 'text-muted-foreground/50'
                          } ${getMonthGridClass(status, i)}`}
                          title={isNext && ccRollover > 0 ? 'Deferred balance from current month' : undefined}
                        >
                          {cellValue > 0 ? fmt(cellValue) : ''}
                        </td>
                      )
                    })}
                    <td className="text-right py-1 pl-2 font-mono tabular-nums text-xs font-medium border-l border-border">
                      {fmt(ccBalance + (ccRollover > 0 ? ccRollover : 0))}
                    </td>
                  </tr>
              )}

              {/* QUARTERLY TAX ROW (computed from 1099 income × tax rate) */}
              {quarterlyTaxAmount > 0 && (
                  <tr className="group border-t border-border/40 hover:bg-secondary/25 transition-colors">
                    <td className="w-[72px] min-w-[72px] align-top py-1 pr-2 text-[8px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70 sticky left-0 bg-card group-hover:bg-secondary/25 z-20">
                      Est. Tax
                    </td>
                    <td
                      className="py-1 pr-2 text-[13px] sticky left-[72px] bg-card group-hover:bg-secondary/25 z-10 transition-colors cursor-pointer"
                      onContextMenu={(e) => { e.preventDefault(); setTaxRateMenu({ x: e.clientX, y: e.clientY }) }}
                      title="Right-click to change tax rate"
                    >
                      Quarterly Tax
                      <span className="ml-1 text-[9px] text-muted-foreground">{Math.round(taxRate * 100)}%</span>
                    </td>
                    {quarterlyTaxByMonth.map((amount, i) => (
                      <td
                        key={i}
                        className={`text-right py-1 px-1.5 font-mono tabular-nums ${
                          monthStatuses[i] === 'current' ? 'bg-accent/5' : ''
                        } ${amount > 0 ? '' : 'text-muted-foreground/50'} ${getMonthGridClass(monthStatuses[i], i)}`}
                        title={amount > 0 ? `${fmtFull(monthly1099Income)}/mo × 3 × ${Math.round(taxRate * 100)}%` : undefined}
                      >
                        {amount > 0 ? fmt(-amount) : ''}
                      </td>
                    ))}
                    <td className="text-right py-1 pl-2 font-mono tabular-nums text-xs font-medium border-l border-border">
                      {fmt(-totalQuarterlyTax)}
                    </td>
                  </tr>
              )}

              {/* TOTAL EXPENSES (including CC + quarterly tax) */}
              <tr className="border-t-2 border-foreground/20 font-semibold">
                <td className="sticky left-0 bg-card z-20" />
                <td className="py-2 pr-2 sticky left-[72px] bg-card z-10 text-xs uppercase tracking-wider">
                  Total Expenses
                </td>
                {expenseMonthTotals.map((total, i) => {
                  const status = monthStatuses[i]
                  const isCurrent = status === 'current'
                  const isNext = isCurrentYear && i === currentMonth + 1
                  let ccForMonth = 0
                  if (isCurrent) ccForMonth = ccBalance
                  else if (isNext && ccRollover > 0) ccForMonth = ccRollover
                  return (
                    <td key={i} className={`text-right py-2 px-1.5 font-mono tabular-nums text-destructive ${getMonthGridClass(status, i)}`}>
                      {fmt(total + ccForMonth)}
                    </td>
                  )
                })}
                <td className="text-right py-2 pl-2 font-mono tabular-nums text-destructive border-l border-border">
                  {fmtFull(totalExpensesYear + ccBalance + (ccRollover > 0 ? ccRollover : 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== INCOME PANEL ===== */}
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-base font-semibold tracking-tight">Income</h2>
        </div>
        <div className="px-4 pb-4">
          <table className="w-full text-xs border-collapse min-w-[860px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-2 font-medium text-muted-foreground uppercase tracking-wider w-[72px] sticky left-0 bg-card z-20" />
                <th className="text-left py-2 pr-2 font-medium text-muted-foreground uppercase tracking-wider w-[146px] sticky left-[72px] bg-card z-10" />
                {monthHeaders.map((m, i) => (
                  <th
                    key={m}
                    className={`text-right py-2 px-1.5 font-medium uppercase tracking-wider min-w-[70px] ${
                      monthStatuses[i] === 'current'
                        ? 'text-accent'
                        : 'text-muted-foreground'
                    } ${getMonthGridClass(monthStatuses[i], i)}`}
                  >
                    {m}
                  </th>
                ))}
                <th className="text-right py-2 pl-2 font-semibold text-muted-foreground uppercase tracking-wider min-w-[80px] border-l border-border">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {incomeRows.map((row) => (
                <EntryRow
                  key={row.key}
                  row={row}
                  year={year}
                  monthStatuses={monthStatuses}
                  ccPaidSet={ccPaidSet}
                  variableSet={variableSet}
                  w2Set={w2Set}
                  onContextMenu={openContextMenu}
                  onRowContextMenu={openRowContextMenu}
                  bgClass="bg-card"
                  categoryCell={<td className="w-[72px] min-w-[72px] sticky left-0 bg-card group-hover:bg-secondary/25 z-20" />}
                />
              ))}

              {/* TOTAL INCOME */}
              <tr className="border-t-2 border-foreground/20 font-semibold">
                <td className="sticky left-0 bg-card z-20" />
                <td className="py-2 pr-2 sticky left-[72px] bg-card z-10 text-xs uppercase tracking-wider">
                  Total Income
                </td>
                {incomeMonthTotals.map((total, i) => (
                  <td key={i} className={`text-right py-2 px-1.5 font-mono tabular-nums text-success ${getMonthGridClass(monthStatuses[i], i)}`}>
                    {fmt(total)}
                  </td>
                ))}
                <td className="text-right py-2 pl-2 font-mono tabular-nums text-success border-l border-border">
                  {fmtFull(totalIncomeYear)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== SAVINGS PANEL ===== */}
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-base font-semibold tracking-tight">Savings</h2>
        </div>
        <div className="px-4 pb-4">
          <table className="w-full text-xs border-collapse min-w-[860px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-2 font-medium text-muted-foreground uppercase tracking-wider w-[72px] sticky left-0 bg-card z-20" />
                <th className="text-left py-2 pr-2 font-medium text-muted-foreground uppercase tracking-wider w-[146px] sticky left-[72px] bg-card z-10" />
                {monthHeaders.map((m, i) => (
                  <th
                    key={m}
                    className={`text-right py-2 px-1.5 font-medium uppercase tracking-wider min-w-[70px] ${
                      monthStatuses[i] === 'current'
                        ? 'text-accent'
                        : 'text-muted-foreground'
                    } ${getMonthGridClass(monthStatuses[i], i)}`}
                  >
                    {m}
                  </th>
                ))}
                <th className="text-right py-2 pl-2 font-semibold text-muted-foreground uppercase tracking-wider min-w-[80px] border-l border-border">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-semibold">
                <td className="sticky left-0 bg-card z-20" />
                <td className="py-2 pr-2 sticky left-[72px] bg-card z-10 text-xs uppercase tracking-wider">
                  Saved / Spent
                </td>
                {savingsMonthTotals.map((total, i) => (
                  <td
                    key={i}
                    className={`text-right py-2 px-1.5 font-mono tabular-nums ${
                      total >= 0 ? 'text-success' : 'text-destructive'
                    } ${getMonthGridClass(monthStatuses[i], i)}`}
                  >
                    {fmt(total)}
                  </td>
                ))}
                <td
                  className={`text-right py-2 pl-2 font-mono tabular-nums border-l border-border ${
                    openIncomeTotal - openExpenseTotal >= 0 ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {fmtFull(openIncomeTotal - openExpenseTotal)}
                </td>
              </tr>

              {/* Cumulative savings */}
              <tr className="font-semibold">
                <td className="sticky left-0 bg-card z-20" />
                <td className="py-2 pr-2 sticky left-[72px] bg-card z-10 text-xs uppercase tracking-wider">
                  Cumulative Savings
                </td>
                {cumulativeSavings.map((total, i) => (
                  <td
                    key={i}
                    className={`text-right py-2 px-1.5 font-mono tabular-nums ${
                      total == null ? 'text-muted-foreground' : total >= 0 ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {total == null ? '—' : fmtFull(total)}
                  </td>
                ))}
                <td
                  className={`text-right py-2 pl-2 font-mono tabular-nums border-l border-border ${
                    yearEndSavings == null ? 'text-muted-foreground' : yearEndSavings >= 0 ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {yearEndSavings == null ? '—' : fmtFull(yearEndSavings)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    {/* Add Entry button */}
    <div className="flex justify-end">
      <button
        onClick={() => setAddEntryOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border hover:bg-secondary"
      >
        + Add Entry
      </button>
    </div>

    {/* Add Entry Dialog */}
    {addEntryOpen && (
      <AddEntryDialog
        year={year}
        onClose={() => setAddEntryOpen(false)}
      />
    )}

    {/* Context Menu Overlay */}
    {ctxMenu && (
      <CellContextMenu
        state={ctxMenu}
        onAction={handleCtxAction}
        onClose={() => setCtxMenu(null)}
      />
    )}

    {rowMenu && (
      <RowContextMenu
        state={rowMenu}
        onAction={handleRowAction}
        onClose={() => setRowMenu(null)}
      />
    )}

    {categoryMenu && (
      <CategoryContextMenu
        state={categoryMenu}
        onAction={handleCategoryMenuAction}
        onClose={() => setCategoryMenu(null)}
      />
    )}

    {/* Tax Rate Context Menu */}
    {taxRateMenu && (
      <TaxRateMenu
        position={taxRateMenu}
        currentRate={taxRate}
        onSave={(rate) => {
          updateHousehold.mutate(
            { estimated_tax_rate: rate },
            {
              onSuccess: () => toast.success(`Tax rate updated to ${Math.round(rate * 100)}%`),
              onError: () => toast.error('Failed to update tax rate'),
            }
          )
          setTaxRateMenu(null)
        }}
        onClose={() => setTaxRateMenu(null)}
      />
    )}

    {renameRowState && (
      <RenameRowDialog
        key={renameRowState.row.key}
        state={renameRowState}
        onSave={handleRenameRow}
        onOpenChange={(open) => {
          if (!open) setRenameRowState(null)
        }}
      />
    )}

    <DeleteRowDialog
      state={deleteRowState}
      onConfirm={handleDeleteRow}
      onOpenChange={(open) => {
        if (!open) setDeleteRowState(null)
      }}
    />

    {editCategoryState && (
      <UpdateCategoryDialog
        key={editCategoryState.row.key}
        state={editCategoryState}
        onSave={handleUpdateRowCategory}
        onOpenChange={(open) => {
          if (!open) setEditCategoryState(null)
        }}
      />
    )}
    </div>
  )
}

function CategorySection({
  category,
  rows,
  catMonthTotals,
  catYearTotal,
  monthStatuses,
  currentYear,
  ccPaidSet,
  variableSet,
  w2Set,
  onContextMenu,
  onRowContextMenu,
  onCategoryContextMenu,
  showSubtotal,
  bgClass = 'bg-background',
}: {
  category: string
  rows: YearRow[]
  catMonthTotals: number[]
  catYearTotal: number
  monthStatuses: MonthStatus[]
  currentYear: number
  ccPaidSet: Set<string>
  variableSet: Set<string>
  w2Set?: Set<string>
  onContextMenu: (e: React.MouseEvent, entry: CashflowEntry, isCcPaid: boolean, isVariable: boolean, rowContext: RowContext) => void
  onRowContextMenu: (e: React.MouseEvent, row: YearRow) => void
  onCategoryContextMenu: (e: React.MouseEvent, category: string) => void
  showSubtotal: boolean
  bgClass?: string
}) {
  const showCategorySubtotal = showSubtotal && rows.length > 1
  const categoryRowSpan = rows.length + (showCategorySubtotal ? 1 : 0)

  return (
    <>
      {rows.map((row, index) => (
        <EntryRow
          key={row.key}
          row={row}
          year={currentYear}
          monthStatuses={monthStatuses}
          ccPaidSet={ccPaidSet}
          variableSet={variableSet}
          w2Set={w2Set}
          onContextMenu={onContextMenu}
          onRowContextMenu={onRowContextMenu}
          bgClass={bgClass}
          isCategoryStart={index === 0}
          categoryCell={index === 0 ? (
            <td
              rowSpan={categoryRowSpan}
              className={`w-[72px] min-w-[72px] align-top py-1 pr-2 text-[8px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70 sticky left-0 ${bgClass} z-20 cursor-context-menu`}
              onContextMenu={(e) => onCategoryContextMenu(e, category)}
              title="Right-click for category options"
            >
              {categoryLabels[category] ?? category}
            </td>
          ) : null}
        />
      ))}

      {/* Category subtotal */}
      {showCategorySubtotal && (
        <tr className="border-t border-border/20">
          <td className={`py-1 pr-2 text-right text-[10px] text-muted-foreground italic sticky left-[72px] ${bgClass} z-10`}>
            {categoryLabels[category]} total
          </td>
          {catMonthTotals.map((total, i) => (
            <td key={i} className={`text-right py-1 px-1.5 font-mono tabular-nums text-[10px] text-muted-foreground ${getMonthGridClass(monthStatuses[i], i)}`}>
              {fmt(total)}
            </td>
          ))}
          <td className="text-right py-1 pl-2 font-mono tabular-nums text-[10px] text-muted-foreground border-l border-border">
            {fmtFull(catYearTotal)}
          </td>
        </tr>
      )}
    </>
  )
}

function EntryRow({ row, year, monthStatuses, ccPaidSet, variableSet, w2Set, onContextMenu, onRowContextMenu, bgClass = 'bg-background', categoryCell = null, isCategoryStart = false }: { row: YearRow; year: number; monthStatuses: MonthStatus[]; ccPaidSet: Set<string>; variableSet: Set<string>; w2Set?: Set<string>; onContextMenu: (e: React.MouseEvent, entry: CashflowEntry, isCcPaid: boolean, isVariable: boolean, rowContext: RowContext) => void; onRowContextMenu: (e: React.MouseEvent, row: YearRow) => void; bgClass?: string; categoryCell?: React.ReactNode; isCategoryStart?: boolean }) {
  const yearTotal = sumRowTotal(row)
  const isExpense = row.category !== 'income'
  const isCcPaid = !!(row.budgetItemId && ccPaidSet.has(row.budgetItemId))
  const isVariable = !!(row.budgetItemId && variableSet.has(row.budgetItemId))
  const isW2 = !!(row.budgetItemId && w2Set?.has(row.budgetItemId))
  const nameLeftClass = categoryCell ? 'left-[72px]' : 'left-0'

  return (
    <tr className={`group hover:bg-secondary/25 transition-colors ${isCategoryStart ? 'border-t border-border/40' : ''}`}>
      {categoryCell}
      <td
        className={`py-1 pr-2 text-[13px] truncate max-w-[146px] sticky ${nameLeftClass} ${bgClass} group-hover:bg-secondary/25 z-10 transition-colors cursor-context-menu`}
        onContextMenu={(e) => onRowContextMenu(e, row)}
        title="Right-click for row options"
      >
        {row.name}
        {isCcPaid && <span className="ml-1 text-[9px] text-muted-foreground">CC</span>}
        {isW2 && <span className="ml-1 text-[9px] text-muted-foreground">W2</span>}
      </td>
      {row.entries.map((entry, i) => (
        <YearCell
          key={i}
          entry={entry}
          monthStatus={monthStatuses[i]}
          isExpense={isExpense}
          isCcPaid={isCcPaid}
          isVariable={isVariable}
          isW2={isW2}
          rowContext={{ budgetItemId: row.budgetItemId, name: row.name, category: row.category as ItemCategory, year, monthIndex: i }}
          onContextMenu={onContextMenu}
        />
      ))}
      <td
        className={`text-right py-1 pl-2 font-mono tabular-nums text-xs font-medium border-l border-border ${
          isExpense ? '' : 'text-success'
        }`}
      >
        {fmt(yearTotal)}
      </td>
    </tr>
  )
}

interface RowContext {
  budgetItemId: string | null
  name: string
  category: ItemCategory
  year: number
  monthIndex: number
}

interface ContextMenuState {
  x: number
  y: number
  entry: CashflowEntry
  isCcPaid: boolean
  isVariable: boolean
  isW2: boolean
  rowContext: RowContext
}

interface RowMenuState {
  x: number
  y: number
  row: YearRow
  isCcPaid: boolean
  isVariable: boolean
}

interface RowActionState {
  row: YearRow
  name: string
}

interface RowCategoryState {
  row: YearRow
  category: Exclude<ItemCategory, 'income'>
}

interface CategoryMenuState {
  x: number
  y: number
  category: string
  showSubtotal: boolean
}

function YearCell({
  entry,
  monthStatus,
  isExpense,
  isCcPaid,
  isVariable,
  isW2,
  rowContext,
  onContextMenu,
}: {
  entry: CashflowEntry | null
  monthStatus: MonthStatus
  isExpense: boolean
  isCcPaid: boolean
  isVariable: boolean
  isW2?: boolean
  rowContext: RowContext
  onContextMenu: (e: React.MouseEvent, entry: CashflowEntry, isCcPaid: boolean, isVariable: boolean, rowContext: RowContext) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const updateEntry = useUpdateCashflowEntry()
  const createEntry = useCreateCashflowEntry()
  const deleteEntry = useDeleteCashflowEntry()
  const isCurrentMonth = monthStatus === 'current'
  const isPastMonth = monthStatus === 'past'

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const projected = entry ? Number(entry.projected_amount) : 0
  const spent = entry?.actual_amount != null ? Number(entry.actual_amount) : null
  const amount = entry ? Number(entry.actual_amount ?? entry.projected_amount) : 0

  // For variable items: display the remaining budget
  const remaining = isVariable && spent != null ? projected - spent : null

  // W2 half-pay detection: actual_amount ≈ projected/2 and not yet fully paid
  const isHalfPaid = isW2 && entry && !entry.is_paid && spent != null && Math.abs(spent - Math.round(projected / 2)) < 1

  const displayAmount = remaining != null ? remaining : (isHalfPaid ? spent! : amount)

  function handleClick() {
    if (entry) {
      if (isVariable) {
        // Variable expense cells edit "spent so far", not the full budget.
        setEditValue(spent != null ? String(spent) : '')
      } else {
        setEditValue(String(Math.abs(Number(entry.actual_amount ?? entry.projected_amount))))
      }
    } else {
      setEditValue('')
    }
    setEditing(true)
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    if (!entry) return
    onContextMenu(e, entry, isCcPaid, isVariable, rowContext)
  }

  function handleSave() {
    setEditing(false)
    const rawValue = editValue.trim()

    if (rawValue === '') {
      if (entry) {
        if (entry.budget_item_id) {
          updateEntry.mutate(
            { id: entry.id, actual_amount: null },
            { onError: () => toast.error('Failed to clear cell') }
          )
        } else {
          deleteEntry.mutate(entry.id, {
            onError: () => toast.error('Failed to clear cell'),
          })
        }
      }
      return
    }

    const parsed = parseFloat(rawValue)
    if (isNaN(parsed)) return
    if (parsed === 0) {
      if (entry) {
        if (entry.budget_item_id) {
          updateEntry.mutate(
            { id: entry.id, actual_amount: null },
            { onError: () => toast.error('Failed to clear cell') }
          )
        } else {
          deleteEntry.mutate(entry.id, {
            onError: () => toast.error('Failed to clear cell'),
          })
        }
      }
      return
    }

    const normalizedAmount = isExpense ? Math.abs(parsed) : parsed

    if (entry) {
      updateEntry.mutate(
        { id: entry.id, actual_amount: normalizedAmount },
        { onError: () => toast.error('Failed to update') }
      )
    } else {
      createEntry.mutate(
        {
          year: rowContext.year,
          month: rowContext.monthIndex + 1,
          projected_amount: isExpense ? Math.abs(parsed) : parsed,
          budget_item_id: rowContext.budgetItemId,
          name: rowContext.name,
          category: rowContext.category,
        },
        { onError: () => toast.error('Failed to create entry') }
      )
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <td className={`py-0 px-0.5 relative ${isCurrentMonth ? 'bg-accent/5' : ''} ${getMonthGridClass(monthStatus, rowContext.monthIndex)}`}>
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder={isVariable ? 'Spent' : ''}
          className="absolute inset-0 text-right font-mono text-xs bg-background border border-accent rounded px-1 outline-none z-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {/* Invisible spacer to preserve column width */}
        <span className="invisible font-mono text-xs px-1">{displayAmount ? fmt(displayAmount) : '$0'}</span>
      </td>
    )
  }

  if (!entry) {
    return (
      <td
        className={`text-right py-1 px-1.5 cursor-pointer hover:bg-secondary/25 transition-colors ${isCurrentMonth ? 'bg-accent/5' : ''} ${getMonthGridClass(monthStatus, rowContext.monthIndex)}`}
        onClick={handleClick}
        title={isVariable ? 'Click to enter spending' : 'Click to add amount'}
      />
    )
  }

  // Variable items: show remaining with spent info in title
  const variableTitle = isVariable && spent != null
    ? `${fmt(spent)} spent of ${fmt(projected)} budget — ${fmt(Math.max(0, projected - spent))} remaining`
    : undefined

  // W2 half-paid title
  const w2Title = isHalfPaid
    ? `½ received (${fmt(spent!)} of ${fmt(projected)}) — right-click to complete`
    : undefined

  return (
    <td
      className={`text-right py-1 px-1.5 font-mono tabular-nums cursor-pointer transition-colors ${
        isCurrentMonth ? 'bg-accent/5' : ''
      } ${entry.is_paid ? 'opacity-40 line-through' : ''} ${
        isHalfPaid ? 'opacity-60' : ''
      } ${
        isExpense ? '' : 'text-success'
      } ${isVariable && remaining != null && remaining < 0 ? 'text-warning' : ''} ${getMonthGridClass(monthStatus, rowContext.monthIndex)} ${isPastMonth ? 'opacity-45' : ''}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={w2Title ?? variableTitle ?? 'Click to edit, right-click for options'}
    >
      {fmt(isExpense ? -displayAmount : displayAmount)}
    </td>
  )
}

/* ===== Context Menu ===== */

function CellContextMenu({
  state,
  onAction,
  onClose,
}: {
  state: ContextMenuState
  onAction: (action: string) => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Prevent menu from going off-screen
  const style: React.CSSProperties = {
    position: 'fixed',
    left: state.x,
    top: state.y,
    zIndex: 50,
  }

  const { entry, isCcPaid, isVariable, isW2, rowContext } = state
  const hasBudgetItem = !!rowContext.budgetItemId

  // W2 half-pay label
  let paidLabel = entry.is_paid ? 'Mark Unpaid' : 'Mark Paid'
  if (isW2) {
    const projected = Number(entry.projected_amount)
    const actual = entry.actual_amount != null ? Number(entry.actual_amount) : null
    const halfAmount = Math.round(projected / 2)
    const isHalfPaid = actual != null && Math.abs(actual - halfAmount) < 1 && !entry.is_paid
    if (entry.is_paid) {
      paidLabel = 'Mark Unpaid'
    } else if (isHalfPaid) {
      paidLabel = 'Mark Fully Paid'
    } else {
      paidLabel = 'Mark ½ Received'
    }
  }

  return (
    <div ref={menuRef} style={style} className="min-w-[160px] rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95">
      <button
        className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        onClick={() => onAction('toggle-paid')}
      >
        {paidLabel}
      </button>
      {!hasBudgetItem && (
        <button
          className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          onClick={() => onAction('make-recurring')}
        >
          Make Recurring
        </button>
      )}
      {hasBudgetItem && (
        <>
          <button
            className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => onAction('toggle-cc')}
          >
            {isCcPaid ? 'Remove CC Flag' : 'Mark as CC Paid'}
          </button>
          <button
            className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => onAction('toggle-variable')}
          >
            {isVariable ? 'Remove Variable' : 'Mark as Variable'}
          </button>
        </>
      )}
      <button
        className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        onClick={() => onAction('clear-cell')}
      >
        Clear Cell
      </button>
      <div className="my-1 h-px bg-border" />
      <button
        className="flex w-full items-center rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
        onClick={() => onAction('delete')}
      >
        Delete Entry
      </button>
    </div>
  )
}

function RowContextMenu({
  state,
  onAction,
  onClose,
}: {
  state: RowMenuState
  onAction: (action: string) => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const style: React.CSSProperties = {
    position: 'fixed',
    left: state.x,
    top: state.y,
    zIndex: 50,
  }

  const hasBudgetItem = !!state.row.budgetItemId

  return (
    <div ref={menuRef} style={style} className="min-w-[170px] rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95">
      <button
        className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        onClick={() => onAction('rename')}
      >
        Rename Row
      </button>
      {state.row.category !== 'income' && (
        <button
          className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          onClick={() => onAction('change-category')}
        >
          Change Category
        </button>
      )}
      {hasBudgetItem && (
        <>
          <button
            className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => onAction('toggle-cc')}
          >
            {state.isCcPaid ? 'Remove CC Flag' : 'Mark as CC Paid'}
          </button>
          <button
            className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => onAction('toggle-variable')}
          >
            {state.isVariable ? 'Remove Variable' : 'Mark as Variable'}
          </button>
        </>
      )}
      <div className="my-1 h-px bg-border" />
      <button
        className="flex w-full items-center rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
        onClick={() => onAction('delete')}
      >
        Delete Row
      </button>
    </div>
  )
}

function CategoryContextMenu({
  state,
  onAction,
  onClose,
}: {
  state: CategoryMenuState
  onAction: (action: string) => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const style: React.CSSProperties = {
    position: 'fixed',
    left: state.x,
    top: state.y,
    zIndex: 50,
  }

  return (
    <div ref={menuRef} style={style} className="min-w-[170px] rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95">
      <button
        className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        onClick={() => onAction('toggle-subtotal')}
      >
        {state.showSubtotal ? 'Hide Subtotal' : 'Show Subtotal'}
      </button>
    </div>
  )
}

function RenameRowDialog({
  state,
  onSave,
  onOpenChange,
}: {
  state: RowActionState | null
  onSave: (name: string) => Promise<void>
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState(state?.name ?? '')

  return (
    <Dialog open={!!state} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Row</DialogTitle>
          <DialogDescription>Update the label shown for this cash flow row.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            await onSave(name)
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="rename-row">Name</Label>
            <Input
              id="rename-row"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteRowDialog({
  state,
  onConfirm,
  onOpenChange,
}: {
  state: RowActionState | null
  onConfirm: () => Promise<void>
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!state} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Row</DialogTitle>
          <DialogDescription>
            Delete <strong>{state?.name ?? 'this row'}</strong>? This will remove the row and its linked entries.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={() => { void onConfirm() }}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UpdateCategoryDialog({
  state,
  onSave,
  onOpenChange,
}: {
  state: RowCategoryState | null
  onSave: (category: Exclude<ItemCategory, 'income'>) => Promise<void>
  onOpenChange: (open: boolean) => void
}) {
  const [category, setCategory] = useState<Exclude<ItemCategory, 'income'>>(state?.category ?? 'misc')

  return (
    <Dialog open={!!state} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Category</DialogTitle>
          <DialogDescription>
            Update the expense category for <strong>{state?.row.name ?? 'this row'}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            await onSave(category)
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Expense Category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as Exclude<ItemCategory, 'income'>)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) => expenseCategoryOptions.find((option) => option.value === value)?.label ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {expenseCategoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} label={option.label}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="submit">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ===== Tax Rate Menu ===== */

function TaxRateMenu({
  position,
  currentRate,
  onSave,
  onClose,
}: {
  position: { x: number; y: number }
  currentRate: number
  onSave: (rate: number) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(String(Math.round(currentRate * 100)))
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  function handleSubmit() {
    const parsed = parseFloat(value)
    if (isNaN(parsed) || parsed < 0 || parsed > 100) return
    onSave(parsed / 100)
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    zIndex: 50,
  }

  return (
    <div ref={menuRef} style={style} className="rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95 w-[200px]">
      <label className="text-xs text-muted-foreground">Tax Rate (%)</label>
      <div className="flex gap-2 mt-1">
        <input
          ref={inputRef}
          type="number"
          step="1"
          min="0"
          max="100"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm font-mono outline-none focus:ring-1 focus:ring-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          onClick={handleSubmit}
          className="px-2 py-1 text-xs rounded bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  )
}

/* ===== Add Entry Dialog ===== */

const addEntryCategories: { value: ItemCategory; label: string }[] = [
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

function AddEntryDialog({ year, onClose }: { year: number; onClose: () => void }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ItemCategory>('misc')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<'one_time' | 'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1)
  const createBudgetItem = useCreateBudgetItem()
  const createAdHoc = useCreateCashflowEntry()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!name.trim() || isNaN(parsed) || parsed <= 0) return

    if (frequency === 'one_time') {
      // Create a single ad-hoc entry
      createAdHoc.mutate(
        {
          year,
          month: startMonth,
          projected_amount: parsed,
          name: name.trim(),
          category,
        },
        {
          onSuccess: () => { toast.success('Entry added'); onClose() },
          onError: () => toast.error('Failed to add entry'),
        }
      )
    } else {
      // Create a budget item (generates entries via the budget page)
      createBudgetItem.mutate(
        {
          name: name.trim(),
          category,
          monthly_amount: parsed,
          frequency,
          is_income: category === 'income',
        },
        {
          onSuccess: () => { toast.success('Budget item created — generate entries on the Budget page'); onClose() },
          onError: () => toast.error('Failed to create budget item'),
        }
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-background rounded-lg border border-border p-6 w-full max-w-sm shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Add Entry</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 rounded border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ItemCategory)}
              className="w-full mt-1 rounded border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-accent"
            >
              {addEntryCategories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full mt-1 rounded border border-border bg-background px-3 py-1.5 text-sm font-mono outline-none focus:ring-1 focus:ring-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as typeof frequency)}
              className="w-full mt-1 rounded border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="one_time">One-Time</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          {frequency === 'one_time' && (
            <div>
              <label className="text-xs text-muted-foreground">Month</label>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(Number(e.target.value))}
                className="w-full mt-1 rounded border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-accent"
              >
                {monthHeaders.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-border hover:bg-secondary transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-3 py-1.5 text-sm rounded bg-accent text-white hover:bg-accent/90 transition-colors">
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
