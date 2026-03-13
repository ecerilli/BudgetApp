import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useBudgetItemsByCategory, useDeleteBudgetItem, useUpdateBudgetItem } from '@/hooks/useBudgetItems'
import { BudgetItemDialog } from './BudgetItemDialog'
import { GenerateYearButton } from './GenerateYearButton'
import type { BudgetItem, ItemCategory, IncomeType } from '@/types/database'
import { toast } from 'sonner'

const categoryLabels: Record<ItemCategory, string> = {
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

const categoryOrder: ItemCategory[] = [
  'income', 'housing', 'utilities', 'car', 'food',
  'subscriptions', 'business', 'taxes', 'savings', 'misc',
]

const incomeTypeLabels: Record<IncomeType, string> = {
  w2: 'W2',
  '1099': '1099',
  gift: 'Gift',
  reimbursement: 'Reimbursement',
  refund: 'Refund',
  untaxed: 'Other',
}

const incomeTypeOrder: IncomeType[] = ['w2', '1099', 'gift', 'reimbursement', 'refund', 'untaxed']

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

export function BudgetPage() {
  const { grouped, totalMonthly, totalIncome, isLoading } = useBudgetItemsByCategory()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<BudgetItem | null>(null)
  const deleteItem = useDeleteBudgetItem()
  const updateItem = useUpdateBudgetItem()

  function handleEdit(item: BudgetItem) {
    setEditItem(item)
    setDialogOpen(true)
  }

  function handleAdd() {
    setEditItem(null)
    setDialogOpen(true)
  }

  function handleDelete(item: BudgetItem) {
    deleteItem.mutate(item.id, {
      onError: () => toast.error('Failed to delete item'),
    })
  }

  function handleToggleActive(item: BudgetItem) {
    updateItem.mutate(
      { id: item.id, active: !item.active },
      { onError: () => toast.error('Failed to update item') }
    )
  }

  const incomeItems = grouped.income ?? []
  const incomeGrouped = incomeItems.reduce<Record<IncomeType, BudgetItem[]>>((acc, item) => {
    const key = item.income_type ?? 'untaxed'
    acc[key] = acc[key] || []
    acc[key].push(item)
    return acc
  }, {} as Record<IncomeType, BudgetItem[]>)
  const orderedIncomeTypes = incomeTypeOrder.filter((type) => incomeGrouped[type]?.length > 0)
  const orderedExpenseCategories = categoryOrder.filter((cat) => cat !== 'income' && grouped[cat]?.length > 0)
  const hasItems = orderedIncomeTypes.length > 0 || orderedExpenseCategories.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
          <p className="text-sm text-muted-foreground">
            Manage recurring expenses and income projections.
          </p>
        </div>
        <div className="flex gap-2">
          <GenerateYearButton />
          <Button onClick={handleAdd}>Add Item</Button>
        </div>
      </div>

      {/* Summary */}
      {!isLoading && (totalMonthly > 0 || totalIncome > 0) && (
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Monthly Expenses </span>
            <span className="font-mono tabular-nums font-medium">{formatCurrency(totalMonthly)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Monthly Income </span>
            <span className="font-mono tabular-nums font-medium text-success">{formatCurrency(totalIncome)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Net </span>
            <span className={`font-mono tabular-nums font-medium ${totalIncome - totalMonthly >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(totalIncome - totalMonthly)}
            </span>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasItems && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No budget items yet. Add your first item to start planning.
        </p>
      )}

      {orderedIncomeTypes.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold tracking-tight">Income</h2>
            <span className="font-mono text-sm text-success tabular-nums">{formatCurrency(totalIncome)}</span>
          </div>

          {orderedIncomeTypes.map((type) => (
            <BudgetGroup
              key={type}
              label={incomeTypeLabels[type]}
              total={incomeGrouped[type].filter((item) => item.active).reduce((sum, item) => sum + Number(item.monthly_amount), 0)}
            >
              {incomeGrouped[type].map((item) => (
                <BudgetItemRow
                  key={item.id}
                  item={item}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </BudgetGroup>
          ))}
        </section>
      )}

      {orderedExpenseCategories.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold tracking-tight">Expenses</h2>
            <span className="font-mono text-sm tabular-nums">{formatCurrency(totalMonthly)}</span>
          </div>

          {orderedExpenseCategories.map((cat) => (
            <BudgetGroup
              key={cat}
              label={categoryLabels[cat]}
              total={grouped[cat].filter((item) => item.active).reduce((sum, item) => sum + Number(item.monthly_amount), 0)}
            >
              {grouped[cat].map((item) => (
                <BudgetItemRow
                  key={item.id}
                  item={item}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </BudgetGroup>
          ))}
        </section>
      )}

      {dialogOpen && (
        <BudgetItemDialog
          key={editItem?.id ?? 'new'}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editItem={editItem}
        />
      )}
    </div>
  )
}

function BudgetGroup({
  label,
  total,
  children,
}: {
  label: string
  total: number
  children: ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </h3>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>
      <div className="rounded border border-border divide-y divide-border">
        {children}
      </div>
    </div>
  )
}

function BudgetItemRow({
  item,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  item: BudgetItem
  onEdit: (item: BudgetItem) => void
  onDelete: (item: BudgetItem) => void
  onToggleActive: (item: BudgetItem) => void
}) {
  const frequencyLabel: Record<string, string> = {
    monthly: 'Mo',
    quarterly: 'Qt',
    yearly: 'Yr',
    one_time: '1x',
  }
  const incomeTypeLabel = item.is_income && item.income_type ? incomeTypeLabels[item.income_type] : null

  return (
    <div
      className={`group flex items-center justify-between py-2.5 px-3 ${
        !item.active ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => onEdit(item)}
          className="text-sm truncate text-left hover:underline"
        >
          {item.name}
        </button>
        <Badge variant="secondary" className="text-[10px]">
          {frequencyLabel[item.frequency] ?? item.frequency}
        </Badge>
        {incomeTypeLabel && (
          <Badge variant="secondary" className="text-[10px]">
            {incomeTypeLabel}
          </Badge>
        )}
        {item.cc_paid && (
          <span className="text-[10px] text-muted-foreground">CC</span>
        )}
        {item.is_variable && (
          <span className="text-[10px] text-muted-foreground">Variable</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className={`font-mono text-sm tabular-nums ${item.is_income ? 'text-success' : ''}`}>
          {formatCurrency(Number(item.monthly_amount))}
        </span>
        <button
          onClick={() => onToggleActive(item)}
          className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground transition-opacity px-1"
          title={item.active ? 'Deactivate' : 'Activate'}
        >
          {item.active ? '○' : '●'}
        </button>
        <button
          onClick={() => onDelete(item)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity text-xs px-1"
          title="Delete"
        >
          &times;
        </button>
      </div>
    </div>
  )
}
