import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Contact, ContactType } from '@/types/contact'
import type { ContactScore } from '@/lib/constants'

export interface CreateContactInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  type: ContactType
  entityType?: 'pp' | 'pm'
  formData?: Record<string, unknown>
}

interface ContactFilters {
  type?: ContactType
  score?: ContactScore
  search?: string
}

export function useContacts(filters?: ContactFilters) {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()

  const contactsQuery = useQuery({
    queryKey: ['contacts', profile?.agency_id, filters],
    queryFn: async () => {
      let query = supabase.from('contacts').select('*')

      if (filters?.type) query = query.eq('type', filters.type)
      if (filters?.score) query = query.eq('score', filters.score)
      if (filters?.search) {
        query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
      }

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data as Contact[]
    },
    enabled: !!user,
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
          source: 'onboarding',
          user_id: user?.id ?? null,
          agency_id: profile?.agency_id ?? null,
          form_data: input.formData ?? null,
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

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: ['contact', id],
    queryFn: async () => {
      if (!id) throw new Error('No contact ID')
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Contact
    },
    enabled: !!id,
  })
}

export function useCreateContact() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<CreateContactInput, 'entityType' | 'formData'> & { agency_id?: string; source?: string; score?: ContactScore; tags?: string[]; notes?: string }) => {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          first_name: input.firstName,
          last_name: input.lastName,
          email: input.email,
          phone: input.phone ?? null,
          type: input.type,
          source: input.source ?? 'manual',
          score: input.score ?? 'cold',
          tags: input.tags ?? [],
          notes: input.notes ?? null,
          agency_id: input.agency_id ?? profile?.agency_id ?? null,
          user_id: user?.id ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}

export function useUpdateContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Record<string, unknown>>) => {
      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact', variables.id] })
    },
  })
}

export function useDeleteContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}
