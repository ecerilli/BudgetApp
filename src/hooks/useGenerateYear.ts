import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type { BudgetItem, ItemCategory } from '@/types/database'

export function useGenerateYear() {
  const queryClient = useQueryClient()
  const { householdId } = useAuth()

  return useMutation({
    mutationFn: async ({ year, items }: { year: number; items: BudgetItem[] }) => {
      const activeItems = items.filter((i) => i.active)
      const entries: Array<{
        household_id: string
        budget_item_id: string
        year: number
        month: number
        projected_amount: number
        name: string
        category: ItemCategory
      }> = []

      for (const item of activeItems) {
        for (const month of item.months_active) {
          entries.push({
            household_id: householdId!,
            budget_item_id: item.id,
            year,
            month,
            projected_amount: Number(item.monthly_amount),
            name: item.name,
            category: item.category,
          })
        }
      }

      if (entries.length === 0) return 0

      // Use upsert with onConflict to skip existing entries (additive)
      const { data, error } = await supabase
        .from('cashflow_entries')
        .upsert(entries, { onConflict: 'budget_item_id,year,month', ignoreDuplicates: true })
        .select('id')

      if (error) throw error
      return data?.length ?? 0
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow_entries', householdId] })
    },
  })
}
