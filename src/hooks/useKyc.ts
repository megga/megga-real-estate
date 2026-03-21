import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { KycCase, KycChecklistItem, KycStatus } from '@/types/kyc'

interface KycFilters {
  status?: KycStatus
}

export function useKycCases(filters?: KycFilters) {
  return useQuery({
    queryKey: ['kyc-cases', filters],
    queryFn: async () => {
      let query = supabase
        .from('kyc_cases')
        .select('*, contact:contacts(first_name, last_name), transaction:transactions(id, stage)')

      if (filters?.status) query = query.eq('status', filters.status)

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data as KycCase[]
    },
  })
}

export function useKycCase(id: string | undefined) {
  return useQuery({
    queryKey: ['kyc-case', id],
    queryFn: async () => {
      if (!id) throw new Error('No KYC case ID')
      const { data, error } = await supabase
        .from('kyc_cases')
        .select('*, contact:contacts(*), transaction:transactions(*), checklist:kyc_checklist_items(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as KycCase & { checklist: KycChecklistItem[] }
    },
    enabled: !!id,
  })
}

export function useUpdateKycItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const updates: Record<string, unknown> = { is_completed }
      if (is_completed) {
        updates.completed_at = new Date().toISOString()
      } else {
        updates.completed_at = null
        updates.completed_by = null
      }

      const { data, error } = await supabase
        .from('kyc_checklist_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-case'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-cases'] })
    },
  })
}

export function useValidateKycCase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, validated_by }: { id: string; validated_by: string }) => {
      const { data, error } = await supabase
        .from('kyc_cases')
        .update({
          status: 'validated' as KycStatus,
          validated_by,
          validated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kyc-case', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['kyc-cases'] })
    },
  })
}
