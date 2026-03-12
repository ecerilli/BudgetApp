import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type { BudgetItem, ItemCategory, ItemFrequency } from '@/types/database'

export function useBudgetItems() {
  const { householdId } = useAuth()

  return useQuery({
    queryKey: ['budget_items', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('household_id', householdId!)
        .order('category')
        .order('sort_order')
        .order('name')

      if (error) throw error
      return data as BudgetItem[]
    },
    enabled: !!householdId,
  })
}

export function useBudgetItemsByCategory() {
  const query = useBudgetItems()
  const items = query.data ?? []

  const grouped = items.reduce<Record<ItemCategory, BudgetItem[]>>((acc, item) => {
    acc[item.category] = acc[item.category] || []
    acc[item.category].push(item)
    return acc
  }, {} as Record<ItemCategory, BudgetItem[]>)

  const totalMonthly = items
    .filter((i) => i.active && !i.is_income)
    .reduce((sum, i) => sum + Number(i.monthly_amount), 0)

  const totalIncome = items
    .filter((i) => i.active && i.is_income)
    .reduce((sum, i) => sum + Number(i.monthly_amount), 0)

  return { ...query, grouped, totalMonthly, totalIncome }
}

export function useCreateBudgetItem() {
  const queryClient = useQueryClient()
  const { householdId } = useAuth()

  return useMutation({
    mutationFn: async (input: {
      name: string
      category: ItemCategory
      monthly_amount: number
      frequency?: ItemFrequency
      months_active?: number[]
      is_income?: boolean
      cc_paid?: boolean
    }) => {
      const { data, error } = await supabase
        .from('budget_items')
        .insert({ ...input, household_id: householdId! })
        .select()
        .single()

      if (error) throw error
      return data as BudgetItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget_items', householdId] })
    },
  })
}

export function useUpdateBudgetItem() {
  const queryClient = useQueryClient()
  const { householdId } = useAuth()

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Partial<
      Pick<
        BudgetItem,
        'name' | 'category' | 'monthly_amount' | 'frequency' | 'months_active' | 'is_income' | 'cc_paid' | 'active' | 'sort_order'
      >
    >) => {
      const { data, error } = await supabase
        .from('budget_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as BudgetItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget_items', householdId] })
    },
  })
}

export function useDeleteBudgetItem() {
  const queryClient = useQueryClient()
  const { householdId } = useAuth()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budget_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget_items', householdId] })
    },
  })
}
