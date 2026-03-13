import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import type { Household } from '@/types/database'

export function useHousehold() {
  const { householdId } = useAuth()

  return useQuery({
    queryKey: ['household', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('households')
        .select('*')
        .eq('id', householdId!)
        .single()

      if (error) throw error
      return data as Household
    },
    enabled: !!householdId,
  })
}

export function useUpdateHousehold() {
  const queryClient = useQueryClient()
  const { householdId } = useAuth()

  return useMutation({
    mutationFn: async (updates: Partial<Pick<Household, 'name' | 'estimated_tax_rate' | 'auto_sync_budget'>>) => {
      const { data, error } = await supabase
        .from('households')
        .update(updates)
        .eq('id', householdId!)
        .select()
        .single()

      if (error) throw error
      return data as Household
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household', householdId] })
    },
  })
}
