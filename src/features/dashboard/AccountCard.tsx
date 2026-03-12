import { useState, useRef, useEffect } from 'react'
import type { Account } from '@/types/database'
import { useUpdateAccount, useDeleteAccount } from '@/hooks/useAccounts'
import { toast } from 'sonner'

const typeLabels: Record<string, string> = {
  cash: 'Cash',
  credit: 'Credit Card',
  retirement: 'Retirement',
  investment: 'Investment',
  '529': '529',
  other: 'Other',
}

export function AccountCard({ account }: { account: Account }) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const updateAccount = useUpdateAccount()
  const deleteAccount = useDeleteAccount()

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function startEdit() {
    setEditValue(String(Number(account.balance)))
    setEditing(true)
  }

  function saveEdit() {
    const parsed = parseFloat(editValue)
    if (isNaN(parsed)) {
      setEditing(false)
      return
    }

    setEditing(false)
    if (parsed === Number(account.balance)) return

    updateAccount.mutate(
      { id: account.id, balance: parsed },
      { onError: () => toast.error('Failed to update balance') }
    )
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') saveEdit()
    if (e.key === 'Escape') setEditing(false)
  }

  function handleDelete() {
    deleteAccount.mutate(account.id, {
      onError: () => toast.error('Failed to delete account'),
    })
  }

  const isNegative = Number(account.balance) < 0
  const formattedBalance = formatCurrency(Number(account.balance))

  return (
    <div className="group flex items-center justify-between py-2.5 px-1">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm truncate">{account.name}</span>
        <span className="text-[10px] text-text-tertiary uppercase tracking-wider">
          {typeLabels[account.type] ?? account.type}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            step="0.01"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            className="w-28 text-right font-mono text-sm bg-secondary border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-accent"
          />
        ) : (
          <button
            onClick={startEdit}
            className={`font-mono text-sm tabular-nums text-right min-w-[5rem] hover:bg-secondary rounded px-2 py-1 transition-colors ${
              isNegative ? 'text-destructive' : ''
            }`}
          >
            {formattedBalance}
          </button>
        )}

        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity text-xs px-1"
          title="Delete account"
        >
          &times;
        </button>
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
