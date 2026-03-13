import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import type { Account, AccountType } from '@/types/database'

export function useAccounts() {
  const { householdId } = useAuth()

  return useQuery({
    queryKey: ['accounts', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('household_id', householdId!)
        .order('sort_order')
        .order('name')

      if (error) throw error
      return data as Account[]
    },
    enabled: !!householdId,
  })
}

export function useAccountsByType() {
  const query = useAccounts()

  const grouped = (query.data ?? []).reduce<Record<AccountType, Account[]>>(
    (acc, account) => {
      acc[account.type] = acc[account.type] || []
      acc[account.type].push(account)
      return acc
    },
    {} as Record<AccountType, Account[]>
  )

  const totals = {
    cash: sumByType(query.data, 'cash'),
    credit: sumByType(query.data, 'credit'),
    creditStatement: sumStatementByType(query.data, 'credit'),
    retirement:
      sumByType(query.data, 'retirement') +
      sumByType(query.data, 'investment') +
      sumByType(query.data, '529'),
  }

  // Per-card CC payment: sum each card's selected amount based on its pay_mode
  const ccPayTotal = (grouped.credit ?? []).reduce((sum, a) => {
    const amount = a.pay_mode === 'statement'
      ? Number(a.statement_balance ?? 0)
      : Number(a.balance)
    return sum + amount
  }, 0)

  // Deferred balance: full balance minus what's being paid this month
  const ccRollover = totals.credit - ccPayTotal

  const netCash = totals.cash - totals.credit
  const netWorth = netCash + totals.retirement

  return { ...query, grouped, totals, ccPayTotal, ccRollover, netCash, netWorth }
}

function sumByType(accounts: Account[] | undefined, type: AccountType): number {
  if (!accounts) return 0
  return accounts
    .filter((a) => a.type === type)
    .reduce((sum, a) => sum + Number(a.balance), 0)
}

function sumStatementByType(accounts: Account[] | undefined, type: AccountType): number {
  if (!accounts) return 0
  return accounts
    .filter((a) => a.type === type)
    .reduce((sum, a) => sum + Number(a.statement_balance ?? 0), 0)
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  const { householdId } = useAuth()

  return useMutation({
    mutationFn: async (input: { name: string; type: AccountType; balance: number }) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert({ ...input, household_id: householdId! })
        .select()
        .single()

      if (error) throw error
      return data as Account
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', householdId] })
    },
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  const { householdId } = useAuth()

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Partial<Pick<Account, 'name' | 'type' | 'balance' | 'statement_balance' | 'pay_mode' | 'notes' | 'sort_order'>>) => {
      const { data, error } = await supabase
        .from('accounts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Account
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', householdId] })
    },
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  const { householdId } = useAuth()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', householdId] })
    },
  })
}
