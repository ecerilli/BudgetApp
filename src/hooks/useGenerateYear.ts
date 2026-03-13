import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
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

      // Sync budget-backed rows for the year so name/category/amount edits
      // flow into the year view while preserving actuals and paid state.
      const { data, error } = await supabase
        .from('cashflow_entries')
        .upsert(entries, { onConflict: 'budget_item_id,year,month' })
        .select('id')

      if (error) throw error
      return data?.length ?? 0
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow_entries', householdId] })
    },
  })
}
