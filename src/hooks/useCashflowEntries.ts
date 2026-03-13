import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import type { CashflowEntry, ItemCategory } from '@/types/database'

export function useCashflowEntries(year: number, month: number) {
  const { householdId } = useAuth()

  return useQuery({
    queryKey: ['cashflow_entries', householdId, year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cashflow_entries')
        .select('*')
        .eq('household_id', householdId!)
        .eq('year', year)
        .eq('month', month)
        .order('category')
        .order('name')

      if (error) throw error
      return data as CashflowEntry[]
    },
    enabled: !!householdId,
  })
}

export function useCashflowYear(year: number) {
  const { householdId } = useAuth()

  return useQuery({
    queryKey: ['cashflow_entries', householdId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cashflow_entries')
        .select('*')
        .eq('household_id', householdId!)
        .eq('year', year)
        .order('category')
        .order('name')
        .order('month')

      if (error) throw error
      return data as CashflowEntry[]
    },
    enabled: !!householdId,
  })
}

export function useCashflowEntriesByCategory(year: number, month: number) {
  const query = useCashflowEntries(year, month)
  const entries = query.data ?? []

  const grouped = entries.reduce<Record<string, CashflowEntry[]>>((acc, entry) => {
    const key = entry.category ?? 'misc'
    acc[key] = acc[key] || []
    acc[key].push(entry)
    return acc
  }, {})

  const expenses = entries.filter((e) => e.category !== 'income')
  const income = entries.filter((e) => e.category === 'income')

  const totalProjected = expenses.reduce((s, e) => s + Number(e.projected_amount), 0)
  const totalActual = expenses
    .filter((e) => e.is_paid)
    .reduce((s, e) => s + Number(e.actual_amount ?? e.projected_amount), 0)
  const totalUnpaid = expenses
    .filter((e) => !e.is_paid)
    .reduce((s, e) => s + Number(e.projected_amount), 0)
  const totalIncome = income.reduce((s, e) => s + Number(e.projected_amount), 0)

  return { ...query, grouped, totalProjected, totalActual, totalUnpaid, totalIncome }
}

export function useTogglePaid() {
  const queryClient = useQueryClient()
  const { householdId } = useAuth()

  return useMutation({
    mutationFn: async ({ id, is_paid }: { id: string; is_paid: boolean }) => {
      const { error } = await supabase
        .from('cashflow_entries')
        .update({
          is_paid,
          paid_date: is_paid ? new Date().toISOString() : null,
        })
        .eq('id', id)

      if (error) throw error
    },
    onMutate: async ({ id, is_paid }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['cashflow_entries', householdId] })

      queryClient.setQueriesData<CashflowEntry[]>(
        { queryKey: ['cashflow_entries', householdId] },
        (old) =>
          old?.map((e) =>
            e.id === id
              ? { ...e, is_paid, paid_date: is_paid ? new Date().toISOString() : null }
              : e
          )
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow_entries', householdId] })
    },
  })
}

export function useUpdateCashflowEntry() {
  const queryClient = useQueryClient()
  const { householdId } = useAuth()

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Partial<
      Pick<CashflowEntry, 'projected_amount' | 'actual_amount' | 'notes' | 'name' | 'category'>
    >) => {
      const { data, error } = await supabase
        .from('cashflow_entries')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as CashflowEntry
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow_entries', householdId] })
    },
  })
}

export function useCreateAdHocEntry() {
  const queryClient = useQueryClient()
  const { householdId } = useAuth()

  return useMutation({
    mutationFn: async (input: {
      year: number
      month: number
      name: string
      category: ItemCategory
      projected_amount: number
    }) => {
      const { data, error } = await supabase
        .from('cashflow_entries')
        .insert({ ...input, household_id: householdId! })
        .select()
        .single()

      if (error) throw error
      return data as CashflowEntry
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow_entries', householdId] })
    },
  })
}

export function useCreateCashflowEntry() {
  const queryClient = useQueryClient()
  const { householdId } = useAuth()

  return useMutation({
    mutationFn: async (input: {
      year: number
      month: number
      projected_amount: number
      budget_item_id?: string | null
      name?: string
      category?: ItemCategory
    }) => {
      const { data, error } = await supabase
        .from('cashflow_entries')
        .insert({ ...input, household_id: householdId! })
        .select()
        .single()

      if (error) throw error
      return data as CashflowEntry
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow_entries', householdId] })
    },
  })
}

export function useDeleteCashflowEntry() {
  const queryClient = useQueryClient()
  const { householdId } = useAuth()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cashflow_entries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow_entries', householdId] })
    },
  })
}
