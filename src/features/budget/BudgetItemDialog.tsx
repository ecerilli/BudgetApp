import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateBudgetItem, useUpdateBudgetItem } from '@/hooks/useBudgetItems'
import type { BudgetItem, ItemCategory, ItemFrequency, IncomeType } from '@/types/database'
import { toast } from 'sonner'

const expenseCategories: { value: Exclude<ItemCategory, 'income'>; label: string }[] = [
  { value: 'housing', label: 'Housing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'car', label: 'Car' },
  { value: 'food', label: 'Food' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'misc', label: 'Misc' },
  { value: 'business', label: 'Business' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'savings', label: 'Savings' },
]

const frequencies: { value: ItemFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'one_time', label: 'One Time' },
]

const allMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const incomeTypes: { value: IncomeType; label: string }[] = [
  { value: 'w2', label: 'W2' },
  { value: '1099', label: '1099' },
  { value: 'gift', label: 'Gift' },
  { value: 'reimbursement', label: 'Reimbursement' },
  { value: 'refund', label: 'Refund' },
  { value: 'untaxed', label: 'Other' },
]

interface BudgetItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editItem?: BudgetItem | null
}

function getInitialFormState(editItem?: BudgetItem | null) {
  return {
    name: editItem?.name ?? '',
    expenseCategory: editItem && !editItem.is_income ? editItem.category as Exclude<ItemCategory, 'income'> : 'misc',
    amount: editItem ? String(Number(editItem.monthly_amount)) : '',
    frequency: editItem?.frequency ?? 'monthly',
    monthsActive: editItem?.months_active ?? allMonths,
    isIncome: editItem?.is_income ?? false,
    incomeType: editItem?.income_type ?? null,
    ccPaid: editItem?.cc_paid ?? false,
    isVariable: editItem?.is_variable ?? false,
  } as const
}

export function BudgetItemDialog({ open, onOpenChange, editItem }: BudgetItemDialogProps) {
  const initialState = getInitialFormState(editItem)
  const [name, setName] = useState(initialState.name)
  const [expenseCategory, setExpenseCategory] = useState<Exclude<ItemCategory, 'income'>>(initialState.expenseCategory)
  const [amount, setAmount] = useState(initialState.amount)
  const [frequency, setFrequency] = useState<ItemFrequency>(initialState.frequency)
  const [monthsActive, setMonthsActive] = useState<number[]>(initialState.monthsActive)
  const [isIncome, setIsIncome] = useState(initialState.isIncome)
  const [incomeType, setIncomeType] = useState<IncomeType | null>(initialState.incomeType)
  const [ccPaid, setCcPaid] = useState(initialState.ccPaid)
  const [isVariable, setIsVariable] = useState(initialState.isVariable)

  const createItem = useCreateBudgetItem()
  const updateItem = useUpdateBudgetItem()

  function reset() {
    setName('')
    setExpenseCategory('misc')
    setAmount('')
    setFrequency('monthly')
    setMonthsActive(allMonths)
    setIsIncome(false)
    setIncomeType(null)
    setCcPaid(false)
    setIsVariable(false)
  }

  function handleItemTypeChange(nextType: 'income' | 'expense') {
    const nextIsIncome = nextType === 'income'
    setIsIncome(nextIsIncome)

    if (nextIsIncome) {
      setCcPaid(false)
    }
  }

  function toggleMonth(month: number) {
    setMonthsActive((prev) =>
      prev.includes(month) ? prev.filter((value) => value !== month) : [...prev, month].sort((a, b) => a - b)
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !amount) return

    const payload = {
      name: name.trim(),
      category: (isIncome ? 'income' : expenseCategory) as ItemCategory,
      monthly_amount: parseFloat(amount) || 0,
      frequency,
      months_active: monthsActive,
      is_income: isIncome,
      cc_paid: isIncome ? false : ccPaid,
      is_variable: isVariable,
      income_type: isIncome ? incomeType : null,
    }

    if (editItem) {
      updateItem.mutate(
        { id: editItem.id, ...payload },
        {
          onSuccess: () => {
            toast.success('Item updated')
            onOpenChange(false)
          },
          onError: () => toast.error('Failed to update item'),
        }
      )
      return
    }

    createItem.mutate(payload, {
      onSuccess: () => {
        toast.success('Item added')
        reset()
        onOpenChange(false)
      },
      onError: () => toast.error('Failed to create item'),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit Item' : 'Add Budget Item'}</DialogTitle>
          <DialogDescription>
            {editItem ? 'Update this recurring item.' : 'Add a recurring income or expense item.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Item Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleItemTypeChange('expense')}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  !isIncome
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background text-foreground hover:border-foreground/30'
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => handleItemTypeChange('income')}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  isIncome
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background text-foreground hover:border-foreground/30'
                }`}
              >
                Income
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isIncome ? 'e.g. Main paycheck' : 'e.g. Rent'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isIncome ? 'Income Type' : 'Expense Category'}</Label>
              {isIncome ? (
                <Select value={incomeType ?? ''} onValueChange={(value) => setIncomeType(value as IncomeType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type...">
                      {(value: string) => incomeTypes.find((type) => type.value === value)?.label ?? value}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {incomeTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value} label={type.label}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={expenseCategory} onValueChange={(value) => setExpenseCategory(value as Exclude<ItemCategory, 'income'>)}>
                  <SelectTrigger>
                    <SelectValue>
                      {(value: string) => expenseCategories.find((category) => category.value === value)?.label ?? value}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value} label={category.label}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-amount">{isIncome ? 'Planned Amount' : 'Budget Amount'}</Label>
              <Input
                id="item-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={(value) => setFrequency(value as ItemFrequency)}>
              <SelectTrigger>
                <SelectValue>{(value: string) => frequencies.find((frequency) => frequency.value === value)?.label ?? value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {frequencies.map((item) => (
                  <SelectItem key={item.value} value={item.value} label={item.label}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Active Months</Label>
            <div className="flex flex-wrap gap-1.5">
              {allMonths.map((month) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => toggleMonth(month)}
                  className={`rounded border px-2 py-1 text-xs transition-colors ${
                    monthsActive.includes(month)
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-background text-muted-foreground hover:border-foreground/30'
                  }`}
                >
                  {monthLabels[month - 1]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isVariable}
                onChange={(e) => setIsVariable(e.target.checked)}
                className="rounded border-border"
              />
              {isIncome ? 'Variable amount' : 'Variable budget'}
            </label>

            {!isIncome && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ccPaid}
                  onChange={(e) => setCcPaid(e.target.checked)}
                  className="rounded border-border"
                />
                Paid via CC
              </label>
            )}
          </div>

          {isIncome && incomeType === 'w2' && (
            <p className="text-xs text-muted-foreground">
              W2 income uses the half-pay workflow in the cash flow year view.
            </p>
          )}

          {isIncome && isVariable && (
            <p className="text-xs text-muted-foreground">
              Variable income uses the entered amount directly. It does not use remaining-budget behavior.
            </p>
          )}

          {!isIncome && isVariable && (
            <p className="text-xs text-muted-foreground">
              Variable expenses use the budget amount here, then track actual spending from the cash flow year view.
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
              {editItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
