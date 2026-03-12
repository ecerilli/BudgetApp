import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useBudgetItemsByCategory, useDeleteBudgetItem, useUpdateBudgetItem } from '@/hooks/useBudgetItems'
import { BudgetItemDialog } from './BudgetItemDialog'
import { GenerateYearButton } from './GenerateYearButton'
import type { BudgetItem, ItemCategory } from '@/types/database'
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

  const orderedCategories = categoryOrder.filter((cat) => grouped[cat]?.length > 0)

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
      {!isLoading && orderedCategories.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No budget items yet. Add your first item to start planning.
        </p>
      )}

      {/* Items grouped by category */}
      {orderedCategories.map((cat) => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {categoryLabels[cat]}
            </h2>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {formatCurrency(
                grouped[cat].filter((i) => i.active).reduce((s, i) => s + Number(i.monthly_amount), 0)
              )}
            </span>
          </div>
          <div className="border border-border rounded divide-y divide-border">
            {grouped[cat].map((item) => (
              <BudgetItemRow
                key={item.id}
                item={item}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        </div>
      ))}

      <BudgetItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editItem={editItem}
      />
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
        {item.cc_paid && (
          <span className="text-[10px] text-muted-foreground">CC</span>
        )}
        {item.is_income && (
          <span className="text-[10px] text-success font-medium">Income</span>
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
