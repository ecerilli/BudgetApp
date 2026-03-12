import { useState, useRef, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useCashflowYear, useTogglePaid, useUpdateCashflowEntry } from '@/hooks/useCashflowEntries'
import type { CashflowEntry } from '@/types/database'
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

interface YearRow {
  key: string
  name: string
  budgetItemId: string | null
  category: string
  entries: (CashflowEntry | null)[] // index 0-11 for months 1-12
}

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

function sumMonth(rows: YearRow[], monthIdx: number): number {
  return rows.reduce((sum, row) => {
    const entry = row.entries[monthIdx]
    if (!entry) return sum
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

export function CashFlowYearView({ year }: { year: number }) {
  const { data: entries, isLoading } = useCashflowYear(year)

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

  // Month totals
  const expenseMonthTotals = monthHeaders.map((_, i) => sumMonth(expenseRows, i))
  const incomeMonthTotals = monthHeaders.map((_, i) => sumMonth(incomeRows, i))
  const savingsMonthTotals = monthHeaders.map((_, i) => incomeMonthTotals[i] - expenseMonthTotals[i])

  const totalExpensesYear = expenseMonthTotals.reduce((a, b) => a + b, 0)
  const totalIncomeYear = incomeMonthTotals.reduce((a, b) => a + b, 0)

  const orderedExpenseCategories = expenseCategoryOrder.filter((cat) => expensesByCategory[cat]?.length > 0)

  const currentMonth = new Date().getMonth() // 0-indexed

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-xs border-collapse min-w-[900px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-2 font-medium text-muted-foreground uppercase tracking-wider w-[180px] sticky left-0 bg-background z-10">
              {/* Empty — row labels */}
            </th>
            {monthHeaders.map((m, i) => (
              <th
                key={m}
                className={`text-right py-2 px-1.5 font-medium uppercase tracking-wider min-w-[70px] ${
                  i === currentMonth && year === new Date().getFullYear()
                    ? 'text-accent'
                    : 'text-muted-foreground'
                }`}
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
          {/* ===== EXPENSES ===== */}
          <tr>
            <td
              colSpan={14}
              className="pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
            >
              Expenses
            </td>
          </tr>

          {orderedExpenseCategories.map((cat) => {
            const rows = expensesByCategory[cat]
            const catMonthTotals = monthHeaders.map((_, i) => sumMonth(rows, i))
            const catYearTotal = catMonthTotals.reduce((a, b) => a + b, 0)

            return (
              <CategorySection
                key={cat}
                category={cat}
                rows={rows}
                catMonthTotals={catMonthTotals}
                catYearTotal={catYearTotal}
                currentMonth={currentMonth}
                currentYear={year}
              />
            )
          })}

          {/* TOTAL EXPENSES */}
          <tr className="border-t-2 border-foreground/20 font-semibold">
            <td className="py-2 pr-2 sticky left-0 bg-background z-10 text-xs uppercase tracking-wider">
              Total Expenses
            </td>
            {expenseMonthTotals.map((total, i) => (
              <td key={i} className="text-right py-2 px-1.5 font-mono tabular-nums text-destructive">
                {fmt(total)}
              </td>
            ))}
            <td className="text-right py-2 pl-2 font-mono tabular-nums text-destructive border-l border-border">
              {fmtFull(totalExpensesYear)}
            </td>
          </tr>

          {/* Spacer */}
          <tr><td colSpan={14} className="h-4" /></tr>

          {/* ===== INCOME ===== */}
          <tr>
            <td
              colSpan={14}
              className="pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
            >
              Income
            </td>
          </tr>

          {incomeRows.map((row) => (
            <EntryRow key={row.key} row={row} currentMonth={currentMonth} currentYear={year} />
          ))}

          {/* TOTAL INCOME */}
          <tr className="border-t-2 border-foreground/20 font-semibold">
            <td className="py-2 pr-2 sticky left-0 bg-background z-10 text-xs uppercase tracking-wider">
              Total Income
            </td>
            {incomeMonthTotals.map((total, i) => (
              <td key={i} className="text-right py-2 px-1.5 font-mono tabular-nums text-success">
                {fmt(total)}
              </td>
            ))}
            <td className="text-right py-2 pl-2 font-mono tabular-nums text-success border-l border-border">
              {fmtFull(totalIncomeYear)}
            </td>
          </tr>

          {/* Spacer */}
          <tr><td colSpan={14} className="h-4" /></tr>

          {/* ===== SAVINGS ===== */}
          <tr className="border-t-2 border-foreground/20 font-semibold">
            <td className="py-2 pr-2 sticky left-0 bg-background z-10 text-xs uppercase tracking-wider">
              Net Savings
            </td>
            {savingsMonthTotals.map((total, i) => (
              <td
                key={i}
                className={`text-right py-2 px-1.5 font-mono tabular-nums ${
                  total >= 0 ? 'text-success' : 'text-destructive'
                }`}
              >
                {fmt(total)}
              </td>
            ))}
            <td
              className={`text-right py-2 pl-2 font-mono tabular-nums border-l border-border ${
                totalIncomeYear - totalExpensesYear >= 0 ? 'text-success' : 'text-destructive'
              }`}
            >
              {fmtFull(totalIncomeYear - totalExpensesYear)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function CategorySection({
  category,
  rows,
  catMonthTotals,
  catYearTotal,
  currentMonth,
  currentYear,
}: {
  category: string
  rows: YearRow[]
  catMonthTotals: number[]
  catYearTotal: number
  currentMonth: number
  currentYear: number
}) {
  return (
    <>
      {/* Category header */}
      <tr className="border-t border-border/50">
        <td
          colSpan={14}
          className="pt-2 pb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sticky left-0 bg-background z-10"
        >
          {categoryLabels[category] ?? category}
        </td>
      </tr>

      {/* Item rows */}
      {rows.map((row) => (
        <EntryRow key={row.key} row={row} currentMonth={currentMonth} currentYear={currentYear} />
      ))}

      {/* Category subtotal */}
      {rows.length > 1 && (
        <tr className="border-t border-border/30">
          <td className="py-1 pr-2 text-right text-[10px] text-muted-foreground italic sticky left-0 bg-background z-10">
            {categoryLabels[category]} total
          </td>
          {catMonthTotals.map((total, i) => (
            <td key={i} className="text-right py-1 px-1.5 font-mono tabular-nums text-[10px] text-muted-foreground">
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

function EntryRow({ row, currentMonth, currentYear }: { row: YearRow; currentMonth: number; currentYear: number }) {
  const yearTotal = sumRowTotal(row)
  const isExpense = row.category !== 'income'

  return (
    <tr className="group hover:bg-secondary/30 transition-colors">
      <td className="py-1.5 pr-2 text-sm truncate max-w-[180px] sticky left-0 bg-background group-hover:bg-secondary/30 z-10 transition-colors">
        {row.name}
      </td>
      {row.entries.map((entry, i) => (
        <YearCell
          key={i}
          entry={entry}
          isCurrentMonth={i === currentMonth && currentYear === new Date().getFullYear()}
          isExpense={isExpense}
        />
      ))}
      <td
        className={`text-right py-1.5 pl-2 font-mono tabular-nums text-xs font-medium border-l border-border ${
          isExpense ? '' : 'text-success'
        }`}
      >
        {fmt(yearTotal)}
      </td>
    </tr>
  )
}

function YearCell({
  entry,
  isCurrentMonth,
  isExpense,
}: {
  entry: CashflowEntry | null
  isCurrentMonth: boolean
  isExpense: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const togglePaid = useTogglePaid()
  const updateEntry = useUpdateCashflowEntry()

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  if (!entry) {
    return (
      <td
        className={`text-right py-1.5 px-1.5 ${isCurrentMonth ? 'bg-accent/5' : ''}`}
      />
    )
  }

  const amount = Number(entry.actual_amount ?? entry.projected_amount)

  function handleClick() {
    setEditValue(String(Math.abs(Number(entry!.actual_amount ?? entry!.projected_amount))))
    setEditing(true)
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    togglePaid.mutate({ id: entry!.id, is_paid: !entry!.is_paid })
  }

  function handleSave() {
    const parsed = parseFloat(editValue)
    setEditing(false)
    if (isNaN(parsed)) return

    updateEntry.mutate(
      { id: entry!.id, actual_amount: parsed },
      { onError: () => toast.error('Failed to update') }
    )
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <td className={`py-0.5 px-0.5 ${isCurrentMonth ? 'bg-accent/5' : ''}`}>
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full text-right font-mono text-xs bg-background border border-accent rounded px-1 py-0.5 outline-none"
        />
      </td>
    )
  }

  return (
    <td
      className={`text-right py-1.5 px-1.5 font-mono tabular-nums cursor-pointer transition-colors ${
        isCurrentMonth ? 'bg-accent/5' : ''
      } ${entry.is_paid ? 'opacity-40 line-through' : ''} ${
        isExpense ? '' : 'text-success'
      }`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={entry.is_paid ? 'Paid — right-click to unmark' : 'Click to edit, right-click to mark paid'}
    >
      {fmt(isExpense ? -amount : amount)}
    </td>
  )
}
