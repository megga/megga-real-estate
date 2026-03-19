import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface Contact {
  id: string
  agency_id: string | null
  user_id: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  type: 'buyer' | 'seller' | 'both' | 'lead'
  entity_type: 'pp' | 'pm'
  source: 'onboarding' | 'manual' | 'import' | 'website' | 'referral'
  score: 'hot' | 'warm' | 'cold'
  tags: string[]
  notes: string | null
  form_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface CreateContactInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  type: 'buyer' | 'seller' | 'both' | 'lead'
  entityType: 'pp' | 'pm'
  formData: Record<string, unknown>
}

export function useContacts() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()

  const contactsQuery = useQuery({
    queryKey: ['contacts', profile?.agency_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Contact[]
    },
    enabled: !!user && !!profile?.agency_id,
  })

  const createFromOnboarding = useMutation({
    mutationFn: async (input: CreateContactInput) => {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          first_name: input.firstName,
          last_name: input.lastName,
          email: input.email,
          phone: input.phone ?? null,
          type: input.type,
          entity_type: input.entityType,
          source: 'onboarding' as const,
          user_id: user?.id ?? null,
          form_data: input.formData,
        })
        .select()
        .single()
      if (error) throw error
      return data as Contact
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })

  return {
    contacts: contactsQuery.data ?? [],
    isLoading: contactsQuery.isLoading,
    createFromOnboarding: createFromOnboarding.mutateAsync,
    isCreating: createFromOnboarding.isPending,
  }
}
