import { useState } from 'react'
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
import { useCreateAccount } from '@/hooks/useAccounts'
import type { AccountType } from '@/types/database'
import { toast } from 'sonner'

const accountTypes: { value: AccountType; label: string }[] = [
  { value: 'cash', label: 'Cash / Checking' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'investment', label: 'Investment' },
  { value: '529', label: '529' },
  { value: 'other', label: 'Other' },
]

export function AddAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('cash')
  const [balance, setBalance] = useState('')
  const createAccount = useCreateAccount()

  function reset() {
    setName('')
    setType('cash')
    setBalance('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    createAccount.mutate(
      {
        name: name.trim(),
        type,
        balance: parseFloat(balance) || 0,
      },
      {
        onSuccess: () => {
          toast.success('Account added')
          reset()
          onOpenChange(false)
        },
        onError: () => toast.error('Failed to create account'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
          <DialogDescription>
            Track a financial account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="account-name">Name</Label>
            <Input
              id="account-name"
              placeholder="e.g. Chase Checking"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(val) => setType(val as AccountType)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: string) => accountTypes.find(t => t.value === v)?.label ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {accountTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value} label={t.label}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="account-balance">Balance</Label>
            <Input
              id="account-balance"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="font-mono"
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={!name.trim() || createAccount.isPending}
            >
              {createAccount.isPending ? 'Adding...' : 'Add Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
