import { useState, useRef, useEffect } from 'react'
import type { Account, AccountType } from '@/types/database'
import { useUpdateAccount, useDeleteAccount } from '@/hooks/useAccounts'
import { toast } from 'sonner'
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

const typeLabels: Record<string, string> = {
  cash: 'Cash',
  credit: 'Credit Card',
  retirement: 'Retirement',
  investment: 'Investment',
  '529': '529',
  other: 'Other',
}

const accountTypes: { value: AccountType; label: string }[] = [
  { value: 'cash', label: 'Cash / Checking' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'investment', label: 'Investment' },
  { value: '529', label: '529' },
  { value: 'other', label: 'Other' },
]

export function AccountCard({ account }: { account: Account }) {
  const [editingField, setEditingField] = useState<'balance' | 'statement' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const updateAccount = useUpdateAccount()

  useEffect(() => {
    if (editingField) inputRef.current?.select()
  }, [editingField])

  const isCredit = account.type === 'credit'
  const payMode = account.pay_mode ?? 'full'

  function togglePayMode() {
    const newMode = payMode === 'full' ? 'statement' : 'full'
    updateAccount.mutate(
      { id: account.id, pay_mode: newMode },
      { onError: () => toast.error('Failed to update pay mode') }
    )
  }

  function startEdit(field: 'balance' | 'statement') {
    const value = field === 'statement' ? Number(account.statement_balance ?? 0) : Number(account.balance)
    setEditValue(String(value))
    setEditingField(field)
  }

  function saveEdit() {
    const parsed = parseFloat(editValue)
    const field = editingField
    setEditingField(null)
    if (isNaN(parsed) || !field) return

    const currentValue = field === 'statement' ? Number(account.statement_balance ?? 0) : Number(account.balance)
    if (parsed === currentValue) return

    const updates = field === 'statement'
      ? { id: account.id, statement_balance: parsed }
      : { id: account.id, balance: parsed }

    updateAccount.mutate(updates, {
      onError: () => toast.error('Failed to update balance'),
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') saveEdit()
    if (e.key === 'Escape') setEditingField(null)
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  function handleCtxAction(action: string) {
    setCtxMenu(null)
    if (action === 'edit') setShowEdit(true)
    if (action === 'delete') setShowDelete(true)
  }

  function closeCtxMenu() {
    setCtxMenu(null)
  }

  const isNegative = Number(account.balance) < 0
  const formattedBalance = formatCurrency(Number(account.balance))
  const formattedStatement = formatCurrency(Number(account.statement_balance ?? 0))

  function renderEditableValue(field: 'balance' | 'statement', formatted: string, isNeg: boolean) {
    if (editingField === field) {
      return (
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={handleKeyDown}
          className="w-28 text-right font-mono text-sm bg-secondary border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      )
    }
    return (
      <button
        onClick={() => startEdit(field)}
        className={`font-mono text-sm tabular-nums text-right min-w-[5rem] hover:bg-secondary rounded px-2 py-1 transition-colors ${
          isNeg ? 'text-destructive' : ''
        }`}
      >
        {formatted}
      </button>
    )
  }

  return (
    <>
      <div
        className="group flex items-center justify-between py-2.5 px-1"
        onContextMenu={handleContextMenu}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm truncate">{account.name}</span>
          <span className="text-[10px] text-text-tertiary uppercase tracking-wider">
            {typeLabels[account.type] ?? account.type}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isCredit ? (
            <div className="flex items-center gap-3">
              <button
                onClick={togglePayMode}
                className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                  payMode === 'statement'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-muted-foreground hover:bg-secondary'
                }`}
                title={payMode === 'full' ? 'Paying full balance' : 'Paying statement balance'}
              >
                {payMode === 'full' ? 'Pay Full' : 'Pay Stmt'}
              </button>
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Statement</span>
                {renderEditableValue('statement', formattedStatement, Number(account.statement_balance ?? 0) < 0)}
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Balance</span>
                {renderEditableValue('balance', formattedBalance, isNegative)}
              </div>
            </div>
          ) : (
            renderEditableValue('balance', formattedBalance, isNegative)
          )}
        </div>
      </div>

      {ctxMenu && (
        <AccountContextMenu position={ctxMenu} onAction={handleCtxAction} onClose={closeCtxMenu} />
      )}

      {showEdit && (
        <EditAccountDialog
          account={account}
          open={showEdit}
          onOpenChange={setShowEdit}
        />
      )}

      <DeleteAccountDialog
        account={account}
        open={showDelete}
        onOpenChange={setShowDelete}
      />
    </>
  )
}

/* ── Context Menu ──────────────────────────────────────────── */

function AccountContextMenu({
  position,
  onAction,
  onClose,
}: {
  position: { x: number; y: number }
  onAction: (action: string) => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
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

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 50 }}
      className="min-w-[140px] rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95"
    >
      <button
        className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        onClick={() => onAction('edit')}
      >
        Edit Account
      </button>
      <div className="my-1 h-px bg-border" />
      <button
        className="flex w-full items-center rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
        onClick={() => onAction('delete')}
      >
        Delete Account
      </button>
    </div>
  )
}

/* ── Edit Account Dialog ───────────────────────────────────── */

function EditAccountDialog({
  account,
  open,
  onOpenChange,
}: {
  account: Account
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState(account.name)
  const [type, setType] = useState<AccountType>(account.type)
  const updateAccount = useUpdateAccount()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    updateAccount.mutate(
      { id: account.id, name: name.trim(), type },
      {
        onSuccess: () => {
          toast.success('Account updated')
          onOpenChange(false)
        },
        onError: () => toast.error('Failed to update account'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
          <DialogDescription>Update the account name or type.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-account-name">Name</Label>
            <Input
              id="edit-account-name"
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

          <DialogFooter>
            <Button
              type="submit"
              disabled={!name.trim() || updateAccount.isPending}
            >
              {updateAccount.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ── Delete Account Confirmation ───────────────────────────── */

function DeleteAccountDialog({
  account,
  open,
  onOpenChange,
}: {
  account: Account
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const deleteAccount = useDeleteAccount()

  function handleDelete() {
    deleteAccount.mutate(account.id, {
      onSuccess: () => {
        toast.success('Account deleted')
        onOpenChange(false)
      },
      onError: () => toast.error('Failed to delete account'),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Account</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{account.name}</strong>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteAccount.isPending}
          >
            {deleteAccount.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}
