import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useCreateBudgetItem, useUpdateBudgetItem } from '@/hooks/useBudgetItems'
import type { BudgetItem, ItemCategory, ItemFrequency, IncomeType } from '@/types/database'
import { toast } from 'sonner'

const categories: { value: ItemCategory; label: string }[] = [
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
  { value: 'untaxed', label: 'Other (Untaxed)' },
]

interface BudgetItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editItem?: BudgetItem | null
}

export function BudgetItemDialog({ open, onOpenChange, editItem }: BudgetItemDialogProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ItemCategory>('misc')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<ItemFrequency>('monthly')
  const [monthsActive, setMonthsActive] = useState<number[]>(allMonths)
  const [isIncome, setIsIncome] = useState(false)
  const [incomeType, setIncomeType] = useState<IncomeType | null>(null)
  const [ccPaid, setCcPaid] = useState(false)
  const [isVariable, setIsVariable] = useState(false)

  const createItem = useCreateBudgetItem()
  const updateItem = useUpdateBudgetItem()

  useEffect(() => {
    if (editItem) {
      setName(editItem.name)
      setCategory(editItem.category)
      setAmount(String(Number(editItem.monthly_amount)))
      setFrequency(editItem.frequency)
      setMonthsActive(editItem.months_active)
      setIsIncome(editItem.is_income)
      setIncomeType(editItem.income_type ?? null)
      setCcPaid(editItem.cc_paid)
      setIsVariable(editItem.is_variable)
    } else {
      reset()
    }
  }, [editItem, open])

  function reset() {
    setName('')
    setCategory('misc')
    setAmount('')
    setFrequency('monthly')
    setMonthsActive(allMonths)
    setIsIncome(false)
    setIncomeType(null)
    setCcPaid(false)
    setIsVariable(false)
  }

  function toggleMonth(m: number) {
    setMonthsActive((prev) =>
      prev.includes(m) ? prev.filter((v) => v !== m) : [...prev, m].sort((a, b) => a - b)
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !amount) return

    const payload = {
      name: name.trim(),
      category,
      monthly_amount: parseFloat(amount) || 0,
      frequency,
      months_active: monthsActive,
      is_income: isIncome,
      cc_paid: ccPaid,
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
    } else {
      createItem.mutate(payload, {
        onSuccess: () => {
          toast.success('Item added')
          reset()
          onOpenChange(false)
        },
        onError: () => toast.error('Failed to create item'),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit Item' : 'Add Budget Item'}</DialogTitle>
          <DialogDescription>
            {editItem ? 'Update this recurring item.' : 'Add a recurring expense or income.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ItemCategory)}>
                <SelectTrigger>
                  <SelectValue>{(v: string) => categories.find(c => c.value === v)?.label ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value} label={c.label}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-amount">Monthly Amount</Label>
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
            <Select value={frequency} onValueChange={(v) => setFrequency(v as ItemFrequency)}>
              <SelectTrigger>
                <SelectValue>{(v: string) => frequencies.find(f => f.value === v)?.label ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {frequencies.map((f) => (
                  <SelectItem key={f.value} value={f.value} label={f.label}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Active Months</Label>
            <div className="flex flex-wrap gap-1.5">
              {allMonths.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMonth(m)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    monthsActive.includes(m)
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                  }`}
                >
                  {monthLabels[m - 1]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isIncome}
                onChange={(e) => setIsIncome(e.target.checked)}
                className="rounded border-border"
              />
              Income item
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={ccPaid}
                onChange={(e) => setCcPaid(e.target.checked)}
                className="rounded border-border"
              />
              Paid via CC
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isVariable}
                onChange={(e) => setIsVariable(e.target.checked)}
                className="rounded border-border"
              />
              Variable budget
            </label>
          </div>

          {isIncome && (
            <div className="space-y-2">
              <Label>Income Type</Label>
              <Select value={incomeType ?? ''} onValueChange={(v) => setIncomeType(v as IncomeType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type…">{(v: string) => incomeTypes.find(t => t.value === v)?.label ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {incomeTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value} label={t.label}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {incomeType === 'w2' && (
                <p className="text-xs text-muted-foreground">
                  W2 income uses bi-monthly pay — first mark-paid records half, second completes it.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={createItem.isPending || updateItem.isPending}
            >
              {editItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
