import { useState, useRef, useEffect } from 'react'
import type { CashflowEntry } from '@/types/database'
import { useTogglePaid, useUpdateCashflowEntry, useDeleteCashflowEntry } from '@/hooks/useCashflowEntries'
import { toast } from 'sonner'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

export function CashFlowRow({ entry }: { entry: CashflowEntry }) {
  const [editingField, setEditingField] = useState<'projected' | 'actual' | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const togglePaid = useTogglePaid()
  const updateEntry = useUpdateCashflowEntry()
  const deleteEntry = useDeleteCashflowEntry()

  useEffect(() => {
    if (editingField) inputRef.current?.select()
  }, [editingField])

  function startEdit(field: 'projected' | 'actual') {
    const value = field === 'projected'
      ? Number(entry.projected_amount)
      : Number(entry.actual_amount ?? entry.projected_amount)
    setEditValue(String(value))
    setEditingField(field)
  }

  function saveEdit() {
    const parsed = parseFloat(editValue)
    if (isNaN(parsed)) {
      setEditingField(null)
      return
    }

    setEditingField(null)
    const updates = editingField === 'projected'
      ? { projected_amount: parsed }
      : { actual_amount: parsed }

    updateEntry.mutate(
      { id: entry.id, ...updates },
      { onError: () => toast.error('Failed to update') }
    )
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') saveEdit()
    if (e.key === 'Escape') setEditingField(null)
  }

  function handleToggle() {
    togglePaid.mutate({ id: entry.id, is_paid: !entry.is_paid })
  }

  function handleDelete() {
    deleteEntry.mutate(entry.id, {
      onError: () => toast.error('Failed to delete entry'),
    })
  }

  const projected = Number(entry.projected_amount)
  const actual = entry.actual_amount != null ? Number(entry.actual_amount) : null

  return (
    <div
      className={`group flex items-center justify-between py-2.5 px-3 transition-opacity ${
        entry.is_paid ? 'opacity-40' : ''
      }`}
    >
      {/* Name + paid toggle */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          onClick={handleToggle}
          className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
            entry.is_paid
              ? 'border-success bg-success text-white'
              : 'border-border hover:border-foreground/30'
          }`}
          title={entry.is_paid ? 'Mark unpaid' : 'Mark paid'}
        >
          {entry.is_paid && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <span className={`text-sm truncate ${entry.is_paid ? 'line-through' : ''}`}>
          {entry.name ?? 'Unnamed'}
        </span>

        {!entry.budget_item_id && (
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">ad-hoc</span>
        )}
      </div>

      {/* Amounts */}
      <div className="flex items-center gap-4">
        {/* Projected */}
        {editingField === 'projected' ? (
          <input
            ref={inputRef}
            type="number"
            step="0.01"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            className="w-24 text-right font-mono text-sm bg-secondary border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-accent"
          />
        ) : (
          <button
            onClick={() => startEdit('projected')}
            className={`font-mono text-sm tabular-nums text-right min-w-[5rem] hover:bg-secondary rounded px-2 py-1 transition-colors text-muted-foreground ${
              entry.is_paid ? 'line-through' : ''
            }`}
            title="Projected"
          >
            {formatCurrency(projected)}
          </button>
        )}

        {/* Actual */}
        {editingField === 'actual' ? (
          <input
            ref={inputRef}
            type="number"
            step="0.01"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            className="w-24 text-right font-mono text-sm bg-secondary border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-accent"
          />
        ) : (
          <button
            onClick={() => startEdit('actual')}
            className={`font-mono text-sm tabular-nums text-right min-w-[5rem] hover:bg-secondary rounded px-2 py-1 transition-colors ${
              entry.is_paid ? 'line-through' : ''
            } ${actual != null && actual !== projected ? 'font-medium' : 'text-muted-foreground'}`}
            title="Actual"
          >
            {actual != null ? formatCurrency(actual) : '—'}
          </button>
        )}

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity text-xs px-1"
          title="Delete entry"
        >
          &times;
        </button>
      </div>
    </div>
  )
}
